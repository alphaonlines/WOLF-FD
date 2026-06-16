# Competitor Pricing Upload Workbench Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build an internal FD dashboard page where Anthony can upload a CSV export of `STORE MOVES AND PRICING`, preview/clean the rows, process non-Ashley products first, and export an auditable competitor-pricing report before optionally processing Ashley rows.

**Architecture:** Add a lightweight `Competitor Pricing` workspace inside the existing WOLF-FD React dashboard. The browser handles CSV/XLSX upload and preview, then sends normalized rows to the Node/Express backend. The backend runs a server-side batch job that calls local Firecrawl (`http://127.0.0.1:3002`) and local SearXNG (`http://127.0.0.1:8089`), caches scrapes/searches, confidence-scores matches, and returns downloadable CSV/JSON results.

**Tech Stack:** WOLF-FD Vite + React + TypeScript frontend, Express + TypeScript backend, existing `xlsx` frontend dependency, Node built-in `fetch`, local Firecrawl API, local SearXNG, file-backed job/cache storage for v1.

---

## Why this is a better workflow

The current script approach works, but it is awkward for repeated price checks because every run requires manually exporting the sheet, running CLI scripts, and reading CSV files. A small upload page improves it by making the workflow explicit:

1. Upload the latest CSV/XLSX from Google Sheets.
2. Auto-detect the SKU, vendor, description, price, competitor-price, and remarks columns.
3. Show a split preview:
   - `Non-Ashley first` — process this bucket first to cut the immediate run roughly in half.
   - `Ashley / Ashley-family` — process later with the Ashley-specific SearXNG + Firecrawl product-page workflow.
   - `Manual review` — combined sets, multi-price rows, ambiguous rows.
4. Run only the selected bucket.
5. Watch job progress.
6. Export results as CSV.
7. Only after review, optionally add Google Sheets write-back as a separate phase.

For the user’s immediate idea — “pull everything that’s not an Ashley product first” — v1 should make that the default primary button.

---

## Current context / assumptions

- Main repo: `/home/alphahs/WOLF-FD`
- Frontend: Vite + React + TypeScript
- Backend: `/home/alphahs/WOLF-FD/pos-dashboard-backend`
- Live app route: `https://furnituredistributors.wolf.discount/fd/`
- Live API route prefix: `https://furnituredistributors.wolf.discount/fd/api/`
- Local Firecrawl API: `http://127.0.0.1:3002`
- Local SearXNG API: `http://127.0.0.1:8089/search`
- Existing exploratory files live outside the repo at `/home/alphahs/fd-competitor-pricing/`.
- The newly shared sheet’s active CSV `gid` was `2068090169`.
- The `VENDORS` tab exported successfully with 560 rows and about 483 product rows.
- Useful source columns observed:
  - `SKUs (How to Set Up on Floor)`
  - `DESCRIPTION`
  - `SALES PRICE (STARBURST)`
  - `AHS COMP PRICE`
  - `FFL/ OTHER COMP PRICE`
  - `REG PRICE`
  - `REMARKS`
- Furniture4LessNC search pages scrape cleanly:
  - `https://furniture4lessnc.com/search?q=<query>`
- Ashley search pages return access denied/403 through Firecrawl, but exact Ashley product pages can often be found through SearXNG and then scraped.
- For v1, write local reports only. Do not write back to Google Sheets.

---

## Proposed v1 scope

### Include

- Internal dashboard page for uploading `.csv` and `.xlsx` files.
- Header detection and column mapping preview.
- Product row extraction preserving original sheet row number.
- Ashley-family classification.
- Default `Non-Ashley first` processing mode.
- Server-side batch jobs with progress polling.
- Firecrawl/SearXNG result caching.
- Confidence-scored competitor matches.
- CSV/JSON export of results.
- No Google OAuth requirement.

### Defer

- Writing results back to Google Sheets.
- Scheduled monitoring.
- Fully automatic handling of set/component rows.
- Complex authentication/permissions beyond using existing dashboard access patterns.
- Database persistence. Use file-backed jobs for v1.

---

## Data model

Create shared TypeScript types so frontend and backend agree on row shape.

File: `/home/alphahs/WOLF-FD/types/competitorPricing.ts`

```ts
export type CompetitorPricingColumnMap = {
  vendor: string;
  sku: string;
  description: string;
  storePrice: string;
  regularPrice?: string;
  ahsCompPrice?: string;
  fflCompPrice?: string;
  remarks?: string;
};

export type CompetitorPricingInputRow = {
  sourceRow: number;
  vendor: string;
  sku: string;
  description: string;
  storePriceText: string;
  storePrice: string;
  regularPrice: string;
  existingAhsCompPrice: string;
  existingFflCompPrice: string;
  remarks: string;
  bucket: 'non_ashley' | 'ashley' | 'manual_review';
  rowNotes: string[];
};

export type CompetitorPricingRunMode =
  | 'non_ashley_first'
  | 'ashley_only'
  | 'manual_review'
  | 'all_reliable_rows';

export type CompetitorPricingMatchConfidence =
  | 'high'
  | 'medium'
  | 'low'
  | 'none';

export type CompetitorPricingCompetitorMatch = {
  competitor: 'Ashley' | 'Furniture4LessNC';
  title: string;
  price: string;
  url: string;
  confidence: CompetitorPricingMatchConfidence;
  matchedTokens: string[];
  notes: string[];
};

export type CompetitorPricingResultRow = CompetitorPricingInputRow & {
  ashley?: CompetitorPricingCompetitorMatch;
  furniture4Less?: CompetitorPricingCompetitorMatch;
  lowestReliableCompetitorPrice: string;
  storeMinusLowest: string;
  recommendation: string;
  checkedAt: string;
};

export type CompetitorPricingJobStatus = {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  mode: CompetitorPricingRunMode;
  totalRows: number;
  processedRows: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  resultCsvPath?: string;
  resultJsonPath?: string;
};
```

---

## Backend storage layout

Use file-backed storage for v1 so the feature is easy to inspect and recover.

Create:

```text
/home/alphahs/WOLF-FD/pos-dashboard-backend/data/competitor-pricing/
  uploads/
    <jobId>/source.csv
    <jobId>/normalized-input.json
  jobs/
    <jobId>/status.json
    <jobId>/results.json
    <jobId>/results.csv
  cache/
    firecrawl/<sha256>.json
    searx/<sha256>.json
```

Do not store secrets in these files. Uploaded product/price data is business data; keep it server-local.

---

## Task plan

### Task 1: Add shared competitor pricing types

**Objective:** Create strongly typed contracts for CSV preview, row buckets, jobs, and results.

**Files:**
- Create: `/home/alphahs/WOLF-FD/types/competitorPricing.ts`

**Step 1: Create the type file**

Add the type definitions from the `Data model` section above.

**Step 2: Run TypeScript check/build**

Run:

```bash
cd /home/alphahs/WOLF-FD
npm run build
```

Expected: build succeeds or fails only on pre-existing unrelated issues. If it fails because the new file is unused, that is not a TypeScript error; investigate only real syntax/type failures.

**Step 3: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add types/competitorPricing.ts
git commit -m "feat(pricing): add competitor pricing types"
```

---

### Task 2: Add frontend CSV/XLSX parsing helpers

**Objective:** Parse uploaded CSV/XLSX files, detect headers, map columns, and extract normalized rows.

**Files:**
- Create: `/home/alphahs/WOLF-FD/services/competitorPricingCsv.ts`
- Test: `/home/alphahs/WOLF-FD/services/competitorPricingCsv.test.ts`

**Step 1: Write failing tests**

Create tests covering:

1. The observed `VENDORS` header row.
2. Product extraction with source row number preserved.
3. Non-Ashley bucket classification.
4. Ashley bucket classification.
5. Manual review classification for multi-component rows.

Test skeleton:

```ts
import { describe, expect, it } from 'vitest';
import {
  classifyPricingRow,
  detectCompetitorPricingColumns,
  extractCompetitorPricingRows,
} from './competitorPricingCsv';

const header = [
  'fb476',
  'D',
  'CONTAINER ONLY',
  'MFG BEST SELLER',
  '',
  'WEB DESCR',
  'SKUs                                              (How to Set Up on Floor)',
  'DESCRIPTION',
  'SALES PRICE (STARBURST)',
  'FD5',
  'FD7',
  'G1',
  'CAMP',
  'BASE',
  'REMARKS',
  '335 COST',
  'WHSE COST',
  'AHS COMP PRICE',
  'FFL/ OTHER COMP PRICE',
  'STAR BURST',
  'STARBURST PRICE',
  'STAR BURST GPM%',
  'REG PRICE',
  'GPM%',
];

describe('competitorPricingCsv', () => {
  it('detects observed STORE MOVES columns', () => {
    expect(detectCompetitorPricingColumns(header)).toEqual({
      vendor: 'fb476',
      sku: 'SKUs                                              (How to Set Up on Floor)',
      description: 'DESCRIPTION',
      storePrice: 'SALES PRICE (STARBURST)',
      regularPrice: 'REG PRICE',
      ahsCompPrice: 'AHS COMP PRICE',
      fflCompPrice: 'FFL/ OTHER COMP PRICE',
      remarks: 'REMARKS',
    });
  });

  it('classifies Ashley-family rows as ashley', () => {
    expect(classifyPricingRow({ vendor: 'Ashley', sku: 'B076-280', storePriceText: '$199' })).toBe('ashley');
  });

  it('classifies non-Ashley rows as non_ashley', () => {
    expect(classifyPricingRow({ vendor: 'Albany', sku: '8642-61', storePriceText: '$1499' })).toBe('non_ashley');
  });

  it('classifies set rows and multi-price rows as manual_review', () => {
    expect(classifyPricingRow({ vendor: 'Ashley', sku: 'B1050-31/36/46/54/57/96/92', storePriceText: '7PC Q $1,399 K $1,599' })).toBe('manual_review');
  });
});
```

**Step 2: Run tests to verify failure**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- services/competitorPricingCsv.test.ts
```

Expected: FAIL because helper functions do not exist.

**Step 3: Implement helpers**

Implement:

```ts
export function normalizeHeader(value: string): string;
export function detectCompetitorPricingColumns(headers: string[]): CompetitorPricingColumnMap;
export function classifyPricingRow(row: Pick<CompetitorPricingInputRow, 'vendor' | 'sku' | 'storePriceText'>): CompetitorPricingInputRow['bucket'];
export function extractCompetitorPricingRows(rawRows: string[][], columnMap?: CompetitorPricingColumnMap): CompetitorPricingInputRow[];
```

Classification rules:

```ts
const ASHLEY_VENDOR_ALIASES = [
  'ashley',
  'benchcraft',
  'signature design',
  'signature design by ashley',
  'sierra sleep',
  'millennium',
];

const MANUAL_REVIEW_PATTERNS = [
  /\b\d+\s*pc\b/i,
  /\bset\b/i,
  /\//,
];
```

Bucket logic:

1. If no SKU or no price: `manual_review`.
2. If SKU contains slash-combined components or price text has multiple dollar values: `manual_review`.
3. If vendor contains Ashley-family alias: `ashley`.
4. Else: `non_ashley`.

**Step 4: Run tests to verify pass**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- services/competitorPricingCsv.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add services/competitorPricingCsv.ts services/competitorPricingCsv.test.ts
git commit -m "feat(pricing): parse competitor pricing uploads"
```

---

### Task 3: Build the upload/preview React workspace

**Objective:** Add a page where the user uploads a CSV/XLSX file, sees detected columns, and sees bucket counts before running anything.

**Files:**
- Create: `/home/alphahs/WOLF-FD/components/CompetitorPricingWorkspace.tsx`
- Test: `/home/alphahs/WOLF-FD/components/CompetitorPricingWorkspace.test.tsx`

**Step 1: Write failing UI tests**

Test requirements:

- Renders title `Competitor Pricing`.
- Shows upload control.
- After parsing rows, shows counts for:
  - `Non-Ashley first`
  - `Ashley / Ashley-family`
  - `Manual review`
- Default selected mode is `Non-Ashley first`.
- The run button is disabled until rows are loaded.

**Step 2: Run tests to verify failure**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- components/CompetitorPricingWorkspace.test.tsx
```

Expected: FAIL because component does not exist.

**Step 3: Implement component**

The component should:

- Use `xlsx` to parse uploaded `.csv`, `.xls`, `.xlsx` files in the browser.
- Call `extractCompetitorPricingRows` from `/home/alphahs/WOLF-FD/services/competitorPricingCsv.ts`.
- Render a preview table with first 25 rows.
- Render bucket count cards.
- Render mode buttons:
  - `Run Non-Ashley First`
  - `Run Ashley Later`
  - `Export Preview CSV`
- Do not call backend yet; that comes in a later task.

**Step 4: Run tests to verify pass**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- components/CompetitorPricingWorkspace.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add components/CompetitorPricingWorkspace.tsx components/CompetitorPricingWorkspace.test.tsx
git commit -m "feat(pricing): add upload preview workspace"
```

---

### Task 4: Add the workspace to the FD dashboard navigation

**Objective:** Make the new page accessible from the FD dashboard without disrupting existing modules.

**Files:**
- Modify: `/home/alphahs/WOLF-FD/App.tsx`
- Possibly modify: `/home/alphahs/WOLF-FD/types.ts`
- Possibly modify: `/home/alphahs/WOLF-FD/components/app/NavItem.tsx` only if navigation requires it.

**Step 1: Inspect current navigation pattern**

Read `App.tsx` and identify how modules like `ShopWorkspace`, `ProductSearchWorkspace`, and `ManufacturerPricelistPortal` are registered.

**Step 2: Add nav entry**

Add a new route/workspace label:

```ts
Competitor Pricing
```

Suggested placement: near Shop/Product Search/Smart Calc, because this is a pricing/workflow tool.

**Step 3: Add smoke test or marker check**

If existing app tests cover nav, extend them. Otherwise add a simple marker test that renders `App` and checks for `Competitor Pricing`.

**Step 4: Run tests/build**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- --run
npm run build
```

Expected: tests pass and build succeeds.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add App.tsx types.ts components/app/NavItem.tsx components/CompetitorPricingWorkspace.tsx
git commit -m "feat(pricing): expose competitor pricing workspace"
```

---

### Task 5: Add backend matching utilities

**Objective:** Port the proven SKU normalization and confidence-scoring logic into backend TypeScript.

**Files:**
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/matching.ts`
- Test: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/matching.test.ts`

**Step 1: Write failing tests**

Test cases:

- `B070-71/96` expands to `B070-71`, `B070-96`.
- Exact full dash SKU match is `high`.
- Base token plus description is `medium`.
- Description-only match is `low`.
- 0-results pages and generic price snippets are `none`.
- Multi-component/set rows are flagged as review-needed.

**Step 2: Run tests to verify failure**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/matching.test.ts
```

Expected: FAIL because module does not exist.

**Step 3: Implement matching module**

Functions:

```ts
export function cleanSku(sku: string): string;
export function expandSkuTokens(sku: string): string[];
export function baseTokens(tokens: string[]): string[];
export function classifyCompetitorMatch(args: {
  sourceSku: string;
  sourceDescription: string;
  candidateText: string;
  zeroResults?: boolean;
  blocked?: boolean;
  price?: string;
}): {
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedTokens: string[];
  notes: string[];
};
export function parseFirstPrice(text: string): string;
export function priceToNumber(price: string): number | null;
```

**Step 4: Run tests to verify pass**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/matching.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add pos-dashboard-backend/src/competitorPricing/matching.ts pos-dashboard-backend/src/competitorPricing/matching.test.ts
git commit -m "feat(pricing): add competitor match scoring"
```

---

### Task 6: Add backend Firecrawl/SearXNG clients with cache

**Objective:** Create small backend clients that call local Firecrawl/SearXNG and cache responses by request hash.

**Files:**
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/cache.ts`
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/firecrawlClient.ts`
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/searxClient.ts`
- Test: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/cache.test.ts`

**Step 1: Write cache tests**

Test:

- Same cache key returns same path.
- Cached JSON can be written and read.
- Cache filenames do not contain raw URLs or query strings.

**Step 2: Implement cache utility**

Use Node built-ins only:

```ts
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const COMPETITOR_PRICING_DATA_DIR =
  process.env.COMPETITOR_PRICING_DATA_DIR ||
  path.resolve(process.cwd(), 'data/competitor-pricing');
```

**Step 3: Implement Firecrawl client**

Endpoints:

- `POST http://127.0.0.1:3002/v1/scrape`

Function:

```ts
export async function scrapeWithFirecrawl(url: string): Promise<{
  success: boolean;
  markdown: string;
  title: string;
  statusCode?: number;
  error?: string;
}>;
```

**Step 4: Implement SearXNG client**

Endpoint:

- `GET http://127.0.0.1:8089/search?q=<query>&format=json&language=en-US`

Function:

```ts
export async function searchSearx(query: string): Promise<Array<{
  title: string;
  url: string;
  content: string;
}>>;
```

**Step 5: Run backend tests**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/cache.test.ts
npm run build
```

Expected: PASS/build succeeds.

**Step 6: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add pos-dashboard-backend/src/competitorPricing/cache.ts pos-dashboard-backend/src/competitorPricing/firecrawlClient.ts pos-dashboard-backend/src/competitorPricing/searxClient.ts pos-dashboard-backend/src/competitorPricing/cache.test.ts
git commit -m "feat(pricing): add cached competitor scrape clients"
```

---

### Task 7: Add competitor-specific lookup services

**Objective:** Implement the actual Ashley and Furniture4LessNC lookup strategies.

**Files:**
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/competitors.ts`
- Test: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/competitors.test.ts`

**Step 1: Write tests with mocked clients**

Test:

- Furniture4LessNC query URL uses `https://furniture4lessnc.com/search?q=<sku description>`.
- Furniture4LessNC `0 results for` markdown returns confidence `none`.
- Ashley lookup uses SearXNG first, then scrapes exact Ashley result URLs.
- Ashley direct search URL is not used in v1 because it was observed to 403.

**Step 2: Implement Furniture4LessNC lookup**

Function:

```ts
export async function lookupFurniture4Less(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch>;
```

Rules:

- Query with strongest SKU token plus description.
- Scrape search URL with Firecrawl.
- If markdown contains `0 results for`, return confidence `none`.
- Extract product cards/links/prices from markdown.
- Use `classifyCompetitorMatch` to score.

**Step 3: Implement Ashley lookup**

Function:

```ts
export async function lookupAshley(row: CompetitorPricingInputRow): Promise<CompetitorPricingCompetitorMatch>;
```

Rules:

- Build SearXNG queries like:
  - `site:ashleyfurniture.com B076-280 Trentlore`
- Keep only URLs containing `ashleyfurniture.com`.
- Scrape up to first 5 unique product/result URLs.
- Score each candidate.
- Return best high/medium match, or best low/none for audit notes.

**Step 4: Run tests**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/competitors.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add pos-dashboard-backend/src/competitorPricing/competitors.ts pos-dashboard-backend/src/competitorPricing/competitors.test.ts
git commit -m "feat(pricing): add competitor lookup services"
```

---

### Task 8: Add backend job runner

**Objective:** Process uploaded normalized rows in a background job, write status/progress, and produce CSV/JSON reports.

**Files:**
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/jobs.ts`
- Test: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricing/jobs.test.ts`

**Step 1: Write failing tests**

Test:

- `non_ashley_first` mode only selects rows with bucket `non_ashley`.
- `ashley_only` mode only selects rows with bucket `ashley`.
- Manual review rows are not automatically processed in either default mode.
- Only high/medium matches feed `lowestReliableCompetitorPrice`.
- Result CSV includes source row, SKU, description, store price, competitor URLs, confidence, recommendation, notes.

**Step 2: Implement job runner**

Functions:

```ts
export async function createCompetitorPricingJob(args: {
  rows: CompetitorPricingInputRow[];
  mode: CompetitorPricingRunMode;
}): Promise<CompetitorPricingJobStatus>;

export async function getCompetitorPricingJob(jobId: string): Promise<CompetitorPricingJobStatus>;

export async function runCompetitorPricingJob(jobId: string): Promise<void>;
```

Implementation notes:

- Use `crypto.randomUUID()` for job IDs.
- Write `status.json` before starting.
- Process sequentially or with concurrency 2 max.
- Add 500–1500ms delay between live scrape calls to avoid hammering sites.
- For non-Ashley v1, call Furniture4LessNC first. Do not call Ashley unless mode includes Ashley rows.
- For Ashley rows, call Ashley lookup and Furniture4LessNC lookup.
- Write progress after each row.
- Write `results.json` and `results.csv` at completion.

**Step 3: Run tests**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricing/jobs.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add pos-dashboard-backend/src/competitorPricing/jobs.ts pos-dashboard-backend/src/competitorPricing/jobs.test.ts
git commit -m "feat(pricing): add competitor pricing job runner"
```

---

### Task 9: Add backend API routes

**Objective:** Expose job creation, status polling, and downloads to the frontend.

**Files:**
- Create: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/routes/competitorPricingRoutes.ts`
- Modify: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/routeWiring.ts`
- Test: `/home/alphahs/WOLF-FD/pos-dashboard-backend/src/competitorPricingRoutes.test.ts`

**Step 1: Write route tests**

Endpoints:

```text
POST /api/competitor-pricing/jobs
GET  /api/competitor-pricing/jobs/:jobId
GET  /api/competitor-pricing/jobs/:jobId/results.csv
GET  /api/competitor-pricing/jobs/:jobId/results.json
```

Test:

- `POST` rejects empty rows.
- `POST` accepts rows and mode, returns job ID.
- `GET status` returns progress.
- Download endpoints reject missing/unknown job IDs.

**Step 2: Implement routes**

Route body for job creation:

```ts
{
  "mode": "non_ashley_first",
  "rows": [/* CompetitorPricingInputRow[] */]
}
```

Important: validate body size and row count.

Suggested v1 limits:

- Max rows per job: 600
- Max JSON body: match existing Express JSON limit or set route-specific limit if needed.

**Step 3: Wire routes**

In `routeWiring.ts`, mount:

```ts
app.use('/api/competitor-pricing', competitorPricingRoutes);
```

Use the project’s existing route pattern.

**Step 4: Run tests/build**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test -- src/competitorPricingRoutes.test.ts
npm run build
```

Expected: PASS/build succeeds.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add pos-dashboard-backend/src/routes/competitorPricingRoutes.ts pos-dashboard-backend/src/routeWiring.ts pos-dashboard-backend/src/competitorPricingRoutes.test.ts
git commit -m "feat(pricing): expose competitor pricing job API"
```

---

### Task 10: Add frontend API client and job progress UI

**Objective:** Connect the upload page to backend jobs and show progress/results downloads.

**Files:**
- Create: `/home/alphahs/WOLF-FD/services/competitorPricingApi.ts`
- Modify: `/home/alphahs/WOLF-FD/components/CompetitorPricingWorkspace.tsx`
- Test: `/home/alphahs/WOLF-FD/components/CompetitorPricingWorkspace.test.tsx`

**Step 1: Add API client**

Functions:

```ts
export async function createCompetitorPricingJob(args: {
  mode: CompetitorPricingRunMode;
  rows: CompetitorPricingInputRow[];
}): Promise<CompetitorPricingJobStatus>;

export async function getCompetitorPricingJob(jobId: string): Promise<CompetitorPricingJobStatus>;

export function getCompetitorPricingDownloadUrl(jobId: string, format: 'csv' | 'json'): string;
```

Use the existing app API base convention from other `services/*Api.ts` files.

**Step 2: Update workspace UI**

When user clicks `Run Non-Ashley First`:

- Filter rows to `bucket === 'non_ashley'`.
- POST job.
- Poll status every 2 seconds.
- Show:
  - processed count
  - total count
  - current status
  - download links when complete

**Step 3: Add warning copy**

Show copy near the run button:

```text
Non-Ashley first skips Ashley-family rows and manual-review set rows. This is intended to get the first competitor report faster. Ashley rows can be run after this batch finishes.
```

**Step 4: Test**

Mock API calls and verify:

- Run button posts only non-Ashley rows.
- Progress text updates.
- Download link appears on completed job.

Run:

```bash
cd /home/alphahs/WOLF-FD
npm run test -- components/CompetitorPricingWorkspace.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add services/competitorPricingApi.ts components/CompetitorPricingWorkspace.tsx components/CompetitorPricingWorkspace.test.tsx
git commit -m "feat(pricing): run competitor pricing jobs from UI"
```

---

### Task 11: Add CSV export preview and result review UX

**Objective:** Make the uploaded/processed data auditable before and after scraping.

**Files:**
- Modify: `/home/alphahs/WOLF-FD/components/CompetitorPricingWorkspace.tsx`
- Possibly create: `/home/alphahs/WOLF-FD/components/competitor-pricing/CompetitorPricingPreviewTable.tsx`
- Possibly create: `/home/alphahs/WOLF-FD/components/competitor-pricing/CompetitorPricingBucketCards.tsx`

**Step 1: Split large component if needed**

If `CompetitorPricingWorkspace.tsx` exceeds ~300 lines, split:

- `CompetitorPricingBucketCards.tsx`
- `CompetitorPricingPreviewTable.tsx`
- `CompetitorPricingJobPanel.tsx`

**Step 2: Add preview table columns**

Display:

- source row
- bucket
- vendor
- SKU
- description
- store price text
- regular price
- existing AHS comp
- existing FFL comp
- row notes

**Step 3: Add export preview button**

Export normalized rows before scraping. This helps Anthony sanity-check what will be processed.

**Step 4: Run tests/build**

```bash
cd /home/alphahs/WOLF-FD
npm run test -- --run
npm run build
```

Expected: PASS/build succeeds.

**Step 5: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add components/CompetitorPricingWorkspace.tsx components/competitor-pricing services/competitorPricingCsv.ts
git commit -m "feat(pricing): improve competitor pricing review UI"
```

---

### Task 12: Add operational checks and docs

**Objective:** Document how to use and troubleshoot the tool.

**Files:**
- Create: `/home/alphahs/WOLF-FD/docs/operations/Competitor-Pricing-Workbench.md`

**Step 1: Write docs**

Include:

- How to export CSV from Google Sheets.
- How to upload CSV in the dashboard.
- What `Non-Ashley first` means.
- What confidence scores mean.
- Why manual-review rows are skipped.
- How to check Firecrawl:

```bash
curl -sS http://127.0.0.1:3002/
```

- How to test Hermes/Firecrawl MCP if needed:

```bash
hermes mcp test firecrawl
```

- Where backend job results are stored:

```text
/home/alphahs/WOLF-FD/pos-dashboard-backend/data/competitor-pricing/jobs/
```

**Step 2: Commit**

```bash
cd /home/alphahs/WOLF-FD
git add docs/operations/Competitor-Pricing-Workbench.md
git commit -m "docs(pricing): document competitor pricing workbench"
```

---

### Task 13: End-to-end local validation

**Objective:** Prove the complete upload-to-report flow works locally before deploy.

**Files:**
- No new files expected.

**Step 1: Verify Firecrawl is running**

```bash
cd /home/alphahs/firecrawl-selfhost
docker compose ps
curl -sS http://127.0.0.1:3002/
```

Expected:

```json
{"message":"Firecrawl API","documentation_url":"https://docs.firecrawl.dev"}
```

**Step 2: Verify backend builds**

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test
npm run build
```

Expected: tests pass and build succeeds.

**Step 3: Verify frontend builds**

```bash
cd /home/alphahs/WOLF-FD
npm run test
npm run build
```

Expected: tests pass and build succeeds.

**Step 4: Manual browser flow**

Run local dev server if appropriate:

```bash
cd /home/alphahs/WOLF-FD
npm run dev
```

Then:

1. Open the FD dashboard locally.
2. Go to `Competitor Pricing`.
3. Upload `/home/alphahs/fd-competitor-pricing/source-gid-2068090169.csv`.
4. Confirm bucket counts are plausible:
   - Non-Ashley count is substantial.
   - Ashley count is substantial.
   - Manual-review rows contain slash SKUs / multi-price rows.
5. Click `Run Non-Ashley First`.
6. Confirm progress increments.
7. Download CSV.
8. Confirm result rows include competitor URLs and confidence.

**Step 5: Commit any final fixes**

```bash
cd /home/alphahs/WOLF-FD
git status --short
git diff --check
git add <only intended files>
git commit -m "test(pricing): validate competitor pricing workbench"
```

Only commit if there are actual code/test/doc fixes.

---

### Task 14: Production deployment plan

**Objective:** Deploy safely without disturbing unrelated WOLF-FD modules.

**Files:**
- No source changes expected.

**Step 1: Backend deploy**

Because new backend routes are added:

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run build
pm2 restart pos-api
```

Verify:

```bash
curl -sS -H 'Host: furnituredistributors.wolf.discount' https://127.0.0.1/fd/api/health
```

Expected: healthy response from API.

**Step 2: Frontend deploy safety build**

Follow existing WOLF-FD deploy safety markers before replacing live frontend.

```bash
cd /home/alphahs/WOLF-FD
npm run build
for m in "Finance Cost" "fd-sales-analysis-card-order" "SHOP_CALCULATOR" "AMP_FDCONNECT" "AMP_KIOSKS"; do
  grep -R "$m" dist/assets/*.js >/dev/null || { echo "Missing marker: $m"; exit 1; }
done
```

Expected: all markers present.

**Step 3: Backup live frontend**

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
sudo rsync -a /srv/www/wolf.discount/fd/ /home/alphahs/backups/wolf-fd-live-before-competitor-pricing-$STAMP/
```

**Step 4: Deploy frontend**

```bash
sudo rsync -a --delete /home/alphahs/WOLF-FD/dist/ /srv/www/wolf.discount/fd/
```

**Step 5: Verify live**

```bash
curl -sS https://furnituredistributors.wolf.discount/fd/ | head
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

Manual browser check:

1. Open `https://furnituredistributors.wolf.discount/fd/`.
2. Confirm `Competitor Pricing` appears.
3. Upload a small CSV sample.
4. Start a small non-Ashley job.
5. Download result CSV.

---

## Risks and mitigations

### Risk: Ashley-family classification may miss aliases

Mitigation: Make the alias list visible/editable in code first, then consider a UI setting later. Start with `Ashley`, `Benchcraft`, `Signature Design`, `Sierra Sleep`, and `Millennium`.

### Risk: Competitor pages change structure

Mitigation: Rely on confidence scoring, keep raw scrape cache, include source URLs in reports, and never auto-apply low-confidence matches.

### Risk: Set/component rows produce misleading price comparisons

Mitigation: Default these to `manual_review`. Only process them if Anthony intentionally selects them later.

### Risk: Long jobs timeout HTTP requests

Mitigation: Job creation returns immediately. Processing happens server-side; UI polls status.

### Risk: Firecrawl unavailable

Mitigation: Backend route should return a clear error: `Firecrawl local API unavailable at http://127.0.0.1:3002`. UI should show this plainly.

### Risk: Exposing sensitive business data

Mitigation: Keep upload/job files local on the server. Do not send uploaded CSVs to third-party APIs beyond scraping public competitor pages. Do not write back to Google Sheets in v1.

---

## Open questions for Anthony

1. Which vendors count as `Ashley-family` besides `Ashley` itself?
   - Suggested defaults: Ashley, Benchcraft, Signature Design, Sierra Sleep, Millennium.
2. For non-Ashley products, should v1 compare only Furniture4LessNC, or also run broader web search?
   - Recommended v1: Furniture4LessNC only, because Ashley is not useful for non-Ashley SKUs.
3. Should the page live as a full FD dashboard module, or as a smaller tool under Shop/Product Search?
   - Recommended v1: full module named `Competitor Pricing`, placed near Shop/Product Search.
4. Do you want the output to be only a downloadable CSV first?
   - Recommended v1: yes. Sheet write-back should be separate and approval-gated.

---

## Acceptance criteria

- User can upload the latest Google Sheets CSV export from the dashboard.
- The page shows row counts for non-Ashley, Ashley, and manual-review buckets.
- The default run mode processes only non-Ashley rows.
- The backend job runs without blocking the browser request.
- The UI shows job progress.
- The result CSV includes source row, vendor, SKU, description, store price, competitor price, URL, confidence, recommendation, and notes.
- Low/none confidence matches do not feed automatic lowest-price calculations.
- Manual-review rows are skipped unless explicitly selected in a later phase.
- Build and tests pass.
- Live deploy follows WOLF-FD marker and backup rules.

---

## Recommended implementation order

1. Shared types.
2. CSV parsing and bucket classification tests.
3. Upload/preview UI.
4. Backend match scoring tests.
5. Firecrawl/SearXNG cached clients.
6. Competitor lookup services.
7. Job runner.
8. API routes.
9. UI job progress and downloads.
10. Docs and deployment.

This order lets Anthony get value early: the first visible milestone is the upload page showing that the `Non-Ashley first` filter really cuts the list down before any scraping is run.
