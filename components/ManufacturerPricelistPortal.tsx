import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  UploadCloud,
} from "lucide-react";
import { CANONICAL_PRODUCT_MANUFACTURERS } from "../constants/productCatalog";
import type {
  ManufacturerCatalogItem,
  ManufacturerPricebookUpload,
  ManufacturerReferenceNote,
} from "../types";
import {
  fetchManufacturerPricebookUploads,
  fetchManufacturerReferenceNotes,
  previewManufacturerPricebookUpload,
  publishManufacturerPricebookUpload,
  uploadManufacturerPricebookToHolding,
} from "../services/manufacturerPricelistApi";

type PortalScreen = "ingestion" | "validation";
type ValidationSort =
  | "flagged"
  | "source"
  | "manufacturer"
  | "category"
  | "product"
  | "description"
  | "price_low"
  | "price_high";

type NormalizedProductRow = {
  id: string;
  manufacturer: string;
  manufacturerSlug?: string;
  category: string;
  collectionName?: string;
  collectionCode?: string;
  productType?: string;
  productName: string;
  description: string;
  colorFinish: string;
  colorFamily?: string;
  material?: string;
  shape?: string;
  dimensionsText?: string;
  widthInches?: number | null;
  depthInches?: number | null;
  heightInches?: number | null;
  cubes?: number | null;
  weightLbs?: number | null;
  basePrice: string;
  isSet?: boolean;
  setPieceCount?: number | null;
  isSwatch?: boolean;
  isSample?: boolean;
  isNewProduct?: boolean;
  upholsteryCover?: string;
  hardwareOptions?: string[];
  cushionOptions?: string[];
  featureTags?: string[];
  searchKeywords?: string[];
  uploadId?: string | null;
  sourceSortOrder?: number;
  sourceNote: string;
};

type ManufacturerTemplate = {
  summary: string;
  quirks: string[];
  rows: NormalizedProductRow[];
};

type ManufacturerPricelistPortalProps = {
  onBack: () => void;
  onOpenProductSearch?: () => void;
};

const MANUFACTURERS = [...CANONICAL_PRODUCT_MANUFACTURERS];

const PORTAL_SCREENS: Array<{ key: PortalScreen; label: string }> = [
  { key: "ingestion", label: "Upload & Ingestion" },
  { key: "validation", label: "Validation & Correction" },
];

const cloneRows = (rows: NormalizedProductRow[]) => rows.map((row) => ({ ...row }));

const getUploadSelectionScore = (upload: ManufacturerPricebookUpload) => {
  let score = 0;
  const name = `${upload.originalName} ${upload.storageName}`.toLowerCase();
  if (upload.documentType === "archive") score -= 1000;
  if (upload.parentUploadId) score += 25;
  if (/\.xlsx?$/.test(name)) score += 250;
  if (/price[_ -]?list|pricebook/.test(name)) score += 180;
  if (/residential price list/.test(name)) score += 600;
  if (/sku list|pricing by sku/.test(name)) score += 350;
  if (/compressed/.test(name)) score += 20;
  if (/order form|configurations/.test(name)) score -= 120;
  if (/kits/.test(name)) score -= 60;
  if (/warranty/.test(name)) score -= 100;
  if (/tariff|delivery schedule|schedule|coastal covers|curfab|pattern|cushion/.test(name)) score -= 220;
  if (/diamond/.test(name)) score -= 120;
  if (/fabric/.test(name)) score -= 120;
  if (/grade change|cheat sheet/.test(name)) score -= 140;
  return score;
};

const SIBLING_PREFERRED_MANUFACTURERS = new Set([
  "best",
  "england",
  "jackson-catnapper",
  "guardsman",
  "gbs-protectall",
  "innovations",
]);

const getPreferredHoldingUpload = (uploads: ManufacturerPricebookUpload[]) =>
  [...uploads].sort((left, right) => getUploadSelectionScore(right) - getUploadSelectionScore(left))[0] || null;

const getResolvedPreviewUpload = (
  uploads: ManufacturerPricebookUpload[],
  selectedUploadId: string | null
) => {
  const selectedUpload = uploads.find((upload) => upload.id === selectedUploadId) || null;
  if (selectedUpload?.documentType === "archive") {
    return (
      getPreferredHoldingUpload(
        uploads.filter((upload) => upload.parentUploadId === selectedUpload.id && upload.documentType !== "archive")
      ) ||
      selectedUpload
    );
  }
  if (
    selectedUpload?.manufacturerSlug &&
    SIBLING_PREFERRED_MANUFACTURERS.has(selectedUpload.manufacturerSlug) &&
    selectedUpload.parentUploadId
  ) {
    return (
      getPreferredHoldingUpload(
        uploads.filter(
          (upload) => upload.parentUploadId === selectedUpload.parentUploadId && upload.documentType !== "archive"
        )
      ) || selectedUpload
    );
  }
  return selectedUpload || getPreferredHoldingUpload(uploads) || null;
};

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
  Guardsman: {
    summary: "Guardsman files are structured consumables price lists with section headers like Wood Care and Fabric Care.",
    quirks: [
      "These rows are care and cleaning products rather than furniture collections, so category carry-forward matters more than collection mapping.",
      "Unit price and MSRP both appear; publish should use unit price and preserve MSRP in notes.",
    ],
    rows: [
      {
        id: "guardsman-1",
        manufacturer: "Guardsman",
        category: "Wood Care",
        productName: "460500",
        description: "Deep Clean Purifying Wood Cleaner 12.5 oz Aerosol",
        colorFinish: "",
        basePrice: "3.50",
        sourceNote: "MSRP 5.99",
      },
      {
        id: "guardsman-2",
        manufacturer: "Guardsman",
        category: "Wood Care",
        productName: "461100",
        description: "Anytime Clean & Polish for Wood - Woodland Fresh 16 oz Trigger Spray",
        colorFinish: "",
        basePrice: "4.00",
        sourceNote: "Consumables workbook row.",
      },
      {
        id: "guardsman-3",
        manufacturer: "Guardsman",
        category: "",
        productName: "461700",
        description: "Revitalizing Lemon Oil with UV Protection 16 oz",
        colorFinish: "",
        basePrice: "8.35",
        sourceNote: "Category intentionally blank in template to surface validation.",
      },
    ],
  },
  "GBS ProtectAll": {
    summary: "GBS ProtectAll workbooks read like order forms with section headings, SKU columns, and separate MSRP values.",
    quirks: [
      "Rows can inherit a product family such as Ultra-Tech from a standalone section line above the actual SKUs.",
      "Archive selection should prefer the price list workbook over order-form companions.",
    ],
    rows: [
      {
        id: "gbs-1",
        manufacturer: "GBS ProtectAll",
        category: "Ultra-Tech",
        productName: "10-PILL-04/6-EMRLDLOPRO",
        description: "Ultra-Tech Advanced Pillow-LOW Profile",
        colorFinish: "",
        basePrice: "29.00",
        sourceNote: "MSRP 99.99",
      },
      {
        id: "gbs-2",
        manufacturer: "GBS ProtectAll",
        category: "Ultra-Tech",
        productName: "10-PILL-06/6-UTTNLOKGWH",
        description: "Ultra-Tech Advanced Pillow-LOW Profile KING",
        colorFinish: "",
        basePrice: "39.00",
        sourceNote: "HealthySleep and ProtectAll lines can share one workbook.",
      },
      {
        id: "gbs-3",
        manufacturer: "GBS ProtectAll",
        category: "",
        productName: "",
        description: "ProtectAll accessory row requiring SKU confirmation",
        colorFinish: "",
        basePrice: "29.00",
        sourceNote: "Template intentionally leaves SKU blank for validation workflow.",
      },
    ],
  },
  Innovations: {
    summary: "Innovations archives mix SKU lists, master price lists, and kit breakdowns; the SKU list workbook is the best search source.",
    quirks: [
      "Archive selection should prefer SKU list or pricing-by-SKU files over master price and kit worksheets.",
      "Category and collection data often need to be inferred from terse component descriptions.",
    ],
    rows: [
      {
        id: "innovations-1",
        manufacturer: "Innovations",
        category: "Bunk Beds",
        productName: "9453G",
        description: "CAMBRIDGE BUNK HEAD/FOOT/GUARD/HDW GRAY",
        colorFinish: "",
        basePrice: "160.00",
        sourceNote: "Collection inferred from leading description token.",
      },
      {
        id: "innovations-2",
        manufacturer: "Innovations",
        category: "Slat Kits",
        productName: "315",
        description: "TWIN BUNK BED SLAT KIT",
        colorFinish: "",
        basePrice: "18.00",
        sourceNote: "Component SKU from innovations master parts list.",
      },
      {
        id: "innovations-3",
        manufacturer: "Innovations",
        category: "",
        productName: "967DC",
        description: "Extension kit slats / center support",
        colorFinish: "",
        basePrice: "18.60",
        sourceNote: "Category intentionally blank in template to surface validation.",
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
  "Jackson/Catnapper": {
    summary: "Jackson/Catnapper books often mix Jackson and Catnapper collections inside one kiosk list with upholstery callouts and intro tags.",
    quirks: [
      "Rows may need manual separation between Jackson and Catnapper naming when the PDF groups both brands together.",
      "Validation should confirm whether intro tags, cover grades, or motion options belong in the description or source notes.",
    ],
    rows: [
      {
        id: "jackson-catnapper-1",
        manufacturer: "Jackson/Catnapper",
        category: "Motion Upholstery",
        productName: "4498 Sofa",
        description: "Power reclining sofa with console and cupholders",
        colorFinish: "Smoke",
        basePrice: "1499.00",
        sourceNote: "Combined kiosk row may need brand separation between Jackson and Catnapper collections.",
      },
      {
        id: "jackson-catnapper-2",
        manufacturer: "Jackson/Catnapper",
        category: "",
        productName: "4499 Loveseat",
        description: "Power reclining loveseat",
        colorFinish: "Smoke",
        basePrice: "1299.00",
        sourceNote: "Category missing from sample template to keep validation workflow visible.",
      },
      {
        id: "jackson-catnapper-3",
        manufacturer: "Jackson/Catnapper",
        category: "Motion Upholstery",
        productName: "",
        description: "Rocker recliner with chaise seating",
        colorFinish: "Sable",
        basePrice: "899.00",
        sourceNote: "Item number intentionally blank in template to reflect OCR cleanup needs.",
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

const catalogItemToRow = (item: ManufacturerCatalogItem): NormalizedProductRow => ({
  id: item.id,
  uploadId: item.uploadId ?? null,
  manufacturer: item.manufacturer,
  manufacturerSlug: item.manufacturerSlug,
  category: item.category,
  collectionName: item.collectionName,
  collectionCode: item.collectionCode,
  productType: item.productType,
  productName: item.sku,
  description: item.description,
  colorFinish: item.colorFinish,
  colorFamily: item.colorFamily,
  material: item.material,
  shape: item.shape,
  dimensionsText: item.dimensionsText,
  widthInches: item.widthInches,
  depthInches: item.depthInches,
  heightInches: item.heightInches,
  cubes: item.cubes,
  weightLbs: item.weightLbs,
  basePrice: item.basePrice === null ? "" : item.basePrice.toFixed(2),
  isSet: item.isSet,
  setPieceCount: item.setPieceCount,
  isSwatch: item.isSwatch,
  isSample: item.isSample,
  isNewProduct: item.isNewProduct,
  upholsteryCover: item.upholsteryCover,
  hardwareOptions: item.hardwareOptions,
  cushionOptions: item.cushionOptions,
  featureTags: item.featureTags,
  searchKeywords: item.searchKeywords,
  sourceSortOrder: item.sourceSortOrder,
  sourceNote: item.sourceNote,
});

const rowToCatalogItem = (row: NormalizedProductRow, manufacturerSlug: string, uploadId: string | null): ManufacturerCatalogItem => ({
  id: row.id,
  uploadId,
  manufacturer: row.manufacturer,
  manufacturerSlug,
  collectionCode: row.collectionCode || "",
  collectionName: row.collectionName || "",
  category: row.category,
  productType: row.productType || "",
  sku: row.productName,
  description: row.description,
  colorFinish: row.colorFinish,
  colorFamily: row.colorFamily || "",
  material: row.material || "",
  shape: row.shape || "",
  dimensionsText: row.dimensionsText || "",
  widthInches: row.widthInches ?? null,
  depthInches: row.depthInches ?? null,
  heightInches: row.heightInches ?? null,
  cubes: row.cubes ?? null,
  weightLbs: row.weightLbs ?? null,
  basePrice: row.basePrice ? Number(row.basePrice) : null,
  isSet: Boolean(row.isSet),
  setPieceCount: row.setPieceCount ?? null,
  isSwatch: Boolean(row.isSwatch),
  isSample: Boolean(row.isSample),
  isNewProduct: Boolean(row.isNewProduct),
  upholsteryCover: row.upholsteryCover || "",
  hardwareOptions: row.hardwareOptions || [],
  cushionOptions: row.cushionOptions || [],
  featureTags: row.featureTags || [],
  searchKeywords: row.searchKeywords || [],
  sourceNote: row.sourceNote,
  sourceSortOrder: row.sourceSortOrder ?? 0,
});

const ManufacturerPricelistPortal: React.FC<ManufacturerPricelistPortalProps> = ({
  onBack,
  onOpenProductSearch,
}) => {
  const [activeScreen, setActiveScreen] = useState<PortalScreen>("ingestion");
  const [selectedManufacturer, setSelectedManufacturer] = useState("Ashley");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState("auto");
  const [dragActive, setDragActive] = useState(false);
  const [ingestionStage, setIngestionStage] = useState<"idle" | "ready" | "extracting" | "review">("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [rows, setRows] = useState<NormalizedProductRow[]>(cloneRows(MANUFACTURER_TEMPLATES.Ashley.rows));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [validationSort, setValidationSort] = useState<ValidationSort>("flagged");
  const [replaceExistingOnPublish, setReplaceExistingOnPublish] = useState(true);
  const [holdingUploads, setHoldingUploads] = useState<ManufacturerPricebookUpload[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [holdingBusy, setHoldingBusy] = useState(false);
  const [holdingMessage, setHoldingMessage] = useState<string | null>(null);
  const [holdingError, setHoldingError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [referenceNotes, setReferenceNotes] = useState<ManufacturerReferenceNote[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const template = MANUFACTURER_TEMPLATES[selectedManufacturer] || MANUFACTURER_TEMPLATES.Ashley;
  const flaggedRows = useMemo(
    () =>
      rows
        .map((row) => ({ row, missingFields: getMissingFields(row) }))
        .filter((entry) => entry.missingFields.length > 0),
    [rows]
  );
  const validationRows = useMemo(() => {
    const alpha = (value: string | undefined) => (value || "").trim().toLowerCase();
    const money = (value: string) => {
      const parsed = Number(String(value || "").replace(/[$,]/g, "").trim());
      return Number.isFinite(parsed) ? parsed : null;
    };

    return [...rows].sort((left, right) => {
      const leftMissing = getMissingFields(left);
      const rightMissing = getMissingFields(right);

      if (validationSort === "flagged") {
        if (leftMissing.length !== rightMissing.length) return rightMissing.length - leftMissing.length;
        if (left.sourceSortOrder !== right.sourceSortOrder) return (left.sourceSortOrder || 0) - (right.sourceSortOrder || 0);
        return alpha(left.productName).localeCompare(alpha(right.productName));
      }
      if (validationSort === "source") {
        if ((left.sourceSortOrder || 0) !== (right.sourceSortOrder || 0)) {
          return (left.sourceSortOrder || 0) - (right.sourceSortOrder || 0);
        }
        return alpha(left.productName).localeCompare(alpha(right.productName));
      }
      if (validationSort === "manufacturer") return alpha(left.manufacturer).localeCompare(alpha(right.manufacturer));
      if (validationSort === "category") return alpha(left.category).localeCompare(alpha(right.category));
      if (validationSort === "product") return alpha(left.productName).localeCompare(alpha(right.productName));
      if (validationSort === "description") return alpha(left.description).localeCompare(alpha(right.description));
      if (validationSort === "price_low" || validationSort === "price_high") {
        const leftPrice = money(left.basePrice);
        const rightPrice = money(right.basePrice);
        if (leftPrice === null && rightPrice === null) return alpha(left.productName).localeCompare(alpha(right.productName));
        if (leftPrice === null) return 1;
        if (rightPrice === null) return -1;
        return validationSort === "price_low" ? leftPrice - rightPrice : rightPrice - leftPrice;
      }
      return 0;
    });
  }, [rows, validationSort]);

  const refreshHoldingUploads = async (manufacturer: string) => {
    const uploads = await fetchManufacturerPricebookUploads(manufacturer);
    setHoldingUploads(uploads);
    if (uploads.length && (!selectedUploadId || !uploads.some((upload) => upload.id === selectedUploadId))) {
      const preferredUpload = getPreferredHoldingUpload(uploads);
      setSelectedUploadId((preferredUpload || uploads[0]).id);
    }
    return uploads;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [uploads, notes] = await Promise.all([
          fetchManufacturerPricebookUploads(selectedManufacturer),
          fetchManufacturerReferenceNotes(selectedManufacturer),
        ]);
        if (cancelled) return;
        setHoldingUploads(uploads);
        setReferenceNotes(notes);
        const preferredUpload = getPreferredHoldingUpload(uploads);
        setSelectedUploadId((preferredUpload || uploads[0] || null)?.id || null);
      } catch (error: any) {
        if (!cancelled) {
          setHoldingUploads([]);
          setReferenceNotes([]);
          setHoldingError(String(error?.message || error || "Failed to load manufacturer workspace"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedManufacturer]);

  const onFilePicked = (files: File[]) => {
    setSelectedFiles(files);
    setIngestionStage(files.length ? "ready" : "idle");
    setExtractionProgress(0);
    setValidationMessage(null);
    setHoldingMessage(null);
    setHoldingError(null);
  };

  const startExtraction = async () => {
    const targetUpload = getResolvedPreviewUpload(holdingUploads, selectedUploadId);
    if (!targetUpload) {
      setHoldingError("Upload a pricebook PDF, spreadsheet, CSV, or ZIP first. ZIP bundles now auto-unpack and the portal will try to detect the best usable file automatically.");
      return;
    }
    if (targetUpload.documentType === "archive") {
      setHoldingError("This archive did not produce a supported PDF/CSV/XLS/XLSX file yet. Upload another file or re-upload the ZIP once the bundle is ready.");
      return;
    }
    setPreviewBusy(true);
    setValidationMessage(null);
    setPublishedAt(null);
    setHoldingError(null);
    setIngestionStage("extracting");
    setExtractionProgress(35);
    try {
      const preview = await previewManufacturerPricebookUpload(targetUpload.id);
      setRows(preview.rows.map((row) => catalogItemToRow(row)));
      if (preview.notes.length) setReferenceNotes(preview.notes);
      setSelectedUploadId(targetUpload.id);
      setIngestionStage("review");
      setExtractionProgress(100);
      setActiveScreen("validation");
      setValidationMessage(
        `${selectedManufacturer} extraction loaded ${preview.rows.length} normalized rows from ${targetUpload.originalName}.`
      );
      await refreshHoldingUploads(selectedManufacturer);
    } catch (error: any) {
      setIngestionStage("ready");
      setExtractionProgress(0);
      setHoldingError(String(error?.message || error || "Failed to preview upload"));
    } finally {
      setPreviewBusy(false);
    }
  };

  const updateRow = (rowId: string, field: keyof NormalizedProductRow, value: string) => {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
    setValidationMessage(null);
    setPublishedAt(null);
  };

  const saveAndPublish = async () => {
    if (flaggedRows.length > 0) {
      setValidationMessage("Resolve all highlighted required fields before publishing to the master database.");
      return;
    }
    const targetUpload =
      getResolvedPreviewUpload(holdingUploads, selectedUploadId) || null;
    if (!targetUpload) {
      setValidationMessage("Choose a holding upload before publishing.");
      return;
    }
    setPublishBusy(true);
    try {
      const result = await publishManufacturerPricebookUpload({
        uploadId: targetUpload.id,
        rows: rows.map((row) =>
          rowToCatalogItem(row, targetUpload.manufacturerSlug || selectedManufacturer.toLowerCase(), targetUpload.id)
        ),
      });
      setPublishedAt(new Date().toLocaleString());
      setValidationMessage(
        `Published ${result.publishedRows} ${selectedManufacturer} rows into the searchable catalog.`
      );
      await refreshHoldingUploads(selectedManufacturer);
    } catch (error: any) {
      setValidationMessage(String(error?.message || error || "Failed to publish manufacturer catalog"));
    } finally {
      setPublishBusy(false);
    }
  };

  const resetExtraction = async () => {
    if (selectedUploadId) {
      await startExtraction();
      return;
    }
    setRows(cloneRows(template.rows));
    setValidationMessage("Validation rows were reset to the current template state.");
    setPublishedAt(null);
  };

  const uploadToHolding = async () => {
    if (!selectedFiles.length) return;
    setHoldingBusy(true);
    setHoldingMessage(null);
    setHoldingError(null);
    try {
      const uploadedRows = await uploadManufacturerPricebookToHolding({
        manufacturer: selectedManufacturer,
        files: selectedFiles,
        replaceExisting: replaceExistingOnPublish,
        documentType: selectedDocumentType,
      });
      const refreshed = await refreshHoldingUploads(selectedManufacturer);
      const firstUsableUpload =
        getPreferredHoldingUpload(uploadedRows) ||
        getPreferredHoldingUpload(refreshed) ||
        uploadedRows[0] ||
        null;
      if (firstUsableUpload) setSelectedUploadId(firstUsableUpload.id);

      const archiveCount = uploadedRows.filter((row) => row.documentType === "archive").length;
      const extractedCount = uploadedRows.filter((row) => row.parentUploadId).length;
      const messageParts = [`${selectedFiles.length} file(s) uploaded to holding for ${selectedManufacturer}.`];
      if (archiveCount > 0) {
        messageParts.push(
          extractedCount > 0
            ? `${archiveCount} archive(s) auto-unpacked into ${extractedCount} holding file(s).`
            : `${archiveCount} archive(s) uploaded, but no supported holding file was found inside.`
        );
      }
      setHoldingMessage(messageParts.join(" "));
      setSelectedFiles([]);
    } catch (error: any) {
      setHoldingError(String(error?.message || error || "Failed to upload file to holding"));
    } finally {
      setHoldingBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2">
          {onOpenProductSearch ? (
            <button
              type="button"
              onClick={onOpenProductSearch}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              <Search size={16} />
              Open Full Product Search
            </button>
          ) : null}
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Update Database
          </button>
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
                    setSelectedFiles([]);
                    setSelectedUploadId(null);
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
                  accept=".pdf,.xls,.xlsx,.csv,.zip"
                  multiple
                  className="hidden"
                  onChange={(event) => onFilePicked(Array.from(event.target.files || []))}
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
                    onFilePicked(Array.from(event.dataTransfer.files || []));
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
                  <div className="mt-2 text-sm text-slate-500">Accepted formats: PDF, Excel, CSV, ZIP</div>
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
                      {selectedFiles.length === 1
                        ? selectedFiles[0].name
                        : `${selectedFiles.length} files selected`}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Upload Type
                </label>
                <select
                  value={selectedDocumentType}
                  onChange={(event) => setSelectedDocumentType(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="auto">Auto Detect</option>
                  <option value="pricebook">Pricebook</option>
                  <option value="archive">ZIP archive</option>
                  <option value="warranty">Warranty</option>
                  <option value="return_policy">Return policy</option>
                  <option value="freight_policy">Freight policy</option>
                  <option value="reference">Reference / Other</option>
                </select>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                `Auto Detect` now handles normal PDF, Excel, CSV, and ZIP uploads by filename. Only change this when
                you want to override the detected type for warranty, freight, returns, or other reference documents.
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!selectedFiles.length || holdingBusy}
                onClick={() => void uploadToHolding()}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {holdingBusy ? "Uploading..." : "Upload to Holding Folder"}
              </button>
              <button
                type="button"
                disabled={previewBusy || ingestionStage === "extracting"}
                onClick={() => void startExtraction()}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {previewBusy || ingestionStage === "extracting" ? "Previewing..." : "Load Into Validation"}
              </button>
              <div className="text-sm text-slate-500">
                {ingestionStage === "idle" && "Select a manufacturer and upload one or more files to begin."}
                {ingestionStage === "ready" && "Upload files to holding, then load the real pricebook into validation."}
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
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Manufacturer reference notes</h4>
              <div className="mt-3 space-y-2">
                {referenceNotes.length ? (
                  referenceNotes.slice(0, 4).map((note) => (
                    <div key={note.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{note.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{note.noteType}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {note.content.slice(0, 280)}
                        {note.content.length > 280 ? "..." : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No stored warranty or policy notes for {selectedManufacturer} yet.
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">Sort</span>
                  <select
                    value={validationSort}
                    onChange={(event) => setValidationSort(event.target.value as ValidationSort)}
                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value="flagged">Needs review first</option>
                    <option value="source">Original extraction order</option>
                    <option value="manufacturer">Manufacturer A-Z</option>
                    <option value="category">Category A-Z</option>
                    <option value="product">Item # A-Z</option>
                    <option value="description">Description A-Z</option>
                    <option value="price_low">Base price low-high</option>
                    <option value="price_high">Base price high-low</option>
                  </select>
                </label>
                {onOpenProductSearch ? (
                  <button
                    type="button"
                    onClick={onOpenProductSearch}
                    className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Open Full Product Search
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void resetExtraction()}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Extraction
                </button>
                <button
                  type="button"
                  onClick={() => void saveAndPublish()}
                  disabled={flaggedRows.length > 0 || publishBusy}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishBusy ? "Publishing..." : "Save & Publish to Database"}
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
                  {validationRows.map((row) => {
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
    </div>
  );
};

export default ManufacturerPricelistPortal;
