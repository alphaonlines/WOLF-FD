import { spawn } from "child_process";
import type { ParsedManufacturerCatalogRow, ParsedManufacturerReferenceNote } from "./libertyPricebook";

type ExecFileAsyncLike = (
  file: string,
  args?: readonly string[] | null,
  options?: { timeout?: number }
) => Promise<{ stdout?: string | Buffer; stderr?: string | Buffer }>;

// ─── helpers ────────────────────────────────────────────────────────────────

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\f/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNum(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function tokenize(values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    const normalized = clean(value).toLowerCase().replace(/[^a-z0-9" ]+/g, " ");
    if (!normalized) continue;
    tokens.add(normalized);
    normalized.split(/\s+/).forEach((part) => {
      if (part.length >= 2) tokens.add(part);
    });
  }
  return [...tokens];
}

function extractPdfText(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pdftotext", ["-layout", filePath, "-"]);
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { err += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(clean(err) || `pdftotext exited with code ${code ?? "unknown"}`));
    });
  });
}

// ─── brand detection ─────────────────────────────────────────────────────────

function detectBrand(text: string): "Jackson" | "Catnapper" {
  const upper = text.toUpperCase();
  if (upper.includes("CATNAPPER FURNITURE KIOSK")) return "Catnapper";
  if (upper.includes("JACKSON FURNITURE KIOSK")) return "Jackson";
  // Fall back by occurrences
  const catCount = (upper.match(/CATNAPPER/g) || []).length;
  const jacCount = (upper.match(/JACKSON/g) || []).length;
  return catCount >= jacCount ? "Catnapper" : "Jackson";
}

// ─── section / category detection ────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /STATIONARY SOFAS?\s+(?:and|&)\s+SECTIONALS/i,  label: "Stationary Sofas & Sectionals" },
  { pattern: /RECLINING SOFAS?\s+(?:and|&|\/)\s+SECTIONALS/i, label: "Reclining Sofas & Sectionals" },
  { pattern: /STATIONARY LEATHER/i,                           label: "Stationary Leather Collections" },
  { pattern: /ITALIAN LEATHER/i,                              label: "Italian Leather Collections" },
  { pattern: /GENUINE LEATHER/i,                              label: "Leather Collections" },
  { pattern: /POW-?R[- ]LIFT/i,                               label: "Pow-R-Lift Chairs" },
  { pattern: /LIFT CHAIRS?/i,                                  label: "Lift Chairs" },
  { pattern: /RECLINING CHAIRS?/i,                             label: "Reclining Chairs" },
  { pattern: /MOTION\b/i,                                      label: "Motion Upholstery" },
  { pattern: /SLEEPERS?\s*(?:&|and)?\s*ACCENTS?/i,            label: "Sleepers & Accents" },
  { pattern: /^SLEEPERS?$/i,                                   label: "Sleepers" },
  { pattern: /^ACCENTS?$/i,                                    label: "Accents" },
];

function detectSection(line: string): string {
  const compact = clean(line);
  for (const { pattern, label } of SECTION_PATTERNS) {
    if (pattern.test(compact)) return label;
  }
  // Generic: all-caps line with at least 2 words and no digits could be a section
  if (/^[A-Z][A-Z\s\/&\-]+$/.test(compact) && compact.split(/\s+/).length >= 2 && !/^\d/.test(compact)) {
    return compact;
  }
  return "";
}

function sectionToCategory(section: string): string {
  const s = section.toLowerCase();
  if (s.includes("leather")) return "Leather Upholstery";
  if (s.includes("reclining sofas") || s.includes("motion")) return "Motion Upholstery";
  if (s.includes("reclining chair") || s.includes("lift chair") || s.includes("pow-r-lift")) return "Reclining Chairs";
  if (s.includes("stationary")) return "Stationary Upholstery";
  if (s.includes("sleeper")) return "Sleepers";
  if (s.includes("accent")) return "Accents";
  return section || "Upholstery";
}

// ─── feature extraction from descriptions ────────────────────────────────────

const FEATURE_PATTERNS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /zero\s*gravity/i,              tag: "zero-gravity" },
  { pattern: /pow-?r[- ]lift|lift\s+chair/i, tag: "lift-chair" },
  { pattern: /lay\s*flat/i,                  tag: "lay-flat" },
  { pattern: /wall\s*hugger/i,               tag: "wall-hugger" },
  { pattern: /power\s+head\s*rest/i,         tag: "power-headrest" },
  { pattern: /power\s+lumbar/i,              tag: "power-lumbar" },
  { pattern: /power\s+reclin/i,              tag: "power-recline" },
  { pattern: /\bpower\b/i,                   tag: "power" },
  { pattern: /heat\s*&?\s*(?:mass|msg)/i,    tag: "heat-massage" },
  { pattern: /\bheat\b/i,                    tag: "heat" },
  { pattern: /\bmassage\b|\bmsg\b/i,         tag: "massage" },
  { pattern: /bluetooth/i,                   tag: "bluetooth" },
  { pattern: /usb/i,                         tag: "usb" },
  { pattern: /swivel/i,                      tag: "swivel" },
  { pattern: /glider/i,                      tag: "glider" },
  { pattern: /rocker/i,                      tag: "rocker" },
  { pattern: /modular/i,                     tag: "modular" },
  { pattern: /sectional/i,                   tag: "sectional" },
  { pattern: /\blsf\b|\brsf\b/i,            tag: "sectional-piece" },
  { pattern: /\braf\b|\blaf\b/i,            tag: "sectional-piece" },
  { pattern: /sleeper/i,                     tag: "sleeper" },
  { pattern: /comfort\s+sack/i,              tag: "comfort-sack" },
  { pattern: /ext(?:ended)?\s+ott/i,         tag: "extended-ottoman" },
  { pattern: /storage/i,                     tag: "storage" },
  { pattern: /console/i,                     tag: "console" },
  { pattern: /drop\s*down\s*table/i,         tag: "drop-down-table" },
];

function extractFeatureTags(description: string, styleNote: string, section: string): string[] {
  const combined = `${description} ${styleNote} ${section}`.toLowerCase();
  const tags = new Set<string>();
  for (const { pattern, tag } of FEATURE_PATTERNS) {
    if (pattern.test(combined)) tags.add(tag);
  }
  return [...tags];
}

function detectProductType(description: string): string {
  const d = description.toLowerCase();
  if (/comfort\s+sack/.test(d)) return "comfort sack";
  if (/footstool/.test(d)) return "footstool";
  if (/castered\s+cocktail\s+ottoman|cocktail\s+ottoman/.test(d)) return "cocktail ottoman";
  if (/\botto(?:man)?\b/.test(d)) return "ottoman";
  if (/modular\s+sectional|sectional/.test(d)) return "sectional";
  if (/pow-?r[- ]lift|lift\s+chair/.test(d)) return "lift chair";
  if (/rocker\s+recliner|glider\s+recliner|wall\s+hugger\s+recliner|lay\s+flat\s+recliner|power\s+lay\s+flat\s+recliner|power\s+recliner|\brecliner\b/.test(d)) return "recliner";
  if (/reclining\s+sofa|sofa\s+w\/?\d*\s+recliners?/.test(d)) return "reclining sofa";
  if (/reclining\s+loveseat/.test(d)) return "reclining loveseat";
  if (/sleeper/.test(d)) return "sleeper sofa";
  if (/loveseat/.test(d)) return "loveseat";
  if (/chair\s+1\s*\/\s*2|chair\s+1\.5/.test(d)) return "chair and a half";
  if (/accent\s+chair/.test(d)) return "accent chair";
  if (/\bchair\b/.test(d)) return "chair";
  if (/\bsofa\b/.test(d)) return "sofa";
  if (/console/.test(d)) return "console";
  if (/chaise/.test(d)) return "chaise";
  if (/corner/.test(d)) return "corner piece";
  if (/armless/.test(d)) return "armless piece";
  if (/section/.test(d)) return "sectional piece";
  return "furniture";
}

function detectMaterial(section: string, fabricNumber: string): string {
  const s = `${section} ${fabricNumber}`.toLowerCase();
  if (s.includes("leather") || s.includes("italian")) return "leather";
  return "fabric";
}

// ─── line classification ──────────────────────────────────────────────────────

// Matches rows that end with a dollar price
// Columns (approximate): description  SKU  fabric#  color  L  H  D  WT  CUBES  SEATS  $  PRICE
const ITEM_ROW_RE =
  /^\s{5,}(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+\$\s*([\d,]+\.\d{2})\s*$/;

// Rows where a subtype label ("Modular Sectional", "Sectional") starts the line
// e.g.: "Modular Sectional   LSF Section   1345-62   1838-11   Oyster   96 39 37 163 68.0 3.0 $ 485.00"
const SUBTYPE_ITEM_ROW_RE =
  /^(Modular\s+Sectional|Top\s+Grain\s+Leather\s+Touch|Sectional)\s+(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+\$\s*([\d,]+\.\d{2})\s*$/;

// Rows where style number + name precede the item on the same line
// e.g.: "3265 Marley   Sofa   3265-03   1709-49/2260-46   Mocha/Tapestry   84 41 44 155 64.0 3.0 $ 470.00"
const STYLE_INLINE_ITEM_ROW_RE =
  /^(\d{2,5}[a-z]?)\s+(\S+)\s+(.+?)\s{2,}(\S+)\s{2,}(\S+)\s{2,}(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+\$\s*([\d,]+\.\d{2})\s*$/;

// Style line: number at left margin followed by a name
const STYLE_LINE_RE = /^\s{0,10}(\d{2,5}[a-z]?)\s+([A-Za-z].+?)\s*$/i;

// Note lines that carry feature context for the whole group
const POWER_UPGRADE_RE = /POWER\s+UPGRADE\s+AVAILABLE/i;
const SUBTYPE_RE = /^\s*(Modular\s+Sectional|Top\s+Grain\s+Leather\s+Touch|Sectional)\s*$/i;

// Skip patterns
function shouldSkip(line: string): boolean {
  const c = clean(line);
  if (!c) return true;
  if (/^(Effective|Updated)\b/i.test(c)) return true;
  if (/^(JACKSON|CATNAPPER)\s+FURNITURE\s+KIOSK/i.test(c)) return true;
  if (/^Ship\s+Point:/i.test(c)) return true;
  if (/^STYLE\s+DESCRIPTION\s+SKU\b/i.test(c)) return true;
  if (/^KIOSK\s*$/i.test(c) || /^PRICE\s*$/i.test(c)) return true;
  if (/^\*If ordering a truckload/i.test(c)) return true;
  if (/^Page\s+\d+\b/i.test(c)) return true;
  if (/Pillow\s+Fabric\b/i.test(c)) return true;
  if (/^Ship\s+Point\s+varies/i.test(c)) return true;
  return false;
}

// ─── main parser ─────────────────────────────────────────────────────────────

export async function parseJacksonCatnapperPricebookPdf(
  filePath: string,
  execFileAsync: ExecFileAsyncLike
): Promise<ParsedManufacturerCatalogRow[]> {
  void execFileAsync;
  const text = await extractPdfText(filePath);
  if (!text.trim()) throw new Error("Could not extract text from PDF.");

  const brand = detectBrand(text);
  const manufacturer = brand === "Catnapper" ? "Catnapper" : "Jackson Furniture";
  const manufacturerSlug = brand === "Catnapper" ? "catnapper" : "jackson-catnapper";

  const rows: ParsedManufacturerCatalogRow[] = [];
  const seen = new Set<string>();

  let currentSection = "";
  let currentStyleCode = "";
  let currentStyleName = "";
  let currentStyleNote = ""; // e.g., "POWER UPGRADE AVAILABLE"
  let currentSubtype = "";
  let sortOrder = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const compact = clean(line);
    if (!compact || shouldSkip(compact)) continue;

    // Section header
    const section = detectSection(compact);
    if (section && !/^\d/.test(compact)) {
      currentSection = section;
      currentSubtype = "";
      currentStyleNote = "";
      continue;
    }

    // Subtype marker (e.g., "Modular Sectional")
    const subtypeMatch = compact.match(SUBTYPE_RE);
    if (subtypeMatch) {
      currentSubtype = subtypeMatch[1];
      continue;
    }

    // Power upgrade / feature note
    if (POWER_UPGRADE_RE.test(compact)) {
      currentStyleNote = "power-upgrade-available";
      continue;
    }

    // Style line (group header)
    const styleMatch = line.match(STYLE_LINE_RE);
    if (styleMatch && !ITEM_ROW_RE.test(line)) {
      currentStyleCode = clean(styleMatch[1]);
      currentStyleName = clean(styleMatch[2]).replace(/\s*\(continued\)\s*/i, "");
      currentStyleNote = "";
      currentSubtype = "";
      continue;
    }

    // Item row (has a dollar price at the end) — try primary then secondary regexes
    let description = "";
    let sku = "";
    let fabricNumber = "";
    let colorRaw = "";
    let widthInches: number | null = null;
    let heightInches: number | null = null;
    let depthInches: number | null = null;
    let weightLbs: number | null = null;
    let cubes: number | null = null;
    let seats: number | null = null;
    let basePrice: number | null = null;

    const itemMatch = line.match(ITEM_ROW_RE);
    if (itemMatch) {
      description = clean(itemMatch[1]);
      sku = clean(itemMatch[2]);
      fabricNumber = clean(itemMatch[3]);
      colorRaw = clean(itemMatch[4]);
      widthInches = parseNum(itemMatch[5]);
      heightInches = parseNum(itemMatch[6]);
      depthInches = parseNum(itemMatch[7]);
      weightLbs = parseNum(itemMatch[8]);
      cubes = parseNum(itemMatch[9]);
      seats = parseNum(itemMatch[10]);
      basePrice = parseNum(itemMatch[11]);
    } else {
      const subtypeItemMatch = line.match(SUBTYPE_ITEM_ROW_RE);
      if (subtypeItemMatch) {
        // Line starts with "Modular Sectional" or "Sectional" — override current subtype
        currentSubtype = clean(subtypeItemMatch[1]);
        description = clean(subtypeItemMatch[2]);
        sku = clean(subtypeItemMatch[3]);
        fabricNumber = clean(subtypeItemMatch[4]);
        colorRaw = clean(subtypeItemMatch[5]);
        widthInches = parseNum(subtypeItemMatch[6]);
        heightInches = parseNum(subtypeItemMatch[7]);
        depthInches = parseNum(subtypeItemMatch[8]);
        weightLbs = parseNum(subtypeItemMatch[9]);
        cubes = parseNum(subtypeItemMatch[10]);
        seats = parseNum(subtypeItemMatch[11]);
        basePrice = parseNum(subtypeItemMatch[12]);
      } else {
        const styleInlineMatch = line.match(STYLE_INLINE_ITEM_ROW_RE);
        if (styleInlineMatch) {
          // Style number + name are inline with the item row
          currentStyleCode = clean(styleInlineMatch[1]);
          currentStyleName = clean(styleInlineMatch[2]);
          description = clean(styleInlineMatch[3]);
          sku = clean(styleInlineMatch[4]);
          fabricNumber = clean(styleInlineMatch[5]);
          colorRaw = clean(styleInlineMatch[6]);
          widthInches = parseNum(styleInlineMatch[7]);
          heightInches = parseNum(styleInlineMatch[8]);
          depthInches = parseNum(styleInlineMatch[9]);
          weightLbs = parseNum(styleInlineMatch[10]);
          cubes = parseNum(styleInlineMatch[11]);
          seats = parseNum(styleInlineMatch[12]);
          basePrice = parseNum(styleInlineMatch[13]);
        } else {
          continue;
        }
      }
    }

    if (!sku || !description) continue;

    const productType = detectProductType(description);
    const category = sectionToCategory(currentSection);
    const material = detectMaterial(currentSection, fabricNumber);

    const featureNotes = [
      currentStyleNote,
      currentSubtype ? `subtype:${currentSubtype}` : "",
    ].filter(Boolean);

    const featureTags = extractFeatureTags(description, featureNotes.join(" "), currentSection);
    if (currentStyleNote === "power-upgrade-available" && !featureTags.includes("power-upgrade-available")) {
      featureTags.push("power-upgrade-available");
    }

    const dimensionsText =
      widthInches && heightInches && depthInches
        ? `L ${widthInches}" × H ${heightInches}" × D ${depthInches}"`
        : "";

    const searchKeywords = tokenize([
      currentStyleCode,
      currentStyleName,
      description,
      sku,
      fabricNumber,
      colorRaw,
      category,
      productType,
      currentSection,
      currentSubtype,
      manufacturer,
      ...featureTags,
    ]);

    const sourceNoteParts = [
      currentSection ? `Section: ${currentSection}` : "",
      currentSubtype ? `Subtype: ${currentSubtype}` : "",
      featureNotes.join("; "),
      fabricNumber ? `Fabric: ${fabricNumber}` : "",
      seats !== null ? `Seats: ${seats}` : "",
      cubes !== null ? `Cubes: ${cubes}` : "",
    ].filter(Boolean);

    const dedupeKey = `${sku}|${fabricNumber}|${colorRaw}|${basePrice ?? ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      manufacturer,
      manufacturerSlug,
      collectionCode: currentStyleCode,
      collectionName: currentStyleName,
      category,
      productType,
      sku,
      description,
      colorFinish: colorRaw,
      colorFamily: "",
      material,
      shape: "",
      dimensionsText,
      widthInches,
      depthInches,
      heightInches,
      cubes,
      weightLbs,
      basePrice,
      isSet: false,
      setPieceCount: null,
      isSwatch: false,
      isSample: false,
      isNewProduct: false,
      upholsteryCover: fabricNumber,
      hardwareOptions: [],
      cushionOptions: [],
      featureTags,
      searchKeywords,
      imageUrls: [],
      sourceNote: sourceNoteParts.join(" | "),
      sourceSortOrder: sortOrder++,
    });
  }

  if (!rows.length) {
    throw new Error(`${manufacturer} parser did not detect any price rows. Check PDF format.`);
  }

  return rows;
}

// Feature reference data sourced from the Jackson/Catnapper Spring 2025 catalog
// (quality construction & feature pages at the front of the catalog)
const FEATURE_REFERENCE_NOTES: Array<Omit<ParsedManufacturerReferenceNote, "manufacturer" | "manufacturerSlug">> = [
  {
    noteType: "feature",
    title: "Comfor-Gel",
    content: `100% Gel-Infused Memory Foam Insert throughout the seat cushion.

BENEFITS:
• Superior Comfort — cooler seating experience compared to standard foam
• Reduced Motion Transfer — you won't feel your partner shift
• Long-lasting shape retention

UPSELL TALKING POINTS:
"This isn't just memory foam — it's gel-infused, so it sleeps cooler and holds its shape longer than anything else in this price range."`,
    sourceSortOrder: 1,
  },
  {
    noteType: "feature",
    title: "Comfort Coil Seating",
    content: `15 Gauge Heat Tempered Coil spring system with over 50 independently active coils per seat.

CONSTRUCTION:
• Computer-cut wood parts for precision fit
• Steel springs (12-gauge back, 8-gauge seat) for long-term durability
• Exclusive Steel Tech Framing — 8-gauge spring, tubular steel frame, steel stretchers
• Blown fiber backs for softer feel with less resistance
• Comfort Coil seat cushions with Comfor-Gel memory foam insert
• Individually pocketed coils — quiet, comfortable seating
• Edges smoothed with foam and fiber padding

BENEFITS:
• Long-term quality support and durability
• Offers uniform luxurious seating
• Cooler seating experience with gel layer

UPSELL TALKING POINTS:
"Feel the difference — each coil moves independently so you get full support exactly where you sit, and the gel layer keeps it from getting hot."`,
    sourceSortOrder: 2,
  },
  {
    noteType: "feature",
    title: "Steel Tech Framing",
    content: `Exclusive steel frame and stretcher system — the strongest foundation for long-term strength, stability, and seating comfort.

CONSTRUCTION:
• Exclusive Steel Frame & Stretcher System
• Thick Tubular Steel Construction
• Computer-Spaced Insulated Spring Clips
• 8-Gauge Spring System

BENEFITS:
• Long-Term Strength and Stability
• Reinforces Frame and Provides a Strong Foundation
• Secure Seat Springs for a Quiet and Comfortable Seating Experience
• Provides Lasting Seat Strength and Comfort

UPSELL TALKING POINTS:
"Flip the sofa over and look inside — it's all steel. Most competitors at this price point use wood frames that crack and squeak over time."`,
    sourceSortOrder: 3,
  },
  {
    noteType: "feature",
    title: "Steel Tech Reclining",
    videoUrl: "https://www.youtube.com/watch?v=R6yZQZQm3zQ",
    content: `Catnapper exclusive reclining mechanism with a Limited Lifetime Warranty.

CONSTRUCTION:
• Exclusive Reclining Mechanism — smooth and quiet operation, precision manufactured for years of trouble-free use
• Durable Steel Seat Box — strongest recliner seat box, avoids warping or splitting
• Direct Drive Cross Bar — ensures both sides of the mechanism operate together in sequence for longer life
• Unitized Steel Base — most durable base in the recliner industry, prevents bending of hardware
• 8-Gauge Steel Springs
• Sure-lock spring clips

BENEFITS:
• Lifetime Warranty on the mechanism
• No wood to warp or split
• Smooth, quiet, consistent operation

UPSELL TALKING POINTS:
"Catnapper is the only brand at this price point with a lifetime warranty on the reclining mechanism. That's confidence in the build."`,
    sourceSortOrder: 4,
  },
  {
    noteType: "feature",
    title: "Power Headrest with Lumbar",
    videoUrl: "https://www.youtube.com/watch?v=Qie7eGuVziU",
    content: `Three comfort features in one steel frame: Power Recline, Power Headrest, and Power Lumbar.

FEATURES:
• Power Headrest — fully adjustable for ultimate head and neck comfort
• Power Lumbar — infinite comfort positions for lower back support
• Lay Flat Reclining — fully reclines to horizontal "mattress-use" position

CONSTRUCTION:
• Thick Metal Cross-Bar and Brackets for maximum strength and minimal flex
• Centered Lift Mechanisms for smooth, consistent lift and return
• Exclusive "Return to Closed" button for one-touch closure of all reclining features

UPSELL TALKING POINTS:
"You get three motors in one chair — the headrest cradles your neck, the lumbar supports your lower back, and the whole thing lays flat like a bed. It's like a first-class seat you never have to leave."`,
    sourceSortOrder: 5,
  },
  {
    noteType: "feature",
    title: "Lay Flat Reclining",
    videoUrl: "https://www.youtube.com/watch?v=Qie7eGuVziU",
    content: `Fully reclines to a horizontal position for mattress-use comfort.

BENEFITS:
• Complete relaxation — goes fully flat, not just a standard recline
• Ideal for napping, recovering, or watching TV lying down
• Available on both manual and power reclining models

UPSELL TALKING POINTS:
"This goes all the way flat — it's not a standard recliner angle, it's basically a bed. Great for anyone who naps on the couch or has back issues."`,
    sourceSortOrder: 6,
  },
  {
    noteType: "feature",
    title: "Zero Gravity",
    videoUrl: "https://www.youtube.com/watch?v=6n9g7YbFQkY",
    content: `Zero Gravity recline position elevates the legs above the heart level, distributing body weight evenly.

BENEFITS:
• Reduces pressure on the spine and lower back
• Improves circulation
• Reduces swelling in legs and feet
• Promotes deeper relaxation

UPSELL TALKING POINTS:
"Zero gravity is the position NASA developed for astronauts — it takes all the pressure off your spine and improves circulation. Customers with back pain or poor circulation love this feature."`,
    sourceSortOrder: 7,
  },
  {
    noteType: "feature",
    title: "Power Upgrade Available",
    content: `Many Jackson/Catnapper groups offer a power upgrade — switching from manual to power reclining on the same frame and fabric.

WHAT IT MEANS:
• The manual version and power version share the same collection, fabric, and look
• Power version adds electric motors for effortless recline with a button
• Power versions typically add $100–$130 per piece to the kiosk price

UPSELL TALKING POINTS:
"We carry both the manual and power version of this set. The power upgrade is only $XXX more per piece — for a lot of customers, especially anyone with joint or mobility issues, it's well worth it."`,
    sourceSortOrder: 8,
  },
  {
    noteType: "feature",
    title: "NeverFear Performance Fabric",
    videoUrl: "https://www.youtube.com/watch?v=0v1kQ4mJZ7Q",
    content: `NeverFear Fabrics offer stain resistance, cleanability, and durability — worry-free for real life.

PROPERTIES:
• Stain Resistant
• Soil Resistant
• Odor Resistant
• Works with household cleaning agents
• Designed for heavy-duty wear
• Liquid protection to keep your furniture cleaner

BENEFITS:
• Ideal for families with kids and pets
• Easy to clean spills before they set
• Maintains appearance over time

UPSELL TALKING POINTS:
"This fabric is treated so liquid beads up rather than soaking in — great for families with kids or pets. You can clean most spills with a damp cloth."`,
    sourceSortOrder: 9,
  },
  {
    noteType: "feature",
    title: "Sunbelievable Performance Fabric",
    content: `Sunbelievable is a Solution Dyed Polyester (SDP) performance fabric — one of the most durable options available.

PROPERTIES:
• Durable — heavy duty rating
• Colorfast — outdoor-grade SDP fiber (color goes all the way through the fiber, won't fade)
• Stain Resistant
• Bleach Cleanable — ultimate protection
• Earth Friendly — PFAS-chemical-free

BENEFITS:
• Holds up to bleach cleaning without damage
• Color won't fade from sunlight or cleaning
• Environmentally responsible

UPSELL TALKING POINTS:
"Sunbelievable is bleach-cleanable — that's as tough as fabric gets. The color is dyed all the way through the fiber so it can't fade. Perfect for anyone worried about long-term wear."`,
    sourceSortOrder: 10,
  },
  {
    noteType: "feature",
    title: "LiveSmart Performance Fabric",
    videoUrl: "https://www.youtube.com/watch?v=H3t0Q3mQK5k",
    content: `LiveSmart is a performance fabric technology that provides a barrier against stains, odors, and liquids.

PROPERTIES:
• Stain Resistant
• Odor Resistant
• Soil Resistant
• Designed for heavy-duty wear
• Liquid protection barrier

UPSELL TALKING POINTS:
"LiveSmart is the everyday workhorse of performance fabrics — stain, odor, and liquid resistant. Great for active households."`,
    sourceSortOrder: 11,
  },
  {
    noteType: "feature",
    title: "Nanobionic Infrared Energy Therapy",
    videoUrl: "https://www.youtube.com/watch?v=QzVq8z9m6pQ",
    content: `Nanobionic is a performance fabric technology that uses infrared energy to support wellness.

HOW IT WORKS:
• Nanobionic is a bio-coating made of natural bio-stimulating minerals
• The minerals are activated by your own body heat and return the energy as infrared

BENEFITS:
• Increased Energy
• Increased Circulation
• Enhanced Wellness
• Enhanced Recovery
• Better Sleep

UPSELL TALKING POINTS:
"Nanobionic fabric actually puts your own body heat to work — it converts it to infrared energy that improves circulation and recovery. Customers who deal with fatigue or poor circulation notice the difference."`,
    sourceSortOrder: 12,
  },
  {
    noteType: "feature",
    title: "Extended Ottoman",
    content: `Extended ottoman hardware allows the footrest to extend further out for full leg support.

BENEFITS:
• Full leg and calf support from hip to heel
• Reduces leg fatigue
• Better circulation support

UPSELL TALKING POINTS:
"The extended ottoman supports your whole leg, not just your calves — customers who are taller or have circulation issues really appreciate the extra length."`,
    sourceSortOrder: 13,
  },
  {
    noteType: "feature",
    title: "Heat & Massage",
    content: `Built-in heat and massage system in the seat and/or back.

FEATURES:
• Multiple massage zones
• Heat settings for lumbar area
• Typically includes multiple speed/intensity settings

UPSELL TALKING POINTS:
"This one has built-in massage and heat — it's like a massage chair built into a recliner. Great for anyone who comes home sore or deals with back tightness."`,
    sourceSortOrder: 14,
  },
];

export function parseJacksonCatnapperReferenceNotes(): ParsedManufacturerReferenceNote[] {
  return FEATURE_REFERENCE_NOTES.map((note) => ({
    ...note,
    manufacturer: "Jackson/Catnapper",
    manufacturerSlug: "jackson-catnapper",
  }));
}
