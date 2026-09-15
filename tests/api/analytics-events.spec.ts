import { test, expect, request as playwrightRequest } from '@playwright/test';
import { AnalyticsApi } from '../../src/api/AnalyticsApi';
import { env } from '../../src/config/env';
import { endpoints } from '../../src/api/endpoints';

test.describe('API — GET /api/analytics/events', () => {
  test('API-05 P0: X-Access-Key + HTTP Basic together returns 200 and an array', async () => {
    const api = await AnalyticsApi.create();
    const response = await api.getRawResponse();
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    await api.dispose();
  });

  test('API-06 P1: no Authorization header at all is rejected', async () => {
    const api = await AnalyticsApi.create({ withBasicAuth: false });
    const response = await api.getRawResponse();
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toMatch(/missing or invalid authorization header/i);
    await api.dispose();
  });

  test('API-06b P1: wrong Basic password is rejected', async () => {
    const token = Buffer.from(`${env.analyticsBasicUser}:definitely-wrong-password`).toString('base64');
    const context = await playwrightRequest.newContext({
      baseURL: env.apiBaseUrl,
      extraHTTPHeaders: { Authorization: `Basic ${token}`, 'X-Access-Key': env.accessKey },
    });
    const response = await context.get(endpoints.analyticsEvents);
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.message).toMatch(/invalid authentication credentials/i);
    await context.dispose();
  });

  /**
   * automation-plan.md (0.7) says both X-Access-Key and Basic are required together. Live
   * probing confirmed exactly that — but only once a per-IP grace quota of keyless requests
   * is exhausted; early in a fresh run, Basic alone is enough (see access-control.spec.ts
   * DISC-01/02 for the full writeup). Written tolerant of either state for the same reason.
   */
  test('API-07 P1: Basic auth without X-Access-Key either succeeds (grace quota) or is rejected with a specific message', async () => {
    const api = await AnalyticsApi.create({ withBasicAuth: true, withAccessKey: false });
    const response = await api.getRawResponse();
    expect([200, 401]).toContain(response.status());
    if (response.status() === 401) {
      const body = await response.json();
      expect(body.message).toMatch(/missing x-access-key header/i);
    }
    await api.dispose();
  });

  test('API-08 P2: every event has a valid type and, where present, a valid status', async () => {
    const api = await AnalyticsApi.create();
    const events = await api.getEvents();

    for (const event of events) {
      expect(typeof event.type).toBe('string');
      expect(event.type.length).toBeGreaterThan(0);
      if (event.status !== undefined) {
        expect(['success', 'failed']).toContain(event.status);
      }
    }
    await api.dispose();
  });

  test('API-09 P2: returned events are within the last 24 hours', async () => {
    const api = await AnalyticsApi.create();
    const events = await api.getEvents();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    for (const event of events) {
      if (!event.timestamp) continue;
      const ts = new Date(event.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(cutoff);
    }
    await api.dispose();
  });
});
