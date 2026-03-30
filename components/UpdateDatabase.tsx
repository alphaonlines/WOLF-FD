import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle, AlertTriangle, UploadCloud, FileSpreadsheet, Building2 } from "lucide-react";
import { fetchCoverageMonths, uploadPosExports } from "../services/posBackendApi";
import ManufacturerPricelistPortal from "./ManufacturerPricelistPortal";

const UPLOAD_MANUFACTURERS = [
  "Vendor Price List",
  "Ashley",
  "Best",
  "England",
  "Jackson/Catnapper",
  "Liberty",
  "Vaughan-Bassett",
  "AAmerica",
  "Albany",
  "Archbold",
  "Innovations",
  "Other",
] as const;

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
  onOpenProductSearch?: () => void;
};

const UpdateDatabase: React.FC<UpdateDatabaseProps> = ({ onUploadComplete, onOpenProductSearch }) => {
  const [view, setView] = useState<"default" | "manufacturer_pricelist">("default");
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>("");
  const [checks, setChecks] = useState<FileCheck[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadLog, setUploadLog] = useState<string | null>(null);
  const [missingSalesMonths, setMissingSalesMonths] = useState<string[]>([]);
  const [missingItemMonths, setMissingItemMonths] = useState<string[]>([]);
  const [missingSalesDays, setMissingSalesDays] = useState<string[]>([]);
  const [missingItemDays, setMissingItemDays] = useState<string[]>([]);
  const [missingSalesDaysCount, setMissingSalesDaysCount] = useState<number>(0);
  const [missingItemDaysCount, setMissingItemDaysCount] = useState<number>(0);
  const [coverageStart, setCoverageStart] = useState<string | null>(null);
  const [coverageEnd, setCoverageEnd] = useState<string | null>(null);
  const [coverageView, setCoverageView] = useState<"days" | "months">("days");

  const validChecks = useMemo(() => checks.filter((c) => c.status === "ready"), [checks]);
  const hasErrors = checks.some((c) => c.status === "invalid" || c.status === "error");
  const salesGapList = coverageView === "days" ? missingSalesDays : missingSalesMonths;
  const itemGapList = coverageView === "days" ? missingItemDays : missingItemMonths;

  const isFilenameWarning = (msg: string) =>
    msg.includes("Unrecognized filename") ||
    msg.includes("Expected exactly 2 files per update") ||
    msg.includes("Expected both sales_report") ||
    msg.includes("Filename suffixes do not match");

  const filterDisplayWarnings = (warnings: string[]) =>
    warnings.filter((w) => !isFilenameWarning(w));

  const resetUploadState = () => {
    setUploadError(null);
    setUploadSuccess(null);
    setUploadWarnings([]);
    setUploadLog(null);
  };

  const applyUploadResult = (result: any) => {
    setUploadLog(JSON.stringify(result, null, 2));
    if (Array.isArray(result?.warnings) && result.warnings.length) {
      const displayWarnings = filterDisplayWarnings(result.warnings);
      setUploadWarnings(displayWarnings);
    }
    if (result?.import?.stderr) {
      setUploadError(`Import error: ${result.import.stderr}`);
      return false;
    }
    return true;
  };

  const finalizeSuccess = (message: string) => {
    setUploadSuccess(message);
    setUploadError(null);
    refreshCoverage();
    if (onUploadComplete) onUploadComplete();
  };

  const uploadSingleCheck = async (check: FileCheck): Promise<boolean> => {
    setFileStatus(check.file.name, "uploading");
    try {
      const result = await uploadPosExports([check.file], selectedManufacturer || undefined);
      if (!applyUploadResult(result)) {
        setFileStatus(check.file.name, "error");
        return false;
      }
      setFileStatus(check.file.name, "uploaded", true);
      return true;
    } catch {
      setFileStatus(check.file.name, "error");
      return false;
    }
  };

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
    resetUploadState();
  };

  const refreshCoverage = () => {
    fetchCoverageMonths()
      .then((data) => {
        setMissingSalesMonths(data.missingSalesMonths || []);
        setMissingItemMonths(data.missingItemMonths || []);
        setMissingSalesDays(data.missingSalesDays || []);
        setMissingItemDays(data.missingItemDays || []);
        setMissingSalesDaysCount(Number(data.missingSalesDaysCount || 0));
        setMissingItemDaysCount(Number(data.missingItemDaysCount || 0));
        setCoverageStart(data.startDate || null);
        setCoverageEnd(data.endDate || null);
      })
      .catch(() => {
        setMissingSalesMonths([]);
        setMissingItemMonths([]);
        setMissingSalesDays([]);
        setMissingItemDays([]);
        setMissingSalesDaysCount(0);
        setMissingItemDaysCount(0);
        setCoverageStart(null);
        setCoverageEnd(null);
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
    resetUploadState();
    const ok = await uploadSingleCheck(target);
    if (ok) {
      finalizeSuccess("File uploaded and imported.");
    } else {
      setUploadLog(
        JSON.stringify({ ok: false, error: "Upload failed. Check the POS backend and try again." }, null, 2)
      );
      setUploadError("Upload failed. Check the POS backend and try again.");
    }
  };

  const handleUpload = async () => {
    if (!validChecks.length) return;
    resetUploadState();
    setChecks((prev) => prev.map((c) => (c.status === "ready" ? { ...c, status: "uploading" } : c)));

    let bulkOk = false;
    try {
      const result = await uploadPosExports(validChecks.map((c) => c.file), selectedManufacturer || undefined);
      bulkOk = applyUploadResult(result);
      if (!bulkOk) {
        throw new Error("Bulk upload returned import errors");
      }
      setChecks((prev) =>
        prev.map((c) =>
          c.status === "uploading" ? { ...c, status: "uploaded", errors: undefined } : c
        )
      );
      finalizeSuccess("Files uploaded and imported.");
      return;
    } catch {
      setUploadError("Bulk upload failed. Retrying files one by one...");
    }

    let uploaded = 0;
    let failed = 0;
    for (const check of validChecks) {
      const ok = await uploadSingleCheck(check);
      if (ok) uploaded += 1;
      else failed += 1;
    }

    if (uploaded > 0 && failed === 0) {
      finalizeSuccess(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"} successfully.`);
    } else if (uploaded > 0) {
      setUploadSuccess(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}.`);
      setUploadError(`${failed} file${failed === 1 ? "" : "s"} still failed. Use Retry for those.`);
      refreshCoverage();
      if (onUploadComplete) onUploadComplete();
    } else if (!bulkOk) {
      setUploadLog(
        JSON.stringify({ ok: false, error: "Upload failed. Check the POS backend and try again." }, null, 2)
      );
      setUploadError("Upload failed. Check the POS backend and try again.");
      setChecks((prev) => prev.map((c) => (c.status === "uploading" ? { ...c, status: "error" } : c)));
    }
  };

  if (view === "manufacturer_pricelist") {
    return <ManufacturerPricelistPortal onBack={() => setView("default")} onOpenProductSearch={onOpenProductSearch} />;
  }

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

        {/* Step 1: Manufacturer picker */}
        <div className="mb-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">
              Step 1 — Select Manufacturer
            </span>
            {!selectedManufacturer && (
              <span className="text-xs text-amber-600 font-medium">Required before upload</span>
            )}
            {selectedManufacturer && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle size={12} /> {selectedManufacturer}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {UPLOAD_MANUFACTURERS.map((mfr) => (
              <button
                key={mfr}
                type="button"
                onClick={() => setSelectedManufacturer(mfr === selectedManufacturer ? "" : mfr)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  selectedManufacturer === mfr
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {mfr}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium ${
              selectedManufacturer
                ? "bg-slate-900 text-white cursor-pointer hover:bg-slate-800"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
          >
            <FileSpreadsheet size={16} />
            Choose Files
            <input
              type="file"
              accept=".xls,.xlsx"
              multiple
              className="hidden"
              disabled={!selectedManufacturer}
              onChange={onFileChange}
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!validChecks.length || checks.some((c) => c.status === "uploading") || !selectedManufacturer}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-base font-medium disabled:opacity-50"
          >
            <UploadCloud size={16} />
            Upload to Backend
          </button>
          <a
            href="https://furnituredistributors.wolf.discount/fd/manager-specials-upload.html"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-base font-medium hover:bg-slate-50"
          >
            <UploadCloud size={16} />
            Manager Specials Upload
          </a>
          <button
            type="button"
            onClick={() => setView("manufacturer_pricelist")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
            Update Manufacturer Pricelist
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

        {uploadLog && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-700 mb-2">Import Log</div>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
{uploadLog}
            </pre>
          </div>
        )}

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

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-base">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Coverage Gaps (Delivery Date)</h3>
            <p className="text-sm text-slate-500">
              {coverageStart && coverageEnd
                ? `Tracking ${coverageStart} to ${coverageEnd}.`
                : "Tracking mid-2024 to today."}
            </p>
          </div>
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
            <button
              className={`px-3 py-1 rounded-full ${coverageView === "days" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => setCoverageView("days")}
            >
              Days
            </button>
            <button
              className={`px-3 py-1 rounded-full ${coverageView === "months" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              onClick={() => setCoverageView("months")}
            >
              Months
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800">Sales Data</div>
              {coverageView === "days" ? (
                <div className="text-xs text-slate-500">
                  {missingSalesDaysCount} missing days
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {missingSalesMonths.length} missing months
                </div>
              )}
            </div>
            <div className="text-xs text-slate-600">Most recent gaps shown</div>
            <div className="mt-2 max-h-40 overflow-auto text-sm text-slate-700 space-y-1">
              {salesGapList.length ? (
                salesGapList.map((d) => <div key={d}>{d}</div>)
              ) : (
                <div className="text-emerald-600">No gaps detected.</div>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800">Item List</div>
              {coverageView === "days" ? (
                <div className="text-xs text-slate-500">
                  {missingItemDaysCount} missing days
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {missingItemMonths.length} missing months
                </div>
              )}
            </div>
            <div className="text-xs text-slate-600">Most recent gaps shown</div>
            <div className="mt-2 max-h-40 overflow-auto text-sm text-slate-700 space-y-1">
              {itemGapList.length ? (
                itemGapList.map((d) => <div key={d}>{d}</div>)
              ) : (
                <div className="text-emerald-600">No gaps detected.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateDatabase;
