import { Page, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';
import { TestUser, makeUser } from '../data/users';

/**
 * Registers a fresh unique user through the real register form and waits for register.js's
 * auto-login redirect to land on dashboard.html. For test *setup* only — tests that exercise
 * the register mechanics themselves (AUTH-01/02/03, the required-consent case) call
 * `registerPage.register()` directly instead, so the thing actually under test stays visible
 * at the call site rather than hidden inside a helper.
 */
export async function registerViaUi(
  page: Page,
  registerPage: RegisterPage,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const user = makeUser(overrides);
  await registerPage.goto();
  await registerPage.register(user);
  await expect(page).toHaveURL(/dashboard\.html/);
  return user;
}
