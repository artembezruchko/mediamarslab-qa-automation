import { BasePage } from './BasePage';
import { TestUser } from '../data/users';

/**
 * register.html has no error/status element — failures (duplicate email, etc.) only
 * surface via console.error and by staying on this page. Confirmed via Phase 0 recon
 * of js/register.js.
 */
export class RegisterPage extends BasePage {
  readonly form = this.ui('register-form');
  readonly nameInput = this.ui('register-name');
  readonly emailInput = this.ui('register-email');
  readonly genderSelect = this.ui('register-gender');
  readonly passwordInput = this.ui('register-password');
  readonly photoInput = this.ui('register-photo');
  readonly consentCheckbox = this.ui('register-analytics-consent');
  readonly submitButton = this.form.locator('button[type="submit"]');

  async goto(): Promise<void> {
    await this.page.goto('/register.html');
  }

  /**
   * Registering and unticking the (required) consent checkbox both silently no-op client-side,
   * so this always fills every field and checks consent — there is no valid register flow
   * without it.
   *
   * `photoPath`, if given, uploads via a *separate* endpoint (`POST /api/upload/photo`, not
   * `/api/profile/photo`) that register.js's own submit handler calls before the actual
   * `POST /api/auth/register` — confirmed via Phase 0 recon.
   */
  async register(user: Pick<TestUser, 'name' | 'email' | 'password' | 'gender'>, photoPath?: string): Promise<void> {
    await this.fillFields([
      [this.nameInput, user.name],
      [this.emailInput, user.email],
      [this.passwordInput, user.password],
    ]);
    await this.genderSelect.selectOption(String(user.gender));
    if (photoPath) {
      await this.photoInput.setInputFiles(photoPath);
    }
    await this.consentCheckbox.check();
    await this.submitButton.click();
  }
}
