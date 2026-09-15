import path from 'path';
import { test, expect } from '../../../src/fixtures/analytics.fixture';

const AVATAR_PNG = path.join(__dirname, '../../../src/data/assets/avatar.png');
const AVATAR_INVALID = path.join(__dirname, '../../../src/data/assets/avatar-invalid.txt');

test.describe('Profile — Avatar', () => {
  test.beforeEach(async ({ profilePage }) => {
    await profilePage.goto();
  });

  test('PROF-04 P0: uploading a png avatar updates the preview and emits photoUpload', async ({
    profilePage,
    analytics,
  }) => {
    const srcBefore = await profilePage.avatar.getAttribute('src');

    await profilePage.uploadAvatar(AVATAR_PNG);

    await expect.poll(async () => profilePage.avatar.getAttribute('src')).not.toBe(srcBefore);

    // fileName is server-generated (e.g. photo-<ts>-<rand>.png), not the original upload name.
    const event = await analytics.waitForEvent({ type: 'photoUpload' });
    expect(event.fileName).toMatch(/\.png$/i);
  });

  test('PROF-05 P1: removing the avatar restores the generated placeholder', async ({ profilePage }) => {
    await profilePage.uploadAvatar(AVATAR_PNG);
    await profilePage.removeAvatar();

    // js/profile.js renders an inline SVG initial-letter avatar when there's no photo.
    await expect(profilePage.avatar).toHaveAttribute('src', /^data:image\/svg\+xml/);
  });

  test('PROF-06 P2: uploading a disallowed file type leaves the avatar unchanged', async ({ profilePage }) => {
    const srcBefore = await profilePage.avatar.getAttribute('src');

    // The server responds 500 with an unparseable body for this (confirmed via recon,
    // an unhandled multer error) — the client swallows it into a generic toast and never
    // updates the preview.
    await profilePage.photoInput.setInputFiles(AVATAR_INVALID);

    await expect(profilePage.avatar).toHaveAttribute('src', srcBefore ?? '');
  });
});
