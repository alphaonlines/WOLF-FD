# Manufacturer Pricelist Portal

## Goal
Build an internal workflow to ingest, normalize, validate, and search furniture vendor price books across 30+ manufacturers.

## Current Frontend Portal
- Added inside `Update Database` as a dedicated `Update Manufacturer Pricelist` workspace.
- Includes three UI sections:
  - Upload & Ingestion
  - Data Validation & Correction
  - Global Product Search Catalog
- Current implementation now also supports real upload-to-holding by manufacturer before parsing is finalized.
- Uploaded source files are staged so we can inspect formatting and build parser rules vendor by vendor.

## Why This Needs A Dedicated Pipeline
- Source files arrive in mixed formats: PDF, Excel, CSV.
- Each manufacturer structures pricing differently.
- Some vendors require option-code expansion to build the final item number.
- Some vendors provide matrix pricing instead of one clean publishable base cost.
- Staff need a guided review screen before anything lands in the searchable master database.

## Manufacturer Examples To Support
- `AAmerica`: shorthand pricing columns like `EC WS`, `EC 12`, and container-based costs.
- `Archbold`: base item numbers that must be combined with color and hardware option codes.
- `Albany`: separate `TL` and `LTL` pricing plus cube and freight context.
- `England`: matrix pricing by model and fabric grade, sometimes with diamond-pricing overrides.
- `Ashley`: nested option pricing like storage footboards or roll-out slats attached to base products.

## Normalized Required Fields
- Manufacturer
- Category
- Product Name / Item #
- Description
- Color / Finish (optional)
- Base Price / Cost

## Product Direction
- Keep the interface utilitarian and clean.
- Make missing required fields impossible to ignore.
- Prevent publish/save when required fields are blank.
- Preserve vendor-specific source notes for downstream ops review.

## Next Backend Phases
- [x] Create a dedicated manufacturer price-book upload endpoint.
- [x] Store upload batches with manufacturer, file metadata, and holding status.
- [x] Support multi-file and ZIP uploads into the holding area so manufacturer bundles can be staged before parser work is complete.
- [x] Create normalized price-book tables for products and source notes.
- [x] Add publish action from validation into the searchable master catalog.
- [x] On publish, clear existing normalized rows for that manufacturer first, then replace them with the newly validated set.
- [x] Add search endpoints with filters for manufacturer, category, description, finish, and richer furniture attributes.
- [x] Capture manufacturer reference notes such as warranty, freight, return, and website/policy information.
- [x] Build the first live manufacturer parser and publish pipeline for `Liberty`.
- Save flagged validation issues per row so review sessions can resume.
- [x] Auto-unpack ZIP archives into child holding files and surface extracted files for review.
- Add manufacturer-specific parser profiles for the next vendors (`Best HF`, `Ashley`, `England`, etc.).
- Add audit logging for uploads, edits, and publish actions.

## Current Normalized Search Fields
- Manufacturer / manufacturer slug
- Category
- Collection code / collection name
- Product name / description
- SKU / item number
- Color / finish
- Color family
- Material
- Product type
- Shape
- Dimensions text
- Width / depth / height
- Cubes
- Weight
- Base price / cost
- Set / piece count flags
- Swatch / sample flags
- Hardware options
- Cushion options
- Feature tags / search keywords
- Source note / source sort order

## Future Nice-To-Haves
- Manufacturer-specific parser profiles with reusable extraction templates.
- Side-by-side source preview for PDF review.
- Bulk replace tools for finish names and category cleanup.
- Duplicate detection across uploads and across manufacturers.
- Staff notes and approval history on each published product row.
