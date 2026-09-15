import path from 'path';
import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { makeUser } from '../../../src/data/users';
import { registerViaUi } from '../../../src/utils/registerViaUi';
import { DashboardPage } from '../../../src/pages/DashboardPage';

const AVATAR_PNG = path.join(__dirname, '../../../src/data/assets/avatar.png');

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth — Register', () => {
  test('AUTH-01 P0: registering with valid data succeeds and emits a register event', async ({
    page,
    registerPage,
    analytics,
  }) => {
    const user = makeUser();
    await registerPage.goto();
    await registerPage.register(user);

    await expect(page).toHaveURL(/dashboard\.html/);
    await analytics.waitForEvent({ type: 'register', email: user.email, name: user.name, gender: user.gender });
  });

  test('AUTH-02 P1: registering with a duplicate email fails and stays on the page', async ({ page, registerPage }) => {
    const user = await registerViaUi(page, registerPage);
    // register.js auto-logs in on success; clear that so the second attempt actually lands
    // on register.html instead of being auto-redirected straight back to the dashboard.
    await page.evaluate(() => localStorage.clear());

    // register.html has no visible error UI (js/register.js only console.error()s on
    // failure) — the only observable signal is that a failed submit never redirects.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await registerPage.goto();
    await registerPage.register(user);

    await expect(page).toHaveURL(/register\.html/);
    await expect.poll(() => consoleErrors.some((text) => /already exists/i.test(text))).toBe(true);
  });

  test('AUTH-03 P1: an invalid email format is rejected by the browser before it reaches the server', async ({
    page,
    registerPage,
  }) => {
    // register-password has no minlength/pattern and the API applies no server-side password
    // policy either (confirmed via recon) — the only client-enforced field is <input type="email">.
    await registerPage.goto();
    await registerPage.nameInput.fill('QA Invalid');
    await registerPage.emailInput.fill('not-an-email');
    await registerPage.passwordInput.fill('123');
    await registerPage.consentCheckbox.check();
    await registerPage.submitButton.click();

    await expect(page).toHaveURL(/register\.html/);
  });

  test('AUTH-09 P1: registering with a photo uploads it and shows a real avatar (not the placeholder)', async ({
    page,
    registerPage,
  }) => {
    const user = makeUser();
    await registerPage.goto();
    await registerPage.register(user, AVATAR_PNG);

    await expect(page).toHaveURL(/dashboard\.html/);
    const dashboardPage = new DashboardPage(page);
    // js/dashboard.js renders an inline SVG initial-letter avatar when there's no photo
    // (same placeholder pattern as PROF-05) — a real upload must not match it.
    await expect(dashboardPage.userPhoto).not.toHaveAttribute('src', /^data:image\/svg\+xml/);
  });

  test('P2: the required analytics consent checkbox blocks submission when unchecked', async ({
    page,
    registerPage,
  }) => {
    const user = makeUser();
    await registerPage.goto();
    await registerPage.nameInput.fill(user.name);
    await registerPage.emailInput.fill(user.email);
    await registerPage.genderSelect.selectOption(String(user.gender));
    await registerPage.passwordInput.fill(user.password);
    // consent left unchecked
    await registerPage.submitButton.click();

    await expect(page).toHaveURL(/register\.html/);
  });
});
