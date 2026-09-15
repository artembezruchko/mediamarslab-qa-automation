import { test, expect } from '../../../src/fixtures/base.fixture';
import { randomSuffix } from '../../../src/utils/random';

test.describe('Dashboard — Filters & search', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForLoaded();
  });

  test('TODO-06 P1: filters show the correct subsets', async ({ dashboardPage }) => {
    // Tests share one account per worker (see base.fixture.ts) so other notes accumulate —
    // searching by a shared unique marker keeps both notes on the current page regardless
    // of the filter/status combination, isolating this from pagination.
    const marker = `flt${randomSuffix()}`;
    const activeText = `Active ${marker}`;
    const completedText = `Completed ${marker}`;
    await dashboardPage.addTodo(activeText);
    await dashboardPage.addTodo(completedText);
    await dashboardPage.toggleComplete(completedText);

    await dashboardPage.setFilter('active');
    await dashboardPage.searchTodos(marker);
    await expect(dashboardPage.todoItem(activeText)).toBeVisible();
    await expect(dashboardPage.todoItem(completedText)).toHaveCount(0);

    await dashboardPage.setFilter('completed');
    await dashboardPage.searchTodos(marker);
    await expect(dashboardPage.todoItem(completedText)).toBeVisible();
    await expect(dashboardPage.todoItem(activeText)).toHaveCount(0);

    await dashboardPage.setFilter('all');
    await dashboardPage.searchTodos(marker);
    await expect(dashboardPage.todoItem(activeText)).toBeVisible();
    await expect(dashboardPage.todoItem(completedText)).toBeVisible();
  });

  test('TODO-07 P1: typing in the note field filters the list by text', async ({ dashboardPage }) => {
    // Random (non-sequential) suffixes: the search matches loosely rather than as a strict
    // substring — two Date.now() values a millisecond apart shared an 11+ digit prefix,
    // which was enough to cross-match. Math.random()-based suffixes share no such prefix.
    const matching = `Findme-${randomSuffix()}`;
    const other = `Other-${randomSuffix()}`;
    await dashboardPage.addTodo(matching);
    await dashboardPage.addTodo(other);

    await dashboardPage.searchTodos(matching);

    await expect(dashboardPage.todoItem(matching)).toBeVisible();
    await expect(dashboardPage.todoItem(other)).toHaveCount(0);
  });
});
