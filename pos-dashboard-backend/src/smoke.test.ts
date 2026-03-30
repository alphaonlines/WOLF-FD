import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './server';

describe('Smoke Tests', () => {
  it('GET /health should return 200 and ok: true', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: 1 });
  });

  it('GET /api/auth/config should be accessible without auth', async () => {
    const response = await request(app).get('/api/auth/config');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('googleWorkspaceEnabled');
  });

  it('GET /api/report/sales-summary should return 401 without auth', async () => {
    const response = await request(app).get('/api/report/sales-summary');
    expect(response.status).toBe(401);
  });
});
