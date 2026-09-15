import { test, expect } from '../../src/fixtures/base.fixture';

// POST /api/applications is separately rate-limited per IP (see README "Known
// limitations") — this file deliberately submits it at most once.
test.describe('Vacancy Application', () => {
  test('submitting the form displays the access key and admin credentials', async ({ vacancyApplicationPage }) => {
    await vacancyApplicationPage.goto();
    await vacancyApplicationPage.submit(`QA Applicant ${Date.now()}`);

    await expect(vacancyApplicationPage.resultBox).toBeVisible();
    await expect(vacancyApplicationPage.form).toBeHidden();
    await expect(vacancyApplicationPage.accessKeyDisplay).not.toHaveText('');
    await expect(vacancyApplicationPage.accessKeyDisplay).toHaveText(/^.+\..+$/); // <id>.<secret>
    await expect(vacancyApplicationPage.adminEmailDisplay).toContainText('@vacancy.local');
    await expect(vacancyApplicationPage.adminPasswordDisplay).not.toHaveText('');
  });

  test('P2: submitting without a full name is blocked client-side (required field)', async ({
    page,
    vacancyApplicationPage,
  }) => {
    await vacancyApplicationPage.goto();
    await vacancyApplicationPage.submitButton.click(); // fullName is required — never hits the server

    await expect(page).toHaveURL(/vacancy-application\.html/);
    await expect(vacancyApplicationPage.resultBox).toBeHidden();
  });
});
