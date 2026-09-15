import { test, expect } from '@playwright/test';
import { ApiClient } from '../../src/api/ApiClient';
import { AuthApi } from '../../src/api/AuthApi';
import { endpoints } from '../../src/api/endpoints';

// A well-formed but non-existent Mongo ObjectId — distinct from a malformed one, which the
// API rejects earlier with a different error (see API-11).
const NONEXISTENT_ID = '000000000000000000000000';

test.describe('API — /api/todos/:id contract for a non-existent id', () => {
  let token: string;
  test.beforeAll(async () => {
    ({ token } = await AuthApi.createAuthedUser());
  });

  test('API-10 P2: PATCH and DELETE on a well-formed but non-existent id both return 404', async () => {
    const client = await ApiClient.create({ token });

    const patchResponse = await client.raw.patch(endpoints.todo(NONEXISTENT_ID), { data: { completed: true } });
    expect(patchResponse.status()).toBe(404);
    expect((await patchResponse.json()).message).toMatch(/todo not found/i);

    const deleteResponse = await client.raw.delete(endpoints.todo(NONEXISTENT_ID));
    expect(deleteResponse.status()).toBe(404);
    expect((await deleteResponse.json()).message).toMatch(/todo not found/i);

    await client.dispose();
  });

  test('API-11 P2: a malformed (non-ObjectId) id is rejected with 400, not 404', async () => {
    const client = await ApiClient.create({ token });

    const response = await client.raw.patch(endpoints.todo('not-a-valid-objectid'), { data: { completed: true } });

    expect(response.status()).toBe(400);
    expect((await response.json()).message).toMatch(/invalid todo id/i);

    await client.dispose();
  });
});
