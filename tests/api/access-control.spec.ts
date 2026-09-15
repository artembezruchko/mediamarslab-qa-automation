import { test, expect } from '@playwright/test';
import { ApiClient } from '../../src/api/ApiClient';
import { AuthApi } from '../../src/api/AuthApi';
import { endpoints } from '../../src/api/endpoints';

// /api/auth/* has a hard 40-requests-per-15-minutes-per-IP limit (see README "API
// contract"), so this file shares ONE authed user across every test that just needs *a*
// valid token, rather than minting a fresh one per test.
let sharedToken: string;
test.beforeAll(async () => {
  ({ token: sharedToken } = await AuthApi.createAuthedUser());
});

// GET /api/todos is used as the representative protected endpoint. All calls here send a
// valid X-Access-Key by default (ApiClient.create()'s default) so these isolate Bearer
// token auth specifically, independent of the X-Access-Key gate covered further below.
test.describe('API — Bearer token access control', () => {
  test('API-03 P0: protected endpoint without an Authorization header is rejected', async () => {
    const client = await ApiClient.create();
    const response = await client.raw.get(endpoints.todos);
    expect(response.status()).toBe(401);
    await client.dispose();
  });

  test('API-04 P1: protected endpoint with an invalid Bearer token is rejected', async () => {
    const client = await ApiClient.create({ token: 'this-is-not-a-valid-jwt' });
    const response = await client.raw.get(endpoints.todos);
    expect(response.status()).toBe(401);
    await client.dispose();
  });

  test('API-04b P1: protected endpoint with a valid token works', async () => {
    const client = await ApiClient.create({ token: sharedToken });
    const response = await client.raw.get(endpoints.todos);
    expect(response.status()).toBe(200);
    await client.dispose();
  });

  test('ADM-08 P1: a regular (non-admin) token is rejected by GET /api/admin/overview', async () => {
    const client = await ApiClient.create({ token: sharedToken });
    const response = await client.raw.get(endpoints.adminOverview);
    expect([401, 403]).toContain(response.status());
    await client.dispose();
  });
});

/**
 * Discrepancy vs. automation-plan.md worth calling out explicitly: X-Access-Key is not
 * checked at all by the app's own frontend (js/*.js never sends it — confirmed via Phase 0
 * recon), yet the backend DOES enforce it server-side on every endpoint except
 * POST /api/applications — just not immediately. Live probing found a per-IP grace quota
 * of keyless requests; early in this session identical requests without any X-Access-Key
 * succeeded, and after enough traffic from the same IP the backend started rejecting them
 * with "Missing X-Access-Key header" (and a garbage key with "Invalid access key"). Since
 * the real app never sends this header, in principle a busy production IP could get
 * legitimate users locked out — which is either an intentional trap in this recruitment
 * exercise or a genuine bug worth flagging either way.
 *
 * Because the quota's exact reset semantics are unknown (this is a shared QA stand and a
 * CI runner's IP may be fresh each run), these two assertions are written tolerant of
 * either state rather than hardcoding one, while still pinning down the exact contract for
 * whichever state is active.
 */
test.describe('API — X-Access-Key gate (grace-quota dependent, see comment above)', () => {
  test('DISC-01 P2: a request with no X-Access-Key either succeeds (grace quota) or is rejected with a specific message', async () => {
    const client = await ApiClient.create({ token: sharedToken, withAccessKey: false });
    const response = await client.raw.get(endpoints.todos);

    expect([200, 401]).toContain(response.status());
    if (response.status() === 401) {
      const body = await response.json();
      expect(body.message).toMatch(/missing x-access-key header/i);
    }
    await client.dispose();
  });

  test('DISC-02 P2: a bogus X-Access-Key either is ignored (grace quota) or rejected with a specific message', async () => {
    const client = await ApiClient.create({ token: sharedToken, accessKeyOverride: 'totally-bogus.key' });
    const response = await client.raw.get(endpoints.todos);

    expect([200, 401]).toContain(response.status());
    if (response.status() === 401) {
      const body = await response.json();
      expect(body.message).toMatch(/invalid access key/i);
    }
    await client.dispose();
  });
});
