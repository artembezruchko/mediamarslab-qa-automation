import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly form = this.ui('login-form');
  readonly emailInput = this.ui('login-email');
  readonly passwordInput = this.ui('login-password');
  readonly submitButton = this.form.locator('button[type="submit"]');
  readonly registerLink = this.page.locator('a[href="/register.html"]');

  async goto(): Promise<void> {
    await this.page.goto('/index.html');
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillFields([
      [this.emailInput, email],
      [this.passwordInput, password],
    ]);
    await this.submitButton.click();
  }
}
