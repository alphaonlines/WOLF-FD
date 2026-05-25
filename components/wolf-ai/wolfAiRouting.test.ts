import { describe, expect, it } from 'vitest';
import { isWolfAiStandalonePath } from './wolfAiRouting';

describe('isWolfAiStandalonePath', () => {
  it('routes /ai-next paths to the standalone WOLF AI shell', () => {
    expect(isWolfAiStandalonePath('/ai-next')).toBe(true);
    expect(isWolfAiStandalonePath('/ai-next/')).toBe(true);
    expect(isWolfAiStandalonePath('/ai-next/playground')).toBe(true);
    expect(isWolfAiStandalonePath('/fd/ai-next')).toBe(true);
  });

  it('does not hijack the existing dashboard or live /ai route yet', () => {
    expect(isWolfAiStandalonePath('/fd/')).toBe(false);
    expect(isWolfAiStandalonePath('/fd/dashboard')).toBe(false);
    expect(isWolfAiStandalonePath('/ai/')).toBe(false);
  });
});
