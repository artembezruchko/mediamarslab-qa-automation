import { BasePage } from './BasePage';

/**
 * Shared header markup present on every screen behind a login (dashboard.html,
 * profile.html): user photo/name and the logout button. Factored out so the two pages
 * don't each redeclare the same three locators and logout() method.
 */
export class AuthenticatedPage extends BasePage {
  readonly userPhoto = this.ui('user-photo');
  readonly userName = this.ui('user-name');
  readonly logoutButton = this.ui('logout-button');

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
