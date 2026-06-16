import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cachePath, readCachedJson, writeCachedJson } from './cache';

const tmpRoot = path.join(process.cwd(), 'tmp-competitor-pricing-cache-test');

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe('competitorPricing cache', () => {
  it('builds stable hashed paths without raw URLs', () => {
    const request = { url: 'https://furniture4lessnc.com/search?q=B076-280 Trentlore' };
    const first = cachePath('firecrawl', request, tmpRoot);
    const second = cachePath('firecrawl', request, tmpRoot);
    expect(first).toBe(second);
    expect(first).toMatch(/firecrawl\/[a-f0-9]{64}\.json$/);
    expect(first).not.toContain('furniture4lessnc');
    expect(first).not.toContain('B076-280');
  });

  it('writes and reads JSON cache values', async () => {
    const request = { query: 'site:ashleyfurniture.com B076-280' };
    await writeCachedJson('searx', request, { ok: true }, tmpRoot);
    await expect(readCachedJson('searx', request, tmpRoot)).resolves.toEqual({ ok: true });
  });
});
