import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { randomSuffix } from '../../../src/utils/random';

test.describe('Profile — Analytics consent', () => {
  test.beforeEach(async ({ profilePage }) => {
    await profilePage.goto();
  });

  test('PROF-10 P0: toggling consent persists and emits analyticsConsentChange', async ({
    page,
    profilePage,
    analytics,
  }) => {
    await profilePage.setAnalyticsConsent(false);
    await profilePage.save();
    await expect(page).toHaveURL(/dashboard\.html/); // save() redirects here on success
    await analytics.waitForEvent({ type: 'analyticsConsentChange', analyticsConsent: false });

    await profilePage.goto();
    await expect(profilePage.analyticsConsentCheckbox).not.toBeChecked();

    await profilePage.setAnalyticsConsent(true);
    await profilePage.save();
    await analytics.waitForEvent({ type: 'analyticsConsentChange', analyticsConsent: true });
  });

  test('PROF-11 P0: with consent disabled, further actions do not emit events', async ({
    page,
    profilePage,
    dashboardPage,
    analytics,
  }) => {
    await profilePage.setAnalyticsConsent(false);
    await profilePage.save();
    await analytics.waitForEvent({ type: 'analyticsConsentChange', analyticsConsent: false });

    try {
      await dashboardPage.waitForLoaded();
      const text = `No analytics note ${randomSuffix()}`;
      await dashboardPage.addTodo(text);

      await analytics.assertNoEvent({ type: 'todoCreate' });
    } finally {
      // This account is shared with every other test on this worker (see base.fixture.ts) —
      // leaving consent off would silently break their event assertions.
      await profilePage.goto();
      await profilePage.setAnalyticsConsent(true);
      await profilePage.save();
      await expect(page).toHaveURL(/dashboard\.html/);
    }
  });
});
