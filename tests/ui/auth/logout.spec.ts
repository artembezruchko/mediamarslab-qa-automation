import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { registerViaUi } from '../../../src/utils/registerViaUi';
import { DashboardPage } from '../../../src/pages/DashboardPage';

// No storageState override here: the "auth-ui" project has no project-level storageState
// to begin with (only "admin" does), so there's nothing to clear.

test.describe('Auth — Logout', () => {
  test('AUTH-07 P0: logout redirects to login and clears the session', async ({ page, registerPage, analytics }) => {
    const user = await registerViaUi(page, registerPage);

    // Constructed directly (not via the `dashboardPage` fixture) — that fixture provisions
    // its own separate user via addInitScript, which would fire before registerViaUi()
    // above and trip register.html's "already logged in" redirect.
    const dashboardPage = new DashboardPage(page);
    // We arrived here via register.js's own `window.location.href` redirect, not a
    // Playwright page.goto() — `toHaveURL` inside registerViaUi only confirms the URL
    // changed, not that dashboard.js's DOMContentLoaded handler (which binds logout's click
    // listener, among others) has run yet. Confirmed via a real hang: clicking immediately
    // after the URL check landed on the button before that binding happened, silently doing
    // nothing.
    await page.waitForLoadState('domcontentloaded');
    await dashboardPage.logout();

    await expect(page).toHaveURL(/index\.html/);
    await analytics.waitForEvent({ type: 'logout', email: user.email });

    await page.goto('/dashboard.html');
    await expect(page).toHaveURL(/index\.html/);
  });
});
