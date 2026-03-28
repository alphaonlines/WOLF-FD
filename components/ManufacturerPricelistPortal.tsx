import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Search,
  UploadCloud,
} from "lucide-react";
import type { ManufacturerPricebookUpload } from "../types";
import {
  fetchManufacturerPricebookUploads,
  uploadManufacturerPricebookToHolding,
} from "../services/manufacturerPricelistApi";

type PortalScreen = "ingestion" | "validation" | "search";

type NormalizedProductRow = {
  id: string;
  manufacturer: string;
  category: string;
  productName: string;
  description: string;
  colorFinish: string;
  basePrice: string;
  sourceNote: string;
};

type ManufacturerTemplate = {
  summary: string;
  quirks: string[];
  rows: NormalizedProductRow[];
};

type ManufacturerPricelistPortalProps = {
  onBack: () => void;
};

const MANUFACTURERS = [
  "Ashley",
  "Albany",
  "AAmerica",
  "Archbold",
  "Best",
  "England",
  "Liberty",
  "Vaughan-Bassett",
];

const PORTAL_SCREENS: Array<{ key: PortalScreen; label: string }> = [
  { key: "ingestion", label: "Upload & Ingestion" },
  { key: "validation", label: "Validation & Correction" },
  { key: "search", label: "Global Search Catalog" },
];

const cloneRows = (rows: NormalizedProductRow[]) => rows.map((row) => ({ ...row }));

const MANUFACTURER_TEMPLATES: Record<string, ManufacturerTemplate> = {
  Ashley: {
    summary: "Ashley files often bundle base furniture with optional add-ons like storage footboards and roll-out slats.",
    quirks: [
      "Nested options can add cost to a base panel bed instead of appearing as standalone rows.",
      "Validation should confirm whether add-on pricing belongs on the parent SKU or as a separate item.",
    ],
    rows: [
      {
        id: "ashley-1",
        manufacturer: "Ashley",
        category: "Bedroom",
        productName: "B733-57 / B733-54",
        description: "Panel bed with optional storage footboard package",
        colorFinish: "Warm Brown",
        basePrice: "899.00",
        sourceNote: "Base bed listed separately from storage upgrade.",
      },
      {
        id: "ashley-2",
        manufacturer: "Ashley",
        category: "",
        productName: "B733-50",
        description: "Roll-out slat support kit",
        colorFinish: "",
        basePrice: "129.00",
        sourceNote: "Category missing from source price book.",
      },
      {
        id: "ashley-3",
        manufacturer: "Ashley",
        category: "Bedroom",
        productName: "",
        description: "Two-drawer nightstand",
        colorFinish: "Warm Brown",
        basePrice: "249.00",
        sourceNote: "Item number was unreadable in PDF export.",
      },
    ],
  },
  Albany: {
    summary: "Albany commonly separates TL and LTL pricing and includes cube details that matter for freight.",
    quirks: [
      "Truckload vs LTL costs may require choosing which value becomes the normalized base price.",
      "Cube dimensions should be preserved in source notes for operations.",
    ],
    rows: [
      {
        id: "albany-1",
        manufacturer: "Albany",
        category: "Stationary Upholstery",
        productName: "3820 Sofa",
        description: "Track arm sofa with reversible cushions",
        colorFinish: "Fabric Grade B",
        basePrice: "1125.00",
        sourceNote: "TL pricing selected from vendor book; LTL noted separately.",
      },
      {
        id: "albany-2",
        manufacturer: "Albany",
        category: "Stationary Upholstery",
        productName: "3821 Loveseat",
        description: "",
        colorFinish: "Fabric Grade B",
        basePrice: "995.00",
        sourceNote: "Description needs manual cleanup from abbreviated source row.",
      },
      {
        id: "albany-3",
        manufacturer: "Albany",
        category: "Accent",
        productName: "560 Chair",
        description: "Accent chair with exposed wood feet",
        colorFinish: "",
        basePrice: "",
        sourceNote: "Base cost missing because PDF only exposed TL / LTL matrix image.",
      },
    ],
  },
  AAmerica: {
    summary: "AAmerica books often use shorthand columns like EC WS, EC 12, and container pricing that require context.",
    quirks: [
      "Pricing columns may represent regional or container-specific costs rather than a single ready-to-publish cost.",
      "Validation should confirm which cost column becomes the standardized base price.",
    ],
    rows: [
      {
        id: "aamerica-1",
        manufacturer: "AAmerica",
        category: "Dining",
        productName: "BCO-SW-6-42-0",
        description: "Counter height dining table",
        colorFinish: "Barnwood Oak",
        basePrice: "679.00",
        sourceNote: "EC WS selected as normalized price.",
      },
      {
        id: "aamerica-2",
        manufacturer: "AAmerica",
        category: "Dining",
        productName: "BCO-SC-265-K",
        description: "Counter stool, set of 2",
        colorFinish: "",
        basePrice: "349.00",
        sourceNote: "Finish code needs confirmation from secondary sheet.",
      },
      {
        id: "aamerica-3",
        manufacturer: "AAmerica",
        category: "",
        productName: "BCO-BUF-SRV",
        description: "Server with wine storage",
        colorFinish: "Barnwood Oak",
        basePrice: "",
        sourceNote: "Container pricing extracted but normalized base price not chosen yet.",
      },
    ],
  },
  Archbold: {
    summary: "Archbold base SKUs often require adding color and hardware option codes to form the final sellable item number.",
    quirks: [
      "The validation screen needs to preserve the base item while also confirming option-code expansion.",
      "Color and hardware data can be mandatory to build the final SKU correctly.",
    ],
    rows: [
      {
        id: "archbold-1",
        manufacturer: "Archbold",
        category: "Bedroom",
        productName: "2401",
        description: "6-drawer dresser base item",
        colorFinish: "",
        basePrice: "799.00",
        sourceNote: "Needs stain and hardware option codes appended to complete SKU.",
      },
      {
        id: "archbold-2",
        manufacturer: "Archbold",
        category: "Bedroom",
        productName: "2402",
        description: "Landscape mirror",
        colorFinish: "Brown Maple",
        basePrice: "219.00",
        sourceNote: "Finish pulled from companion finish matrix.",
      },
      {
        id: "archbold-3",
        manufacturer: "Archbold",
        category: "Bedroom",
        productName: "",
        description: "3-drawer nightstand base item",
        colorFinish: "",
        basePrice: "429.00",
        sourceNote: "Base item number missing from OCR extraction.",
      },
    ],
  },
  England: {
    summary: "England upholstery price books use model and fabric-grade matrices, sometimes with Diamond Pricing overlays.",
    quirks: [
      "The normalized base price should only be saved after selecting the correct fabric grade.",
      "Diamond pricing may override the standard grade matrix and should be captured in source notes.",
    ],
    rows: [
      {
        id: "england-1",
        manufacturer: "England",
        category: "Motion Upholstery",
        productName: "3R00-62",
        description: "Power reclining sofa",
        colorFinish: "Fabric Grade C",
        basePrice: "1599.00",
        sourceNote: "Standard grade matrix applied.",
      },
      {
        id: "england-2",
        manufacturer: "England",
        category: "Motion Upholstery",
        productName: "3R00-39",
        description: "Power reclining loveseat",
        colorFinish: "",
        basePrice: "",
        sourceNote: "Fabric grade and diamond override missing from extraction.",
      },
      {
        id: "england-3",
        manufacturer: "England",
        category: "Accent",
        productName: "4100-69",
        description: "Swivel glider chair",
        colorFinish: "Leather/Vinyl Grade A",
        basePrice: "899.00",
        sourceNote: "Leather grade normalized from matrix image.",
      },
    ],
  },
  Best: {
    summary: "Best frequently mixes motion, stationary, and upgrade options across one workbook.",
    quirks: [
      "Validation should preserve upgrade notes while surfacing the publishable base cost.",
      "Item descriptions may need cleanup when copied from combined option rows.",
    ],
    rows: [
      {
        id: "best-1",
        manufacturer: "Best",
        category: "Motion Upholstery",
        productName: "9M37",
        description: "Space saver recliner",
        colorFinish: "Fabric Grade A",
        basePrice: "749.00",
        sourceNote: "Base manual recliner price captured.",
      },
      {
        id: "best-2",
        manufacturer: "Best",
        category: "",
        productName: "9M37P",
        description: "Power recliner upgrade",
        colorFinish: "Fabric Grade A",
        basePrice: "929.00",
        sourceNote: "Needs category confirmation from product family mapping.",
      },
      {
        id: "best-3",
        manufacturer: "Best",
        category: "Motion Upholstery",
        productName: "9M37",
        description: "",
        colorFinish: "Leather Grade L",
        basePrice: "1149.00",
        sourceNote: "Description collapsed in OCR pass.",
      },
    ],
  },
  Liberty: {
    summary: "Liberty often includes broad dining and bedroom books with multiple collections on the same worksheet.",
    quirks: [
      "Category cleanup can be needed when one sheet mixes dining, occasional, and bedroom sets.",
      "Collection headings may need to be folded into the description manually.",
    ],
    rows: [
      {
        id: "liberty-1",
        manufacturer: "Liberty",
        category: "Dining",
        productName: "244-T4290",
        description: "Trestle dining table",
        colorFinish: "Weathered Bisque",
        basePrice: "899.00",
        sourceNote: "Collection header mapped into description.",
      },
      {
        id: "liberty-2",
        manufacturer: "Liberty",
        category: "Dining",
        productName: "244-C6501S",
        description: "Upholstered dining chair, set of 2",
        colorFinish: "",
        basePrice: "379.00",
        sourceNote: "Finish optional; source grouped under collection heading.",
      },
      {
        id: "liberty-3",
        manufacturer: "Liberty",
        category: "",
        productName: "244-HO107",
        description: "Credenza with hutch top",
        colorFinish: "Weathered Bisque",
        basePrice: "",
        sourceNote: "Price broken across two PDF columns.",
      },
    ],
  },
  "Vaughan-Bassett": {
    summary: "Vaughan-Bassett casegoods tend to be more structured, but finish expansion still matters for searchable output.",
    quirks: [
      "Validation should confirm collection finish because the same item can exist in multiple finishes.",
      "Base item numbers are usually stable, which makes them a good normalization anchor.",
    ],
    rows: [
      {
        id: "vb-1",
        manufacturer: "Vaughan-Bassett",
        category: "Bedroom",
        productName: "BB29-002",
        description: "Queen panel headboard",
        colorFinish: "Misty Gray",
        basePrice: "329.00",
        sourceNote: "Base cost extracted cleanly from workbook.",
      },
      {
        id: "vb-2",
        manufacturer: "Vaughan-Bassett",
        category: "Bedroom",
        productName: "BB29-115",
        description: "5-drawer chest",
        colorFinish: "Misty Gray",
        basePrice: "849.00",
        sourceNote: "Ready for publishing.",
      },
      {
        id: "vb-3",
        manufacturer: "Vaughan-Bassett",
        category: "Bedroom",
        productName: "BB29-226",
        description: "",
        colorFinish: "",
        basePrice: "479.00",
        sourceNote: "Description and finish missing after OCR pass.",
      },
    ],
  },
};

const requiredFieldLabels: Array<keyof Pick<
  NormalizedProductRow,
  "manufacturer" | "category" | "productName" | "description" | "basePrice"
>> = ["manufacturer", "category", "productName", "description", "basePrice"];

const getMissingFields = (row: NormalizedProductRow) =>
  requiredFieldLabels.filter((field) => !String(row[field] || "").trim());

const formatFieldLabel = (field: string) => {
  switch (field) {
    case "productName":
      return "Item #";
    case "basePrice":
      return "Base Price";
    default:
      return field.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
  }
};

const ManufacturerPricelistPortal: React.FC<ManufacturerPricelistPortalProps> = ({ onBack }) => {
  const [activeScreen, setActiveScreen] = useState<PortalScreen>("ingestion");
  const [selectedManufacturer, setSelectedManufacturer] = useState("Ashley");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [ingestionStage, setIngestionStage] = useState<"idle" | "ready" | "extracting" | "review">("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [rows, setRows] = useState<NormalizedProductRow[]>(cloneRows(MANUFACTURER_TEMPLATES.Ashley.rows));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchManufacturerFilter, setSearchManufacturerFilter] = useState("All Manufacturers");
  const [searchCategoryFilter, setSearchCategoryFilter] = useState("All Categories");
  const [searchColorFilter, setSearchColorFilter] = useState("All Colors");
  const [replaceExistingOnPublish, setReplaceExistingOnPublish] = useState(true);
  const [holdingUploads, setHoldingUploads] = useState<ManufacturerPricebookUpload[]>([]);
  const [holdingBusy, setHoldingBusy] = useState(false);
  const [holdingMessage, setHoldingMessage] = useState<string | null>(null);
  const [holdingError, setHoldingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const template = MANUFACTURER_TEMPLATES[selectedManufacturer] || MANUFACTURER_TEMPLATES.Ashley;
  const flaggedRows = useMemo(
    () =>
      rows
        .map((row) => ({ row, missingFields: getMissingFields(row) }))
        .filter((entry) => entry.missingFields.length > 0),
    [rows]
  );
  const readyRowsCount = rows.length - flaggedRows.length;

  useEffect(() => {
    if (ingestionStage !== "extracting") return undefined;

    setExtractionProgress(12);
    const timer = window.setInterval(() => {
      setExtractionProgress((current) => {
        const next = Math.min(current + 17, 100);
        if (next >= 100) {
          window.clearInterval(timer);
          setRows(cloneRows(template.rows));
          setIngestionStage("review");
          setActiveScreen("validation");
          setValidationMessage(`${selectedManufacturer} extraction is ready for validation review.`);
        }
        return next;
      });
    }, 140);

    return () => window.clearInterval(timer);
  }, [ingestionStage, selectedManufacturer, template.rows]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const uploads = await fetchManufacturerPricebookUploads(selectedManufacturer);
        if (!cancelled) setHoldingUploads(uploads);
      } catch (error: any) {
        if (!cancelled) {
          setHoldingUploads([]);
          setHoldingError(String(error?.message || error || "Failed to load holding uploads"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedManufacturer]);

  const searchCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(rows.map((row) => row.category.trim()).filter(Boolean))).sort();
    return ["All Categories", ...categories];
  }, [rows]);

  const searchColorOptions = useMemo(() => {
    const colors = Array.from(new Set(rows.map((row) => row.colorFinish.trim()).filter(Boolean))).sort();
    return ["All Colors", ...colors];
  }, [rows]);

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (searchManufacturerFilter !== "All Manufacturers" && row.manufacturer !== searchManufacturerFilter) return false;
      if (searchCategoryFilter !== "All Categories" && row.category !== searchCategoryFilter) return false;
      if (searchColorFilter !== "All Colors" && row.colorFinish !== searchColorFilter) return false;
      if (!query) return true;
      const haystack = [row.productName, row.description, row.colorFinish, row.manufacturer].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, searchManufacturerFilter, searchCategoryFilter, searchColorFilter, searchTerm]);

  const onFilePicked = (file: File | null) => {
    setSelectedFile(file);
    setIngestionStage(file ? "ready" : "idle");
    setExtractionProgress(0);
    setValidationMessage(null);
    setHoldingMessage(null);
    setHoldingError(null);
  };

  const startExtraction = () => {
    if (!selectedFile) return;
    setValidationMessage(null);
    setPublishedAt(null);
    setIngestionStage("extracting");
    setExtractionProgress(0);
  };

  const updateRow = (rowId: string, field: keyof NormalizedProductRow, value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
    setValidationMessage(null);
    setPublishedAt(null);
  };

  const saveAndPublish = () => {
    if (flaggedRows.length > 0) {
      setValidationMessage("Resolve all highlighted required fields before publishing to the master database.");
      return;
    }
    setPublishedAt(new Date().toLocaleString());
    setValidationMessage("Validation passed. This manufacturer price book is ready to publish into the normalized catalog.");
    setActiveScreen("search");
  };

  const resetExtraction = () => {
    setRows(cloneRows(template.rows));
    setValidationMessage("Validation rows were reset to the latest extracted state.");
    setPublishedAt(null);
  };

  const refreshHoldingUploads = async (manufacturer: string) => {
    const uploads = await fetchManufacturerPricebookUploads(manufacturer);
    setHoldingUploads(uploads);
  };

  const uploadToHolding = async () => {
    if (!selectedFile) return;
    setHoldingBusy(true);
    setHoldingMessage(null);
    setHoldingError(null);
    try {
      const row = await uploadManufacturerPricebookToHolding({
        manufacturer: selectedManufacturer,
        file: selectedFile,
        replaceExisting: replaceExistingOnPublish,
      });
      await refreshHoldingUploads(selectedManufacturer);
      setHoldingMessage(
        `${row.originalName} uploaded to holding for ${selectedManufacturer}. Stored at ${row.relativePath}.`
      );
    } catch (error: any) {
      setHoldingError(String(error?.message || error || "Failed to upload file to holding"));
    } finally {
      setHoldingBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
              <Database size={14} />
              Manufacturer Price Book Portal
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Vendor ingestion and search workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload inconsistent vendor books, validate the normalized rows, and prepare a clean searchable catalog
              for staff. This workspace is intentionally built around manufacturer-specific review.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Update Database
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{selectedManufacturer} ingestion brief</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{template.summary}</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {template.quirks.map((quirk) => (
                <div key={quirk} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  {quirk}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rows</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</div>
              <div className="mt-1 text-sm text-slate-500">Extracted normalized rows</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Flagged</div>
              <div className="mt-2 text-2xl font-semibold text-amber-900">{flaggedRows.length}</div>
              <div className="mt-1 text-sm text-amber-700">Need manual review before publish</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Ready</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">{readyRowsCount}</div>
              <div className="mt-1 text-sm text-emerald-700">Rows with required fields complete</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {PORTAL_SCREENS.map((screen) => (
            <button
              key={screen.key}
              type="button"
              onClick={() => setActiveScreen(screen.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeScreen === screen.key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </div>

      {activeScreen === "ingestion" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <UploadCloud className="text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Upload & Ingestion Dashboard</h3>
                <p className="text-sm text-slate-500">
                  Pick the manufacturer first so the backend can apply the correct extraction logic.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Select Manufacturer
                </label>
                <select
                  value={selectedManufacturer}
                  onChange={(event) => {
                    setSelectedManufacturer(event.target.value);
                    setRows(cloneRows((MANUFACTURER_TEMPLATES[event.target.value] || template).rows));
                    setValidationMessage(null);
                    setPublishedAt(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  {MANUFACTURERS.map((manufacturer) => (
                    <option key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xls,.xlsx,.csv"
                  className="hidden"
                  onChange={(event) => onFilePicked(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                    onFilePicked(event.dataTransfer.files?.[0] || null);
                  }}
                  className={`flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
                    dragActive
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <FileSpreadsheet className="text-slate-500" />
                  <div className="mt-4 text-base font-semibold text-slate-800">
                    Drag and drop a price book or click to browse
                  </div>
                  <div className="mt-2 text-sm text-slate-500">Accepted formats: PDF, Excel, CSV</div>
                  {selectedFile && (
                    <div className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                      {selectedFile.name}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!selectedFile || holdingBusy}
                onClick={() => void uploadToHolding()}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {holdingBusy ? "Uploading..." : "Upload to Holding Folder"}
              </button>
              <button
                type="button"
                disabled={!selectedFile || ingestionStage === "extracting"}
                onClick={startExtraction}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {ingestionStage === "extracting" ? "Extracting..." : "Start Extraction"}
              </button>
              <div className="text-sm text-slate-500">
                {ingestionStage === "idle" && "Select a manufacturer and upload a file to begin."}
                {ingestionStage === "ready" && "File queued. Start extraction when you are ready."}
                {ingestionStage === "review" &&
                  `${selectedManufacturer} extraction is loaded. Review flagged rows before publishing.`}
              </div>
            </div>

            {holdingMessage && (
              <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {holdingMessage}
              </div>
            )}
            {holdingError && (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{holdingError}</div>
            )}

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Extraction status</div>
                  <div className="text-sm text-slate-500">
                    {ingestionStage === "extracting"
                      ? `Running ${selectedManufacturer} extraction profile`
                      : ingestionStage === "review"
                        ? "Ready for validation review"
                        : "Waiting for upload"}
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-700">{extractionProgress}%</div>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${Math.max(extractionProgress, ingestionStage === "review" ? 100 : 6)}%` }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={replaceExistingOnPublish}
                  onChange={(event) => setReplaceExistingOnPublish(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Replace existing {selectedManufacturer} catalog rows on publish
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    The intended publish flow is manufacturer-scoped: clear old normalized rows for this vendor, then
                    insert the newly validated set so stale pricing never lingers.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Normalization target</h4>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                "Manufacturer",
                "Category",
                "Product Name / Item #",
                "Description",
                "Color / Finish",
                "Base Price / Cost",
              ].map((field) => (
                <div key={field} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {field}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Blank required fields should never be publishable. Missing data stays highlighted until staff correct it.
            </div>
            <div className="mt-5">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Holding uploads</h4>
              <div className="mt-3 space-y-2">
                {holdingUploads.length ? (
                  holdingUploads.slice(0, 6).map((upload) => (
                    <div key={upload.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{upload.originalName}</div>
                      <div className="mt-1 text-xs text-slate-500">{upload.relativePath}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>{(upload.fileSizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                        <span>•</span>
                        <span>{upload.status}</span>
                        <span>•</span>
                        <span>{upload.createdAt ? new Date(upload.createdAt).toLocaleString() : "Just now"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No holding uploads for {selectedManufacturer} yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeScreen === "validation" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Data Validation & Correction</h3>
                <p className="text-sm text-slate-500">
                  Missing required values are highlighted so staff can correct them inline before publishing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetExtraction}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Extraction
                </button>
                <button
                  type="button"
                  onClick={saveAndPublish}
                  disabled={flaggedRows.length > 0}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save & Publish to Database
                </button>
              </div>
            </div>

            {validationMessage && (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  flaggedRows.length > 0
                    ? "bg-amber-50 text-amber-800"
                    : "bg-emerald-50 text-emerald-800"
                }`}
              >
                {validationMessage}
              </div>
            )}

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Rows loaded</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Flagged rows</div>
                <div className="mt-2 text-2xl font-semibold text-amber-900">{flaggedRows.length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Publish status</div>
                <div className="mt-2 text-sm font-semibold text-emerald-900">
                  {publishedAt ? `Published ${publishedAt}` : flaggedRows.length ? "Blocked until clean" : "Ready to publish"}
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-[1180px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Manufacturer</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Product / Item #</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Color / Finish</th>
                    <th className="px-4 py-3">Base Price</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3">Source Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rows.map((row) => {
                    const missingFields = getMissingFields(row);
                    const isMissing = (field: keyof NormalizedProductRow) => missingFields.includes(field as any);
                    const cellClass = (field: keyof NormalizedProductRow) =>
                      `w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                        isMissing(field)
                          ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                          : "border-slate-200 bg-white text-slate-700 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      }`;

                    return (
                      <tr key={row.id} className={missingFields.length ? "bg-amber-50/40" : ""}>
                        <td className="px-4 py-3">
                          <input
                            value={row.manufacturer}
                            onChange={(event) => updateRow(row.id, "manufacturer", event.target.value)}
                            className={cellClass("manufacturer")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={row.category}
                            onChange={(event) => updateRow(row.id, "category", event.target.value)}
                            className={cellClass("category")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={row.productName}
                            onChange={(event) => updateRow(row.id, "productName", event.target.value)}
                            className={cellClass("productName")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={row.description}
                            onChange={(event) => updateRow(row.id, "description", event.target.value)}
                            className={cellClass("description")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={row.colorFinish}
                            onChange={(event) => updateRow(row.id, "colorFinish", event.target.value)}
                            className={cellClass("colorFinish")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={row.basePrice}
                            onChange={(event) => updateRow(row.id, "basePrice", event.target.value)}
                            className={cellClass("basePrice")}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {missingFields.length ? (
                            <div className="space-y-1">
                              {missingFields.map((field) => (
                                <div
                                  key={field}
                                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800"
                                >
                                  <AlertTriangle size={12} />
                                  Missing {formatFieldLabel(field)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 size={12} />
                              Ready
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            value={row.sourceNote}
                            onChange={(event) => updateRow(row.id, "sourceNote", event.target.value)}
                            className="min-h-[78px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeScreen === "search" && (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Search className="text-slate-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Global Product Search Catalog</h3>
                <p className="text-sm text-slate-500">Search normalized products by item number, description, or finish.</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Search</label>
                <div className="relative mt-2">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Description or product name"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Manufacturer</label>
                <select
                  value={searchManufacturerFilter}
                  onChange={(event) => setSearchManufacturerFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  {["All Manufacturers", ...MANUFACTURERS].map((manufacturer) => (
                    <option key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Category</label>
                <select
                  value={searchCategoryFilter}
                  onChange={(event) => setSearchCategoryFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  {searchCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Color / Finish</label>
                <select
                  value={searchColorFilter}
                  onChange={(event) => setSearchColorFilter(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  {searchColorOptions.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                This catalog is designed for fast staff lookup once each manufacturer book has been normalized.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{searchResults.length} matching products</div>
                <div className="text-sm text-slate-500">
                  Search is centered on description and product name, with manufacturer and finish filters alongside it.
                </div>
              </div>
              {publishedAt && (
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Last published {publishedAt}
                </div>
              )}
            </div>

            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-[860px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Manufacturer</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Product / Item #</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Color / Finish</th>
                    <th className="px-4 py-3">Base Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {searchResults.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.manufacturer || "Unassigned"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.category || "Needs review"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.productName || "Needs review"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.description || "Needs review"}</td>
                      <td className="px-4 py-3 text-slate-600">{row.colorFinish || "Optional"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.basePrice || "Needs review"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerPricelistPortal;
