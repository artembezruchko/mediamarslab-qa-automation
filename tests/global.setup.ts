import { test as setup } from '@playwright/test';
import { AdminPage } from '../src/pages/AdminPage';
import { env } from '../src/config/env';

const ADMIN_AUTH_FILE = '.auth/admin.json';

// Only admin needs a shared, once-per-run storageState: the "admin" project reads pre-
// existing overview data rather than mutating per-test state, so sharing one session across
// its tests is safe (unlike dashboard/profile, which provision a fresh user per test — see
// base.fixture.ts — to avoid tests stepping on each other's todos/tags/consent settings).
setup('authenticate as admin', async ({ page }) => {
  const adminPage = new AdminPage(page);
  await adminPage.goto();
  await adminPage.login(env.adminEmail, env.adminPassword);
  await adminPage.panel.waitFor({ state: 'visible' });

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
