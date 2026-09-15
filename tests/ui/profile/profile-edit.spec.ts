import { test, expect } from '../../../src/fixtures/base.fixture';

test.describe('Profile — Edit', () => {
  test.beforeEach(async ({ profilePage }) => {
    await profilePage.goto();
  });

  // Saving redirects to /dashboard.html on success (confirmed via Phase 0 recon of
  // js/profile.js), so persistence is checked by navigating back rather than reloading.
  test('PROF-01 P0: changing the name persists', async ({ page, profilePage }) => {
    const newName = `QA Name ${Date.now()}`;
    await profilePage.setName(newName);
    await profilePage.save();
    await expect(page).toHaveURL(/dashboard\.html/);

    await profilePage.goto();
    await expect(profilePage.nameInput).toHaveValue(newName);
  });

  test('PROF-02 P1: email field is readonly', async ({ profilePage }) => {
    await expect(profilePage.emailInput).toHaveAttribute('readonly', '');
  });

  test('PROF-03 P1: changing gender persists', async ({ page, profilePage }) => {
    await profilePage.setGender(1);
    await profilePage.save();
    await expect(page).toHaveURL(/dashboard\.html/);

    await profilePage.goto();
    await expect(profilePage.genderFemale).toBeChecked();
  });
});
