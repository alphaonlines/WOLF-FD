# Manufacturer Pricelist Portal

## Goal
Build an internal workflow to ingest, normalize, validate, and search furniture vendor price books across 30+ manufacturers.

## Current Frontend Portal
- Added inside `Update Database` as a dedicated `Update Manufacturer Pricelist` workspace.
- Includes three UI sections:
  - Upload & Ingestion
  - Data Validation & Correction
  - Global Product Search Catalog
- Current implementation is a frontend prototype with manufacturer-aware demo extraction rows to shape the workflow and data model.

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
- Create a dedicated manufacturer price-book upload endpoint.
- Store upload batches with manufacturer, file metadata, and extraction status.
- Create normalized price-book tables for products and source notes.
- Save flagged validation issues per row so review sessions can resume.
- Add publish action from validation into the searchable master catalog.
- Add search endpoints with filters for manufacturer, category, description, and finish.
- Add audit logging for uploads, edits, and publish actions.

## Future Nice-To-Haves
- Manufacturer-specific parser profiles with reusable extraction templates.
- Side-by-side source preview for PDF review.
- Bulk replace tools for finish names and category cleanup.
- Duplicate detection across uploads and across manufacturers.
- Staff notes and approval history on each published product row.
