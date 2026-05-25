export function isWolfAiStandalonePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/ai-next' || normalized.indexOf('/ai-next/') === 0 || normalized === '/fd/ai-next' || normalized.indexOf('/fd/ai-next/') === 0;
}
