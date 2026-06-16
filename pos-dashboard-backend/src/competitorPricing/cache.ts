import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function getCompetitorPricingDataDir(): string {
  return process.env.COMPETITOR_PRICING_DATA_DIR || path.resolve(process.cwd(), 'data/competitor-pricing');
}

export const COMPETITOR_PRICING_DATA_DIR = getCompetitorPricingDataDir();

export function cacheKey(namespace: string, request: unknown): string {
  const hash = crypto.createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return `${namespace}/${hash}.json`;
}

export function cachePath(namespace: string, request: unknown, baseDir = getCompetitorPricingDataDir()): string {
  return path.join(baseDir, 'cache', cacheKey(namespace, request));
}

export async function readCachedJson<T>(namespace: string, request: unknown, baseDir = getCompetitorPricingDataDir()): Promise<T | null> {
  const file = cachePath(namespace, request, baseDir);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeCachedJson<T>(namespace: string, request: unknown, value: T, baseDir = getCompetitorPricingDataDir()): Promise<T> {
  const file = cachePath(namespace, request, baseDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2));
  return value;
}

export async function cachedJson<T>(
  namespace: string,
  request: unknown,
  loader: () => Promise<T>,
  baseDir = getCompetitorPricingDataDir()
): Promise<T> {
  const cached = await readCachedJson<T>(namespace, request, baseDir);
  if (cached) return cached;
  return writeCachedJson(namespace, request, await loader(), baseDir);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}
