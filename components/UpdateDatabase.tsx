import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle, AlertTriangle, UploadCloud, FileSpreadsheet, Tag, Database } from "lucide-react";
import { fetchCoverageMonths, uploadPosExports } from "../services/posBackendApi";
import ManufacturerPricelistPortal from "./ManufacturerPricelistPortal";

type FileCheckStatus = "ready" | "invalid" | "uploading" | "uploaded" | "error";
type UpdateSection = "pos_reports" | "manager_specials" | "manufacturer_pricelist";

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

type CoverageMonthGap = {
  month: string;
  missingDays: number;
};

const UpdateDatabase: React.FC<UpdateDatabaseProps> = ({ onUploadComplete, onOpenProductSearch }) => {
  const [activeSection, setActiveSection] = useState<UpdateSection>("pos_reports");
  const [checks, setChecks] = useState<FileCheck[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [uploadLog, setUploadLog] = useState<string | null>(null);
  const [missingSalesMonths, setMissingSalesMonths] = useState<string[]>([]);
  const [missingItemMonths, setMissingItemMonths] = useState<string[]>([]);
  const [missingSalesMonthDetails, setMissingSalesMonthDetails] = useState<CoverageMonthGap[]>([]);
  const [missingItemMonthDetails, setMissingItemMonthDetails] = useState<CoverageMonthGap[]>([]);
  const [missingSalesDays, setMissingSalesDays] = useState<string[]>([]);
  const [missingItemDays, setMissingItemDays] = useState<string[]>([]);
  const [missingSalesDaysCount, setMissingSalesDaysCount] = useState<number>(0);
  const [missingItemDaysCount, setMissingItemDaysCount] = useState<number>(0);
  const [coverageStart, setCoverageStart] = useState<string | null>(null);
  const [coverageEnd, setCoverageEnd] = useState<string | null>(null);
  const [coverageView, setCoverageView] = useState<"days" | "months">("days");

  const validChecks = useMemo(() => checks.filter((c) => c.status === "ready"), [checks]);
  const hasErrors = checks.some((c) => c.status === "invalid" || c.status === "error");
  const salesMonthGaps = missingSalesMonthDetails.length
    ? missingSalesMonthDetails
    : missingSalesMonths.map((month) => ({ month, missingDays: 0 }));
  const itemMonthGaps = missingItemMonthDetails.length
    ? missingItemMonthDetails
    : missingItemMonths.map((month) => ({ month, missingDays: 0 }));
  const salesGapCount = coverageView === "days" ? missingSalesDaysCount : salesMonthGaps.length;
  const itemGapCount = coverageView === "days" ? missingItemDaysCount : itemMonthGaps.length;

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
      const result = await uploadPosExports([check.file]);
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
        setMissingSalesMonthDetails(data.missingSalesMonthDetails || []);
        setMissingItemMonthDetails(data.missingItemMonthDetails || []);
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
        setMissingSalesMonthDetails([]);
        setMissingItemMonthDetails([]);
        setMissingSalesDays([]);
        setMissingItemDays([]);
        setMissingSalesDaysCount(0);
        setMissingItemDaysCount(0);
        setCoverageStart(null);
        setCoverageEnd(null);
      });
  };

  const renderGapList = (kind: "sales" | "items") => {
    const dayGaps = kind === "sales" ? missingSalesDays : missingItemDays;
    const monthGaps = kind === "sales" ? salesMonthGaps : itemMonthGaps;

    if (coverageView === "days") {
      return dayGaps.length ? (
        dayGaps.map((day) => <div key={day}>{day}</div>)
      ) : (
        <div className="text-emerald-600">No gaps detected.</div>
      );
    }

    return monthGaps.length ? (
      monthGaps.map((gap) => (
        <div key={gap.month} className="flex items-center justify-between gap-3">
          <span>{gap.month}</span>
          {gap.missingDays > 0 && (
            <span className="text-xs font-medium text-slate-500">
              {gap.missingDays} missing day{gap.missingDays === 1 ? "" : "s"}
            </span>
          )}
        </div>
      ))
    ) : (
      <div className="text-emerald-600">No gaps detected.</div>
    );
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
      const result = await uploadPosExports(validChecks.map((c) => c.file));
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

  const updateSections: Array<{
    key: UpdateSection;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      key: "pos_reports",
      title: "Sales + Item Reports",
      subtitle: "Paired POS exports for a date range",
      icon: <Database size={18} />,
    },
    {
      key: "manager_specials",
      title: "Manager Specials",
      subtitle: "Specials upload page",
      icon: <Tag size={18} />,
    },
    {
      key: "manufacturer_pricelist",
      title: "Manufacturer Price Lists",
      subtitle: "Vendor catalog and price books",
      icon: <FileSpreadsheet size={18} />,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-base">
        <div className="flex items-center gap-3 mb-4">
          <UploadCloud className="text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Update Database</h2>
            <p className="text-base text-slate-500">
              Choose the database area first so POS reports, specials, and manufacturer catalogs stay separated.
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-3">
          {updateSections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setActiveSection(section.key);
                resetUploadState();
              }}
              className={`flex min-h-[88px] items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                activeSection === section.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span
                className={`mt-0.5 rounded-lg p-2 ${
                  activeSection === section.key ? "bg-white/12 text-white" : "bg-white text-slate-500"
                }`}
              >
                {section.icon}
              </span>
              <span>
                <span className="block text-sm font-bold">{section.title}</span>
                <span className={`mt-1 block text-xs ${activeSection === section.key ? "text-slate-200" : "text-slate-500"}`}>
                  {section.subtitle}
                </span>
              </span>
            </button>
          ))}
        </div>

        {activeSection === "manufacturer_pricelist" && (
          <ManufacturerPricelistPortal onBack={() => setActiveSection("pos_reports")} onOpenProductSearch={onOpenProductSearch} />
        )}

        {activeSection === "manager_specials" && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-800">Manager Specials</div>
            <p className="mt-1 text-sm text-slate-600">
              Use this for manager-special pricing sheets only. This does not update POS sales history, item sales history,
              or manufacturer catalog price books.
            </p>
            <a
              href="https://furnituredistributors.wolf.discount/fd/manager-specials-upload.html"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              <UploadCloud size={16} />
              Open Manager Specials Upload
            </a>
          </div>
        )}

        {activeSection === "pos_reports" && (
          <>
            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
              <div className="font-semibold">Sales + Item Reports</div>
              <div className="mt-1">
                Upload the matching POS export pair for the same date range:{" "}
                <span className="font-semibold">sales_report#.xls</span> and{" "}
                <span className="font-semibold">topitems_report#.xls</span>. Manufacturer selection is not used here.
              </div>
            </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <label
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-base font-medium text-white hover:bg-slate-800"
          >
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
          </>
        )}
      </div>

      {activeSection === "pos_reports" && (
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-base">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Coverage Gaps (Delivery Date)</h3>
            <p className="text-sm text-slate-500">
              {coverageStart && coverageEnd
                ? `Tracking delivery-confirmed dates from ${coverageStart} to ${coverageEnd}.`
                : "Tracking delivery-confirmed dates from mid-2024 to today."}
              {" "}Uploaded date ranges count as covered, even when a day had zero rows.
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
              <div className="text-xs text-slate-500">
                {salesGapCount} missing {coverageView === "days" ? "days" : "months"}
              </div>
            </div>
            <div className="text-xs text-slate-600">
              {coverageView === "days" ? "Most recent missing delivery dates shown" : "Months with at least one missing delivery date"}
            </div>
            <div className="mt-2 max-h-40 overflow-auto text-sm text-slate-700 space-y-1">
              {renderGapList("sales")}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800">Item List</div>
              <div className="text-xs text-slate-500">
                {itemGapCount} missing {coverageView === "days" ? "days" : "months"}
              </div>
            </div>
            <div className="text-xs text-slate-600">
              {coverageView === "days" ? "Most recent missing delivery dates shown" : "Months with at least one missing delivery date"}
            </div>
            <div className="mt-2 max-h-40 overflow-auto text-sm text-slate-700 space-y-1">
              {renderGapList("items")}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default UpdateDatabase;
