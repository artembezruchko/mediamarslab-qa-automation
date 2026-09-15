import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { LoginPage } from '../../../src/pages/LoginPage';
import { ProfilePage } from '../../../src/pages/ProfilePage';
import { AuthApi } from '../../../src/api/AuthApi';
import { ApiClient } from '../../../src/api/ApiClient';
import { endpoints } from '../../../src/api/endpoints';

test.describe('Profile — Password change', () => {
  test.beforeEach(async ({ profilePage }) => {
    await profilePage.goto();
    await profilePage.openPasswordModal();
  });

  test('PROF-07 P0: valid password change succeeds and emits passwordChangeSuccess', async ({
    profilePage,
    analytics,
  }) => {
    const newPassword = `NewPass${Date.now()}`;
    await profilePage.changePassword(newPassword, newPassword);

    await analytics.waitForEvent({ type: 'passwordChangeSuccess' });
  });

  // Mismatched passwords are caught client-side (js/profile.js compares them before ever
  // calling the API), so this never reaches the server and never emits an analytics event.
  test('PROF-08a P1: mismatched passwords fail client-side with no API call and no event', async ({
    profilePage,
    analytics,
  }) => {
    await profilePage.changePassword('MismatchOne1', 'MismatchTwo2');

    await expect(profilePage.passwordFormMessage).toHaveText(/пароли не совпадают/i);
    await analytics.assertNoEvent({ type: 'passwordChangeFailed' });
  });

  test('PROF-12 P2: Cancel and the × button both close the modal without changing the password', async ({
    profilePage,
    analytics,
  }) => {
    await profilePage.newPasswordInput.fill('ShouldNotPersist1');
    await profilePage.confirmPasswordInput.fill('ShouldNotPersist1');
    await profilePage.passwordModalCancel.click();

    await expect(profilePage.passwordModal).toBeHidden();
    await analytics.assertNoEvent({ type: 'passwordChangeSuccess' }, { timeoutMs: 5_000 });

    await profilePage.openPasswordModal();
    // openPasswordModal() (js/profile.js) clears both fields on every open — re-asserting
    // that here would just be testing the app's own reset logic, not this test's behavior.
    await profilePage.closePasswordModal();

    await expect(profilePage.passwordModal).toBeHidden();
    await analytics.assertNoEvent({ type: 'passwordChangeSuccess' }, { timeoutMs: 5_000 });
  });
});

/**
 * PROF-09 needs to fully log out and back in mid-test, which the `profilePage` fixture
 * can't support: it seeds the session via `page.addInitScript()`, which re-injects the
 * worker's token on *every* subsequent navigation in this page — including the login
 * page reached after `localStorage.clear()`, silently undoing the clear. This test manages
 * its own dedicated session via a one-time `page.evaluate()` instead, which a later
 * `localStorage.clear()` actually removes for good.
 */
test.describe('Profile — Password change (own session, re-login required)', () => {
  test('PROF-09 P0: after changing password, login works with the new one and not the old one', async ({
    page,
    analytics,
  }) => {
    const { user, token } = await AuthApi.createAuthedUser();
    await page.goto('/index.html');
    await page.evaluate((t) => window.localStorage.setItem('token', t), token);

    const profilePage = new ProfilePage(page);
    await profilePage.goto();
    await profilePage.openPasswordModal();

    const newPassword = `NewPass${Date.now()}`;
    await profilePage.changePassword(newPassword, newPassword);
    await analytics.waitForEvent({ type: 'passwordChangeSuccess', email: user.email });

    await page.evaluate(() => window.localStorage.clear());

    const login = new LoginPage(page);
    await login.goto();
    await login.login(user.email, newPassword);
    await expect(page).toHaveURL(/dashboard\.html/);

    await page.evaluate(() => window.localStorage.clear());
    await login.goto();
    await login.login(user.email, 'definitely-the-old-wrong-password');
    await expect(page).toHaveURL(/index\.html/);
  });
});

// `profile-new-password`/`profile-confirm-password` both have HTML `minlength="6"`, so the
// browser blocks submitting a genuinely too-short password before js/profile.js's submit
// handler (or the server) ever sees it — the server-side "at least 6 characters" rejection
// is only reachable by calling the API directly, bypassing the UI form entirely.
test.describe('Profile — Password change (API, bypasses client minlength)', () => {
  test('PROF-08b P1: a too-short password fails server-side and emits passwordChangeFailed', async ({ analytics }) => {
    const { user, token } = await AuthApi.createAuthedUser();
    const client = await ApiClient.create({ token });

    const response = await client.raw.post(endpoints.profilePassword, {
      data: { newPassword: '123', confirmPassword: '123' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.message).toMatch(/at least 6 characters/i);

    const event = await analytics.waitForEvent({ type: 'passwordChangeFailed', email: user.email });
    expect(event.reason).toBeTruthy();

    await client.dispose();
  });
});
