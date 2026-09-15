import { test, expect } from '../../../src/fixtures/analytics.fixture';
import { AuthApi } from '../../../src/api/AuthApi';
import { DashboardPage } from '../../../src/pages/DashboardPage';
import { randomSuffix } from '../../../src/utils/random';

test.describe('Dashboard — Todo CRUD', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForLoaded();
  });

  test('TODO-01 P0: creating a note adds it to the list and emits todoCreate', async ({ dashboardPage, analytics }) => {
    const text = `Buy milk ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await expect(await dashboardPage.findTodo(text)).toBeVisible();
    await analytics.waitForEvent({ type: 'todoCreate' });
  });

  test('TODO-02 P0: marking a note complete updates its status and emits todoComplete', async ({
    dashboardPage,
    analytics,
  }) => {
    const text = `Finish report ${randomSuffix()}`;
    await dashboardPage.addTodo(text);
    await dashboardPage.toggleComplete(text);

    await analytics.waitForEvent({ type: 'todoComplete' });
  });

  test('TODO-03 P0: editing a note updates its title and emits todoEdit', async ({ dashboardPage, analytics }) => {
    const original = `Draft note ${randomSuffix()}`;
    const updated = `${original} edited`;
    await dashboardPage.addTodo(original);

    await dashboardPage.editTodo(original, updated);

    await expect(await dashboardPage.findTodo(updated)).toBeVisible();
    await analytics.waitForEvent({ type: 'todoEdit' });
  });

  test('TODO-04 P0: deleting a note via the confirm modal removes it and emits todoDelete', async ({
    dashboardPage,
    analytics,
  }) => {
    // The 5s undo delay (see below) plus a 20s analytics poll leaves little slack under the
    // default 30s test timeout.
    test.setTimeout(45_000);
    const text = `Temp note ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.openDeleteModalFor(text);
    await expect(dashboardPage.deleteTodoModal).toBeVisible();
    await dashboardPage.confirmDelete();

    await expect(dashboardPage.todoItem(text)).toHaveCount(0);
    // Delete is optimistic with a 5s undo window (js/dashboard.js setTimeout) before the
    // actual DELETE call fires — the default 10s analytics poll leaves too little margin
    // for that delay plus the round-trip and event-write time after it.
    await analytics.waitForEvent({ type: 'todoDelete' }, { timeoutMs: 20_000 });
  });

  test('TODO-05 P1: cancelling delete keeps the note in the list', async ({ dashboardPage }) => {
    const text = `Keep me ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.openDeleteModalFor(text);
    await dashboardPage.cancelDelete();

    await expect(dashboardPage.deleteTodoModal).toBeHidden();
    await expect(dashboardPage.todoItem(text)).toBeVisible();
  });

  test('TODO-05b P1: the toast "Undo" action also cancels the pending delete', async ({ dashboardPage, analytics }) => {
    // Same 5s undo-delay reasoning as TODO-04.
    test.setTimeout(45_000);
    const text = `Undo me ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.openDeleteModalFor(text);
    await dashboardPage.confirmDelete();
    // The removal is optimistic — gone from the list immediately, before the real DELETE
    // (fired 5s later) ever happens.
    await expect(dashboardPage.todoItem(text)).toHaveCount(0);

    await dashboardPage.undoDelete();
    await expect(await dashboardPage.findTodo(text)).toBeVisible();

    // Undo clears the pending setTimeout client-side, so the DELETE (and its analytics
    // event) should never fire at all — wait past the original 5s window to be sure.
    await analytics.assertNoEvent({ type: 'todoDelete' }, { timeoutMs: 7_000 });
  });

  test('TODO-12 P2: pressing Escape closes the delete-confirmation modal', async ({ dashboardPage }) => {
    const text = `Escape me ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.openDeleteModalFor(text);
    await dashboardPage.pressEscape();

    await expect(dashboardPage.deleteTodoModal).toBeHidden();
    await expect(dashboardPage.todoItem(text)).toBeVisible();
  });

  test('TODO-13 P2: clicking the delete-modal backdrop closes it', async ({ dashboardPage }) => {
    const text = `Backdrop me ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.openDeleteModalFor(text);
    await dashboardPage.closeDeleteModalViaBackdrop();

    await expect(dashboardPage.deleteTodoModal).toBeHidden();
    await expect(dashboardPage.todoItem(text)).toBeVisible();
  });

  test('TODO-09 P2: an empty note is not added, and the field enforces maxlength=200', async ({ dashboardPage }) => {
    await expect(dashboardPage.todoInput).toHaveAttribute('maxlength', '200');

    const countBefore = await dashboardPage.todosList.locator('li').count();

    await dashboardPage.todoInput.fill('');
    await dashboardPage.addTodoButton.click();

    const countAfter = await dashboardPage.todosList.locator('li').count();
    expect(countAfter).toBe(countBefore);
  });

  test('TODO-11 P2: empty state is shown when there are no notes', async ({ page }) => {
    // Uses its own dedicated fresh user (bypassing the worker-shared `dashboardPage`
    // fixture) since it specifically needs a guaranteed-empty account, and the shared
    // worker account accumulates notes from every other test that runs on this worker.
    const { token } = await AuthApi.createAuthedUser();
    await page.addInitScript((t: string) => window.localStorage.setItem('token', t), token);
    const dashboardPage = new DashboardPage(page);

    await dashboardPage.goto();
    await dashboardPage.waitForLoaded();

    await expect(dashboardPage.emptyState).toBeVisible();
  });
});
