import { test, expect } from '../../src/fixtures/analytics.fixture';
import { registerViaUi } from '../../src/utils/registerViaUi';
import { randomSuffix } from '../../src/utils/random';
import { DashboardPage } from '../../src/pages/DashboardPage';
import { ProfilePage } from '../../src/pages/ProfilePage';

test.use({ storageState: { cookies: [], origins: [] } });

// DashboardPage/ProfilePage are constructed directly here rather than via the
// `dashboardPage`/`profilePage` fixtures — those fixtures provision their own separate user
// via addInitScript, which would trip register.html's "already logged in" redirect before
// this test's own manual register/login flow runs. These tests manage one user end-to-end.
test.describe('E2E — Full flow with analytics verification', () => {
  test('E2E-01 P0: register -> login -> create -> complete -> edit -> delete -> logout, each step logged', async ({
    page,
    loginPage,
    registerPage,
    analytics,
  }) => {
    const dashboardPage = new DashboardPage(page);

    const user = await registerViaUi(page, registerPage); // register.js auto-logs in
    await analytics.waitForEvent({ type: 'register', email: user.email });

    // Exercise the login step explicitly (as its own analytics-producing action) by
    // clearing the session register.js just established.
    await page.evaluate(() => localStorage.clear());
    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    await analytics.waitForEvent({ type: 'login', status: 'success', email: user.email });

    await dashboardPage.goto();
    await dashboardPage.waitForLoaded();
    const text = `E2E note ${randomSuffix()}`;
    await dashboardPage.addTodo(text);
    await analytics.waitForEvent({ type: 'todoCreate', email: user.email });

    await dashboardPage.toggleComplete(text);
    await analytics.waitForEvent({ type: 'todoComplete', email: user.email });

    const updated = `${text} edited`;
    await dashboardPage.editTodo(text, updated);
    await analytics.waitForEvent({ type: 'todoEdit', email: user.email });

    await dashboardPage.openDeleteModalFor(updated);
    await dashboardPage.confirmDelete();
    await analytics.waitForEvent({ type: 'todoDelete', email: user.email });

    await dashboardPage.logout();
    await expect(page).toHaveURL(/index\.html/);
    await analytics.waitForEvent({ type: 'logout', email: user.email });
  });

  test('E2E-02 P1: disabling consent stops event writes, re-enabling resumes them', async ({
    page,
    registerPage,
    analytics,
  }) => {
    const profilePage = new ProfilePage(page);
    const dashboardPage = new DashboardPage(page);

    const user = await registerViaUi(page, registerPage);

    await profilePage.goto();
    await profilePage.setAnalyticsConsent(false);
    await profilePage.save();
    await expect(page).toHaveURL(/dashboard\.html/);
    await analytics.waitForEvent({ type: 'analyticsConsentChange', email: user.email, analyticsConsent: false });

    await dashboardPage.waitForLoaded();
    const silentText = `Silent note ${randomSuffix()}`;
    await dashboardPage.addTodo(silentText);
    await analytics.assertNoEvent({ type: 'todoCreate', email: user.email });

    await profilePage.goto();
    await profilePage.setAnalyticsConsent(true);
    await profilePage.save();
    await expect(page).toHaveURL(/dashboard\.html/);
    await analytics.waitForEvent({ type: 'analyticsConsentChange', email: user.email, analyticsConsent: true });

    await dashboardPage.waitForLoaded();
    const loudText = `Loud note ${randomSuffix()}`;
    await dashboardPage.addTodo(loudText);
    await analytics.waitForEvent({ type: 'todoCreate', email: user.email });
  });
});
