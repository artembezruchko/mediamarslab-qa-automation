import { test, expect } from '../../../src/fixtures/base.fixture';
import { ApiClient } from '../../../src/api/ApiClient';
import { endpoints } from '../../../src/api/endpoints';
import { randomSuffix } from '../../../src/utils/random';

test.describe('Dashboard — Pagination', () => {
  // The dashboard paginates at 5 notes per page (confirmed via Phase 0 recon of
  // js/dashboard.js: queryState.limit = 5), so 7 is enough to force a second page.
  //
  // Created via API, not by looping dashboardPage.addTodo() through the UI: each
  // submission's trailing fetchTodos() and the todoInput's own debounced search-fetch (it
  // doubles as the search box) can still be settling when the next loop iteration starts,
  // which was observed to occasionally undercount the final total. This test is about
  // pagination *navigation*, not note creation, so API-first setup sidesteps that
  // entirely — in line with this suite's general "API for setup, UI for the behavior under
  // test" principle (see README "Patterns").
  test('TODO-10 P1: page-next/page-prev navigate when there is more than one page', async ({ page, dashboardPage }) => {
    // localStorage isn't readable on about:blank (the page's state before any navigation) —
    // navigate first so the fixture's injected token is actually accessible.
    await dashboardPage.goto();
    const token = await page.evaluate(() => window.localStorage.getItem('token'));

    const client = await ApiClient.create({ token: token ?? undefined });
    for (let i = 0; i < 7; i += 1) {
      // The shared QA stand occasionally 5xxs under load (automation-plan.md §11) — one
      // retry on a failed create is cheap insurance against a single transient blip.
      let response = await client.raw.post(endpoints.todos, { data: { title: `Pagination note ${randomSuffix()}` } });
      if (!response.ok()) {
        response = await client.raw.post(endpoints.todos, { data: { title: `Pagination note ${randomSuffix()}` } });
      }
      expect(response.ok(), `POST /api/todos failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    }
    await client.dispose();

    await dashboardPage.goto(); // reload to pick up the notes just created via API
    await dashboardPage.waitForLoaded();
    await expect(dashboardPage.pageNext).toBeEnabled();

    const infoBefore = await dashboardPage.pageInfo.textContent();
    await dashboardPage.pageNext.click();
    await expect(dashboardPage.pageInfo).not.toHaveText(infoBefore ?? '');
    const infoAfter = await dashboardPage.pageInfo.textContent();

    expect(infoAfter).not.toBe(infoBefore);

    await dashboardPage.pagePrev.click();
    await expect(dashboardPage.pageInfo).toHaveText(infoBefore ?? '');
  });
});
