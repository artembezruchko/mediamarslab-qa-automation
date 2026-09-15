import { test, expect } from '@playwright/test';
import { ApplicationsApi } from '../../src/api/ApplicationsApi';

test.describe('API — POST /api/applications', () => {
  test('API-01 P0: valid full name returns an access key and admin credentials', async () => {
    const response = await ApplicationsApi.submit({ fullName: `QA Recon ${Date.now()}` });

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body).toHaveProperty('accessKey');
    expect(typeof body.accessKey).toBe('string');
    expect(body.accessKey).toMatch(/^.+\..+$/); // <id>.<secret>
    expect(body).toHaveProperty('adminEmail');
    expect(body).toHaveProperty('adminPassword');
  });

  test('API-02 P1: empty body is rejected with a validation error', async () => {
    const response = await ApplicationsApi.submit({ fullName: '' });

    expect(response.status(), 'expected a 4xx validation error for an empty full name').toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
