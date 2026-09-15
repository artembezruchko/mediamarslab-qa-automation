import { test, expect } from '@playwright/test';
import { ApiClient } from '../../src/api/ApiClient';
import { AuthApi } from '../../src/api/AuthApi';
import { endpoints } from '../../src/api/endpoints';
import { randomSuffix } from '../../src/utils/random';

// js/dashboard.js blocks a duplicate tag name and a missing color client-side before ever
// calling the API (see tag-form submit handler) — these two server-side rejections are
// only reachable by calling POST /api/tags directly, bypassing the UI form entirely.
test.describe('API — POST /api/tags validation', () => {
  let token: string;
  test.beforeAll(async () => {
    ({ token } = await AuthApi.createAuthedUser());
  });

  test('TAG-09 P2: creating a tag with a name that already exists is rejected with 409', async () => {
    const client = await ApiClient.create({ token });
    const name = `dupe${randomSuffix()}`;

    const first = await client.raw.post(endpoints.tags, { data: { name, color: '#EF4444' } });
    expect(first.status()).toBe(201);

    const second = await client.raw.post(endpoints.tags, { data: { name, color: '#3B82F6' } });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(body.message).toMatch(/tag already exists/i);

    await client.dispose();
  });

  test('TAG-10 P2: creating a tag with a missing or invalid color is rejected with 400', async () => {
    const client = await ApiClient.create({ token });

    const missing = await client.raw.post(endpoints.tags, { data: { name: `nocolor${randomSuffix()}` } });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).message).toMatch(/invalid tag color/i);

    const invalid = await client.raw.post(endpoints.tags, {
      data: { name: `badcolor${randomSuffix()}`, color: 'notacolor' },
    });
    expect(invalid.status()).toBe(400);
    expect((await invalid.json()).message).toMatch(/invalid tag color/i);

    await client.dispose();
  });
});
