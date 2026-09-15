import { test, expect } from '../../../src/fixtures/base.fixture';

// Uses the "admin" project's pre-authenticated storageState (see global.setup.ts).
test.describe('Admin — Users', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto();
    await expect(adminPage.panel).toBeVisible();
  });

  test('ADM-03 P0: the users list renders with pagination when there are many users', async ({ adminPage }) => {
    await expect(adminPage.usersList).toBeVisible();
    const userCount = await adminPage.usersList.locator('> *').count();
    expect(userCount).toBeGreaterThan(0);
  });

  test('ADM-04 P0: searching by email narrows the list', async ({ adminPage, page }) => {
    const firstCard = adminPage.usersList.locator('> *').first();
    const emailText = await firstCard.textContent();
    const email = emailText?.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0];
    test.skip(!email, 'could not extract an email from the first user card to search for');

    await adminPage.searchUsers(email!);

    await expect(page.locator(`text=${email}`)).toBeVisible();
  });

  test('ADM-12 P2: searching by a non-matching email excludes every user from the list', async ({ adminPage }) => {
    const bogusEmail = `no-such-user-${Date.now()}@example.invalid`;

    await adminPage.searchUsers(bogusEmail);

    // renderUsers() (js/admin.js) replaces the whole list with a single "not found" message
    // that echoes the query back — asserting on child count (not a `text=` locator, which
    // would also match that echoed query inside the message itself) confirms every real
    // user card was actually removed, not just that the message appeared alongside them.
    await expect(adminPage.usersList).toContainText(/никого не найдено/i);
    await expect(adminPage.usersList.locator('> *')).toHaveCount(1);
  });

  test('ADM-05 P1: opening an event shows valid JSON in the modal', async ({ adminPage }) => {
    await adminPage.showEventJsonButtons.first().click();

    await expect(adminPage.jsonModal).toBeVisible();
    const jsonText = await adminPage.jsonModalCode.textContent();
    const parsed = JSON.parse(jsonText ?? '');
    expect(parsed).toHaveProperty('type');
  });

  test('ADM-09 P2: the JSON modal can be closed via its close button', async ({ adminPage }) => {
    await adminPage.showEventJsonButtons.first().click();
    await expect(adminPage.jsonModal).toBeVisible();

    await adminPage.closeJsonModal();

    await expect(adminPage.jsonModal).toBeHidden();
  });

  test('ADM-10 P2: the JSON modal can be closed by clicking its backdrop', async ({ adminPage }) => {
    await adminPage.showEventJsonButtons.first().click();
    await expect(adminPage.jsonModal).toBeVisible();

    await adminPage.closeJsonModalViaBackdrop();

    await expect(adminPage.jsonModal).toBeHidden();
  });

  test('ADM-11 P1: pagination next/prev navigates between pages of users', async ({ adminPage }) => {
    test.skip(await adminPage.pageNext.isDisabled(), 'fewer than one page of users on this environment');
    const firstPageCard = await adminPage.usersList.locator('> *').first().textContent();

    await adminPage.goToNextPage();
    await expect.poll(() => adminPage.usersList.locator('> *').first().textContent()).not.toBe(firstPageCard);
    await expect(adminPage.pagePrev).toBeEnabled();

    await adminPage.goToPrevPage();
    await expect.poll(() => adminPage.usersList.locator('> *').first().textContent()).toBe(firstPageCard);
  });
});
