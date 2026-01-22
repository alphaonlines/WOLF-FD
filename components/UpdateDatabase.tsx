import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle, AlertTriangle, UploadCloud, FileSpreadsheet } from "lucide-react";
import { uploadPosExports } from "../services/posBackendApi";

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

const UpdateDatabase: React.FC = () => {
  const [checks, setChecks] = useState<FileCheck[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const validChecks = useMemo(() => checks.filter((c) => c.status === "ready"), [checks]);
  const hasErrors = checks.some((c) => c.status === "invalid" || c.status === "error");

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
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    runValidation(files);
  };

  const handleUpload = async () => {
    if (!validChecks.length) return;
    setUploadError(null);
    setUploadSuccess(null);
    setChecks((prev) => prev.map((c) => (c.status === "ready" ? { ...c, status: "uploading" } : c)));
    try {
      await uploadPosExports(validChecks.map((c) => c.file));
      setChecks((prev) => prev.map((c) => (c.status === "uploading" ? { ...c, status: "uploaded" } : c)));
      setUploadSuccess("Files uploaded. Run the importer to update the database.");
    } catch (err) {
      setChecks((prev) => prev.map((c) => (c.status === "uploading" ? { ...c, status: "error" } : c)));
      setUploadError("Upload failed. Check the POS backend and try again.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <UploadCloud className="text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Update Database</h2>
            <p className="text-sm text-slate-500">
              Upload monthly or weekly exports. We validate headers before saving the files.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-800">
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <UploadCloud size={16} />
            Upload to Backend
          </button>
          {uploadSuccess && (
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle size={14} />
              {uploadSuccess}
            </span>
          )}
          {uploadError && (
            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertTriangle size={14} />
              {uploadError}
            </span>
          )}
        </div>

        {checks.length > 0 && (
          <div className="mt-4 space-y-2 text-sm">
            {checks.map((c) => (
              <div key={c.file.name} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div>
                  <div className="font-medium text-slate-800">{c.file.name}</div>
                  <div className="text-xs text-slate-500">
                    {c.typeLabel || "Unrecognized export"} · {(c.file.size / 1024).toFixed(1)} KB
                  </div>
                  {c.errors?.length ? (
                    <div className="text-xs text-red-600 mt-1">{c.errors.join(" ")}</div>
                  ) : null}
                </div>
                <div className="text-xs font-semibold">
                  {c.status === "ready" && <span className="text-emerald-600">Ready</span>}
                  {c.status === "invalid" && <span className="text-red-600">Invalid</span>}
                  {c.status === "uploading" && <span className="text-blue-600">Uploading</span>}
                  {c.status === "uploaded" && <span className="text-green-600">Uploaded</span>}
                  {c.status === "error" && <span className="text-red-600">Error</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasErrors && (
          <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Expected headers match the standard POS exports. If a file fails, re-export with headers enabled.
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800 mb-2">What Gets Updated</h3>
        <ul className="text-sm text-slate-600 space-y-2">
          <li>Sales report exports update the core sale headers (sale totals, status, dates, customer fields).</li>
          <li>Items exports update line-item analytics (best sellers, category revenue, manufacturer performance).</li>
          <li>Pro1st items are flagged for attach-rate tracking and highlighted in the dashboard.</li>
        </ul>
      </div>
    </div>
  );
};

export default UpdateDatabase;
