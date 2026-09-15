import { expect } from '@playwright/test';
import { AuthenticatedPage } from './AuthenticatedPage';

export class ProfilePage extends AuthenticatedPage {
  readonly profileForm = this.ui('profile-form');
  readonly nameInput = this.ui('profile-name');
  readonly emailInput = this.ui('profile-email');
  readonly genderMale = this.ui('profile-gender-male');
  readonly genderFemale = this.ui('profile-gender-female');

  readonly avatar = this.ui('profile-avatar');
  readonly photoInput = this.ui('profile-photo-input');
  readonly replacePhotoButton = this.ui('profile-replace-photo-button');
  readonly removePhotoButton = this.ui('profile-remove-photo-button');

  readonly openPasswordModalButton = this.ui('profile-open-password-modal');
  readonly passwordModal = this.ui('password-modal');
  readonly passwordForm = this.ui('password-form');
  readonly newPasswordInput = this.ui('profile-new-password');
  readonly confirmPasswordInput = this.ui('profile-confirm-password');
  readonly passwordFormMessage = this.ui('password-form-message');
  readonly passwordModalCancel = this.ui('password-modal-cancel');
  readonly passwordModalClose = this.ui('password-modal-close');

  readonly analyticsConsentCheckbox = this.ui('profile-analytics-consent');
  readonly submitButton = this.ui('profile-submit');

  async goto(): Promise<void> {
    await this.page.goto('/profile.html');
    // js/profile.js populates the form asynchronously via GET /api/profile after load;
    // the email field (readonly, always non-empty for a real account) is a reliable signal
    // that populateUser() has run — without this wait, setAnalyticsConsent()/setGender()
    // could read the checkbox/radio's default unpopulated state and race the real value.
    await expect(this.emailInput).not.toHaveValue('');
  }

  async setName(name: string): Promise<void> {
    await this.nameInput.fill(name);
  }

  async setGender(gender: 0 | 1): Promise<void> {
    await (gender === 0 ? this.genderMale : this.genderFemale).check();
  }

  async uploadAvatar(filePath: string): Promise<void> {
    await this.photoInput.setInputFiles(filePath);
  }

  async removeAvatar(): Promise<void> {
    await this.removePhotoButton.click();
  }

  async save(): Promise<void> {
    await this.submitButton.click();
  }

  async setAnalyticsConsent(enabled: boolean): Promise<void> {
    const checked = await this.analyticsConsentCheckbox.isChecked();
    if (checked !== enabled) {
      await this.analyticsConsentCheckbox.click();
    }
  }

  async openPasswordModal(): Promise<void> {
    await this.openPasswordModalButton.click();
    await this.passwordModal.waitFor({ state: 'visible' });
  }

  async changePassword(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.passwordForm.locator('button[type="submit"]').click();
  }

  async closePasswordModal(): Promise<void> {
    await this.passwordModalClose.click();
  }
}
