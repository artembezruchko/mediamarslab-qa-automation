import { BasePage } from './BasePage';

export class AdminPage extends BasePage {
  readonly loginSection = this.ui('admin-login-section');
  readonly loginForm = this.ui('admin-login-form');
  readonly emailInput = this.ui('admin-email');
  readonly passwordInput = this.ui('admin-password');
  readonly loginError = this.ui('admin-login-error');

  readonly panel = this.ui('admin-panel');
  readonly logoutButton = this.ui('admin-logout');
  readonly overviewError = this.ui('admin-overview-error');
  readonly userSearchInput = this.ui('admin-user-search');
  readonly usersList = this.ui('admin-users');
  readonly pagination = this.ui('admin-pagination');

  readonly jsonModal = this.ui('admin-json-modal');
  readonly jsonModalCode = this.ui('admin-json-modal-code');
  readonly jsonModalClose = this.ui('admin-json-modal-close');
  readonly jsonModalBackdrop = this.ui('admin-json-modal-backdrop');

  // Rendered dynamically by js/admin.js (confirmed via Phase 0 recon), default page size 5.
  readonly pagePrev = this.ui('admin-page-prev');
  readonly pageNext = this.ui('admin-page-next');
  readonly showEventJsonButtons = this.ui('admin-show-event-json');

  async goto(): Promise<void> {
    await this.page.goto('/admin.html');
  }

  async login(email: string, password: string): Promise<void> {
    await this.fillFields([
      [this.emailInput, email],
      [this.passwordInput, password],
    ]);
    await this.loginForm.locator('button[type="submit"]').click();
  }

  async searchUsers(query: string): Promise<void> {
    await this.userSearchInput.fill(query);
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  async closeJsonModal(): Promise<void> {
    await this.jsonModalClose.click();
  }

  async closeJsonModalViaBackdrop(): Promise<void> {
    await this.jsonModalBackdrop.click({ position: { x: 5, y: 5 } });
  }

  async goToNextPage(): Promise<void> {
    await this.pageNext.click();
  }

  async goToPrevPage(): Promise<void> {
    await this.pagePrev.click();
  }
}
