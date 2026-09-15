import { test, expect } from '@playwright/test';
import { AdminPage } from '../../../src/pages/AdminPage';
import { env } from '../../../src/config/env';

// Overrides the "admin" project's pre-authenticated storageState — these tests exercise
// the login form itself and must start unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin — Auth', () => {
  test('ADM-01 P0: valid admin credentials open the users panel', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.login(env.adminEmail, env.adminPassword);

    await expect(admin.panel).toBeVisible();
  });

  test('ADM-02 P1: invalid admin credentials show an error', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.login(env.adminEmail, 'clearly-wrong-password');

    await expect(admin.loginError).toBeVisible();
    await expect(admin.panel).toBeHidden();
  });

  test('ADM-06 P1: logging out returns to the login form', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();
    await admin.login(env.adminEmail, env.adminPassword);
    await expect(admin.panel).toBeVisible();

    await admin.logout();
    await expect(admin.loginSection).toBeVisible();
  });

  test('ADM-07 P2: visiting admin.html without a session shows the login form', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.goto();

    await expect(admin.loginSection).toBeVisible();
    await expect(admin.panel).toBeHidden();
  });
});
