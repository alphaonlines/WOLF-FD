import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle, AlertTriangle, UploadCloud, FileSpreadsheet } from "lucide-react";
import { fetchCoverageMonths, uploadPosExports } from "../services/posBackendApi";

type FileCheckStatus = "ready" | "invalid" | "uploading" | "uploaded" | "error";

type FileCheck = {
  file: File;
  status: FileCheckStatus;
  typeLabel?: string;
  errors?: string[];
  columns?: string[];
};

const SALES_REQUIRED: Array<string[]> = [
  ["sales#", "sale #"],
  ["date of sale"],
  ["sales person"],
  ["sales location"],
  ["grand total"],
];

const ITEMS_REQUIRED: Array<string[]> = [
  ["sale #", "sales#"],
  ["sales date"],
  ["item #"],
  ["item description"],
  ["qty sold"],
  ["total sale price"],
];

const normalize = (value: string) => value.trim().toLowerCase();

const hasAllRequired = (columns: string[], required: Array<string[]>) => {
  const set = new Set(columns.map(normalize));
  return required.every((group) => group.some((col) => set.has(col)));
};

const compressMonths = (months: string[]) => {
  const sorted = Array.from(new Set(months))
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .sort();
  const ranges: string[] = [];
  let start = "";
  let prev = "";

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const pushRange = () => {
    if (!start) return;
    if (start === prev) {
      ranges.push(formatMonth(start));
    } else {
      ranges.push(`${formatMonth(start)}–${formatMonth(prev)}`);
    }
  };

  const nextMonth = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d.toISOString().slice(0, 7);
  };

  for (const m of sorted) {
    if (!start) {
      start = m;
      prev = m;
      continue;
    }
    if (nextMonth(prev) === m) {
      prev = m;
      continue;
    }
    pushRange();
    start = m;
    prev = m;
  }
  pushRange();

  return ranges;
};

const extractHeaders = (sheet: XLSX.WorkSheet): string[] => {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as Array<Array<string>>;
  for (const row of rows.slice(0, 10)) {
    const headers = row.map((cell) => String(cell || "").trim()).filter(Boolean);
    if (headers.length >= 3) return headers;
  }
  return [];
};

const detectType = (columns: string[]) => {
  if (hasAllRequired(columns, SALES_REQUIRED)) return "Sales Report";
  if (hasAllRequired(columns, ITEMS_REQUIRED)) return "Items Export";
  return null;
};

type UpdateDatabaseProps = {
  onUploadComplete?: () => void;
};

const UpdateDatabase: React.FC<UpdateDatabaseProps> = ({ onUploadComplete }) => {
  const [checks, setChecks] = useState<FileCheck[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [missingSalesMonths, setMissingSalesMonths] = useState<string[]>([]);
  const [missingItemMonths, setMissingItemMonths] = useState<string[]>([]);

  const validChecks = useMemo(() => checks.filter((c) => c.status === "ready"), [checks]);
  const hasErrors = checks.some((c) => c.status === "invalid" || c.status === "error");

  const isFilenameWarning = (msg: string) =>
    msg.includes("Unrecognized filename") ||
    msg.includes("Expected exactly 2 files per update") ||
    msg.includes("Expected both sales_report") ||
    msg.includes("Filename suffixes do not match");

  const filterDisplayWarnings = (warnings: string[]) =>
    warnings.filter((w) => !isFilenameWarning(w));

  const runValidation = async (files: File[]) => {
    const nextChecks: FileCheck[] = [];
    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          nextChecks.push({
            file,
            status: "invalid",
            errors: ["No worksheets found in file."],
          });
          continue;
        }
        const headers = extractHeaders(firstSheet);
        if (!headers.length) {
          nextChecks.push({
            file,
            status: "invalid",
            errors: ["Could not detect header row. Please export with headers."],
          });
          continue;
        }
        const typeLabel = detectType(headers);
        if (!typeLabel) {
          nextChecks.push({
            file,
            status: "invalid",
            columns: headers,
            errors: ["Columns do not match a known export type."],
          });
          continue;
        }
        nextChecks.push({
          file,
          status: "ready",
          typeLabel,
          columns: headers,
        });
      } catch (err) {
        nextChecks.push({
          file,
          status: "error",
          errors: ["Failed to read file. Try exporting again."],
        });
      }
    }
    setChecks(nextChecks);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadWarnings([]);
  };

  const refreshCoverage = () => {
    fetchCoverageMonths()
      .then((data) => {
        setMissingSalesMonths(data.missingSalesMonths || []);
        setMissingItemMonths(data.missingItemMonths || []);
      })
      .catch(() => {
        setMissingSalesMonths([]);
        setMissingItemMonths([]);
      });
  };

  useEffect(() => {
    refreshCoverage();
  }, []);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    runValidation(files);
  };

  const setFileStatus = (fileName: string, status: FileCheckStatus, clearErrors = false) => {
    setChecks((prev) =>
      prev.map((c) => {
        if (c.file.name !== fileName) return c;
        return {
          ...c,
          status,
          errors: clearErrors ? undefined : c.errors,
        };
      })
    );
  };

  const handleRetry = async (fileName: string) => {
    const target = checks.find((c) => c.file.name === fileName);
    if (!target) return;
    setUploadError(null);
    setUploadWarnings([]);
    setFileStatus(fileName, "uploading");
    try {
      const result = await uploadPosExports([target.file]);
      if (Array.isArray(result?.warnings) && result.warnings.length) {
        const displayWarnings = filterDisplayWarnings(result.warnings);
        setUploadWarnings(displayWarnings);
      }
      if (result?.import?.stderr) {
        setUploadError(`Import error: ${result.import.stderr}`);
        setFileStatus(fileName, "error");
        return;
      }
      setFileStatus(fileName, "uploaded", true);
      setUploadSuccess("File uploaded and imported.");
      setUploadError(null);
      refreshCoverage();
      if (onUploadComplete) onUploadComplete();
    } catch {
      setUploadError("Upload failed. Check the POS backend and try again.");
      setFileStatus(fileName, "error");
    }
  };

  const handleUpload = async () => {
    if (!validChecks.length) return;
    setUploadError(null);
    setUploadSuccess(null);
    setUploadWarnings([]);
    setChecks((prev) => prev.map((c) => (c.status === "ready" ? { ...c, status: "uploading" } : c)));
    try {
      const result = await uploadPosExports(validChecks.map((c) => c.file));
      if (Array.isArray(result?.warnings) && result.warnings.length) {
        const displayWarnings = filterDisplayWarnings(result.warnings);
        setUploadWarnings(displayWarnings);
      }
      if (result?.import?.stderr) {
        setUploadError(`Import error: ${result.import.stderr}`);
        setChecks((prev) => prev.map((c) => (c.status === "uploading" ? { ...c, status: "error" } : c)));
        return;
      }
      setChecks((prev) =>
        prev.map((c) =>
          c.status === "uploading" ? { ...c, status: "uploaded", errors: undefined } : c
        )
      );
      setUploadSuccess("Files uploaded and imported.");
      setUploadError(null);
      refreshCoverage();
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setChecks((prev) => prev.map((c) => (c.status === "uploading" ? { ...c, status: "error" } : c)));
      setUploadError("Upload failed. Check the POS backend and try again.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-base">
        <div className="flex items-center gap-3 mb-4">
          <UploadCloud className="text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Update Database</h2>
            <p className="text-base text-slate-500">
              Upload monthly or weekly exports here. Use matching file pairs like{" "}
              <span className="font-semibold">sales_report#.xls</span> +{" "}
              <span className="font-semibold">topitems_report#.xls</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-base font-medium cursor-pointer hover:bg-slate-800">
            <FileSpreadsheet size={16} />
            Choose Files
            <input
              type="file"
              accept=".xls,.xlsx"
              multiple
              className="hidden"
              onChange={onFileChange}
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!validChecks.length || checks.some((c) => c.status === "uploading")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-base font-medium disabled:opacity-50"
          >
            <UploadCloud size={16} />
            Upload to Backend
          </button>
          {uploadSuccess && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <CheckCircle size={14} />
              {uploadSuccess}
            </span>
          )}
          {uploadError && (
            <span className="text-sm text-red-600 font-medium flex items-center gap-1">
              <AlertTriangle size={14} />
              {uploadError}
            </span>
          )}
          {uploadWarnings.length > 0 && (
            <span className="text-sm text-amber-700 font-medium flex items-center gap-1">
              <AlertTriangle size={14} />
              {uploadWarnings.join(" ")}
            </span>
          )}
        </div>

        {checks.length > 0 && (
          <div className="mt-4 space-y-2 text-base">
            {checks.map((c) => (
              <div key={c.file.name} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 gap-4">
                <div>
                  <div className="font-medium text-slate-800">{c.file.name}</div>
                  <div className="text-sm text-slate-500">
                    {c.typeLabel || "Unrecognized export"} · {(c.file.size / 1024).toFixed(1)} KB
                  </div>
                  {c.errors?.length && (c.status === "invalid" || c.status === "error") ? (
                    <div className="text-sm text-red-600 mt-1">{c.errors.join(" ")}</div>
                  ) : null}
                </div>
                <div className="text-sm font-semibold flex items-center gap-3">
                  {c.status === "ready" && <span className="text-emerald-600">Ready</span>}
                  {c.status === "invalid" && <span className="text-red-600">Invalid</span>}
                  {c.status === "uploading" && <span className="text-blue-600">Uploading</span>}
                  {c.status === "uploaded" && <span className="text-green-600">Uploaded</span>}
                  {c.status === "error" && <span className="text-red-600">Error</span>}
                  {c.status === "error" && (
                    <button
                      onClick={() => handleRetry(c.file.name)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasErrors && (
          <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Expected headers match the standard POS exports.
          </div>
        )}

        <div className="mt-4 text-sm text-slate-600">
          <div className="font-semibold text-slate-700 mb-1">Export Instructions</div>
          <div className="mt-2">
            <div className="font-semibold text-slate-700">Sales report</div>
            <div>Select all fields, including Light, Medium, and Heavy calculations.</div>
          </div>
          <div className="mt-3">
            <div className="font-semibold text-slate-700">Item report</div>
            <div>Manufacturer = All and Delivered = All for both exports.</div>
            <div>Let the report fully load before exporting.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateDatabase;
