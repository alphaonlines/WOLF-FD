# Competitor Pricing Workbench

The Competitor Pricing workspace lets you upload a CSV/XLSX export of the STORE MOVES AND PRICING sheet, split the rows into safer batches, and run competitor price checks without writing back to Google Sheets.

## Location

In the FD dashboard sidebar, open:

```text
Competitor Pricing
```

The page is permissioned with the same module access as Shop.

## Recommended workflow

1. Export the latest Google Sheet tab as CSV or XLSX.
2. Open `Competitor Pricing` in the FD dashboard.
3. Upload the file.
4. Review the detected columns and bucket counts.
5. Run `Non-Ashley First`.
6. Download the completed CSV report.
7. Review confidence and URLs before making pricing decisions.
8. Enter the Google Sheet URL/ID and tab name, then click `Write to Google Sheet` if the backend has Sheets credentials configured.
9. Run Ashley rows separately if needed.

## Why Non-Ashley first

Ashley search pages block scraping through Firecrawl, so Ashley rows need a slower fallback:

1. Search local SearXNG for exact Ashley product pages.
2. Scrape likely Ashley product URLs through Firecrawl.
3. Score matches by SKU/model confidence.

Furniture4LessNC search pages scrape normally, so non-Ashley rows can be checked faster. Running non-Ashley first cuts the first batch down and avoids getting blocked by Ashley search behavior.

## Buckets

### Non-Ashley first

Rows where the vendor is not Ashley-family and the row has a single SKU/single price. These are the safest rows to run first.

### Ashley / Ashley-family

Rows where the vendor contains one of these aliases:

- Ashley
- Benchcraft
- Signature Design
- Signature Design by Ashley
- Sierra Sleep
- Millennium

### Manual review

Rows with signals that automatic comparison may be misleading:

- Slash-combined SKUs such as `B1050-31/36/46`
- Set/multi-piece text such as `7PC`, `3PC`, `2PC`, or `set`
- Multiple store prices in one cell
- Missing SKU/model
- Missing store price

Manual-review rows are intentionally excluded from the default automatic report because a competitor page may show a single component price while the source row is a full set price.

## Match confidence

Only high and medium confidence matches are used for automatic price differences.

- `high`: exact full SKU/model token appears in the competitor page/search context.
- `medium`: base collection token plus description/name match.
- `low`: description-only or weak identity match.
- `none`: no result, blocked page, 0-results page, or generic price snippet.

Low/none matches may appear in notes but should not drive pricing decisions.

## Google Sheet write-back

After a job completes, the workspace shows a `Write to Google Sheet` panel.

Inputs:

- Google Sheet URL or spreadsheet ID
- Tab name, defaulting to `STORE MOVES AND PRICING`

Write-back behavior:

- High/medium Ashley matches write their price into `AHS COMP PRICE`.
- High/medium Furniture4LessNC matches write their price into `FFL/ OTHER COMP PRICE`.
- Low/none confidence rows are skipped.
- Updated comp-price cells receive a green background.
- The comp-price headers receive a darker green background and bold text.
- Updated cells receive a note with SKU, competitor, confidence, title, URL, recommendation, and checked timestamp.
- Missing `AHS COMP PRICE` or `FFL/ OTHER COMP PRICE` headers are appended to row 1 before writing.

Backend credential options:

```text
GOOGLE_SERVICE_ACCOUNT_JSON
GOOGLE_SERVICE_ACCOUNT_JSON_B64
GOOGLE_SERVICE_ACCOUNT_FILE
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_SHEETS_ACCESS_TOKEN
```

For service-account credentials, share the target Google Sheet with the service account email as an editor.

## Result columns

The downloaded CSV includes:

- source row
- bucket
- vendor
- SKU/model
- description
- store price
- existing AHS comp price
- existing FFL/other comp price
- Ashley title/price/confidence/URL
- Furniture4LessNC title/price/confidence/URL
- lowest reliable competitor price
- store minus lowest
- recommendation
- notes
- checked timestamp

## Backend files

Job data and cached scrape/search responses are stored locally under:

```text
/home/alphahs/WOLF-FD/pos-dashboard-backend/data/competitor-pricing/
```

Subdirectories:

```text
uploads/<jobId>/normalized-input.json
jobs/<jobId>/status.json
jobs/<jobId>/results.json
jobs/<jobId>/results.csv
cache/firecrawl/<sha256>.json
cache/searx/<sha256>.json
```

## Service checks

Check Firecrawl:

```bash
curl -sS http://127.0.0.1:3002/
```

Expected:

```json
{"message":"Firecrawl API","documentation_url":"https://docs.firecrawl.dev"}
```

Check Firecrawl containers:

```bash
cd /home/alphahs/firecrawl-selfhost
docker compose ps
```

Check Hermes MCP, if using Firecrawl tools from Hermes:

```bash
hermes mcp test firecrawl
```

## Developer validation

Frontend targeted tests:

```bash
cd /home/alphahs/WOLF-FD
npm run test -- services/competitorPricingCsv.test.ts components/CompetitorPricingWorkspace.test.tsx components/App.salesDateBasis.test.tsx
```

Backend targeted tests:

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/matching.test.ts src/competitorPricing/cache.test.ts src/competitorPricing/competitors.test.ts src/competitorPricing/jobs.test.ts src/competitorPricingRoutes.test.ts
```

Builds:

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run build

cd /home/alphahs/WOLF-FD
npm run build
```

Before any frontend live deploy, follow the WOLF-FD deploy marker checks in `/home/alphahs/WOLF-FD/AGENTS.md` / deploy runbooks.

## Current limitation

This v1 does not write back to Google Sheets. It creates local downloadable reports first so results can be reviewed before any sheet update feature is added.
