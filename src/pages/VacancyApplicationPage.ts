import { BasePage } from './BasePage';

/**
 * Confirmed via Phase 0 recon. Prefer ApplicationsApi.submit() for test data setup (this
 * endpoint is rate-limited per IP — see README "Known limitations"); this POM exists for the
 * one UI scenario that specifically needs to exercise the form.
 */
export class VacancyApplicationPage extends BasePage {
  readonly form = this.ui('vacancy-form');
  readonly fullNameInput = this.ui('vacancy-full-name');
  readonly submitButton = this.form.locator('button[type="submit"]');
  readonly errorBox = this.ui('vacancy-error');

  readonly resultBox = this.ui('vacancy-result');
  readonly accessKeyDisplay = this.ui('vacancy-access-key');
  readonly adminEmailDisplay = this.ui('vacancy-admin-email');
  readonly adminPasswordDisplay = this.ui('vacancy-admin-password');

  async goto(): Promise<void> {
    await this.page.goto('/vacancy-application.html');
  }

  async submit(fullName: string): Promise<void> {
    await this.fullNameInput.fill(fullName);
    await this.submitButton.click();
  }
}
