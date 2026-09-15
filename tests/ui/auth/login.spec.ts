import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { registerViaUi } from '../../../src/utils/registerViaUi';

// Overrides the default project storageState — auth tests must start unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth — Login', () => {
  test('AUTH-04 P0: valid credentials land on the dashboard and emit a successful login event', async ({
    page,
    loginPage,
    registerPage,
    analytics,
  }) => {
    const user = await registerViaUi(page, registerPage);
    // Session lives in localStorage.token, not cookies — register.js auto-logs the user in,
    // so this must be cleared before the login form can be exercised standalone.
    await page.evaluate(() => localStorage.clear());

    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    await expect(page).toHaveURL(/dashboard\.html/);
    await analytics.waitForEvent({ type: 'login', status: 'success', email: user.email });
  });

  test('AUTH-05 P0: wrong password fails and emits a failed login event with a reason', async ({
    page,
    loginPage,
    registerPage,
    analytics,
  }) => {
    const user = await registerViaUi(page, registerPage);
    await page.evaluate(() => localStorage.clear());

    await loginPage.goto();
    await loginPage.login(user.email, 'definitely-wrong-password');

    await expect(page).toHaveURL(/index\.html/);
    const event = await analytics.waitForEvent({ type: 'login', status: 'failed', email: user.email });
    expect(event.reason).toBeTruthy();
  });

  test('AUTH-06 P1: unknown email fails login and emits a failed login event', async ({
    page,
    loginPage,
    analytics,
  }) => {
    await loginPage.goto();
    await loginPage.login(`no-such-user-${Date.now()}@example.com`, 'whatever-password');

    await expect(page).toHaveURL(/index\.html/);
    await analytics.waitForEvent({ type: 'login', status: 'failed' });
  });

  test('AUTH-08 P1: visiting the dashboard without a session redirects to login', async ({ page }) => {
    await page.goto('/dashboard.html');

    await expect(page).toHaveURL(/index\.html/);
  });

  test('AUTH-10 P1: visiting the profile page without a session redirects to login', async ({ page }) => {
    await page.goto('/profile.html');

    await expect(page).toHaveURL(/index\.html/);
  });
});
