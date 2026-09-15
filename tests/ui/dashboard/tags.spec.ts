import { test, expect } from '../../../src/fixtures/base.fixture';
import { randomSuffix } from '../../../src/utils/random';

test.describe('Dashboard — Tags', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForLoaded();
    await dashboardPage.openTagsSidebar();
  });

  test('TAG-01 P0: creating a tag with a name and color adds it to the tags list', async ({ dashboardPage }) => {
    const name = `tag${randomSuffix()}`;
    await dashboardPage.createTag(name, 0);

    await expect(dashboardPage.tagsList.locator('li', { hasText: name })).toBeVisible();
  });

  test('TAG-02 P1: searching in the tag field filters the tags list', async ({ dashboardPage }) => {
    // Random (non-sequential) suffixes: the search matches loosely rather than as a strict
    // substring — two Date.now() values a millisecond apart shared an 11+ digit prefix,
    // which was enough to cross-match. Math.random()-based suffixes share no such prefix.
    const matching = `findtag${randomSuffix()}`;
    const other = `othertag${randomSuffix()}`;
    await dashboardPage.createTag(matching, 0);
    await dashboardPage.createTag(other, 1);

    await dashboardPage.searchTags(matching);

    await expect(dashboardPage.tagsList.locator('li', { hasText: matching })).toBeVisible();
    await expect(dashboardPage.tagsList.locator('li', { hasText: other })).toHaveCount(0);
  });

  test('TAG-03 P1: creating a note with #tag attaches the tag to it', async ({ dashboardPage }) => {
    const tagName = `qatag${randomSuffix()}`;
    await dashboardPage.closeTagsSidebar();

    const text = `Tagged note #${tagName}`;
    await dashboardPage.addTodo(text);

    // The stored title is just "Tagged note" — the #tag suffix becomes a tag association,
    // not title text — so plain-text search can't find it (and isn't unique across runs
    // anyway). Searching "#tagName" filters by tag id instead, which is unique and immune
    // to pagination from other tests' accumulated notes sharing this worker's account.
    await dashboardPage.searchTodos(`#${tagName}`);
    await expect(dashboardPage.todoItem(tagName)).toBeVisible();
  });

  test('TAG-04 P2: tag name respects maxlength=40', async ({ dashboardPage }) => {
    await expect(dashboardPage.tagNameInput).toHaveAttribute('maxlength', '40');
  });

  test('TAG-05 P2: closing the sidebar hides it', async ({ dashboardPage }) => {
    await dashboardPage.closeTagsSidebar();
    await expect(dashboardPage.tagsSidebar).not.toHaveClass(/is-open/);
  });

  test('TAG-12 P2: pressing Escape closes the tags sidebar', async ({ dashboardPage }) => {
    await dashboardPage.pressEscape();
    await expect(dashboardPage.tagsSidebar).not.toHaveClass(/is-open/);
  });

  test('TAG-06 P1: deleting a tag removes it from the list', async ({ dashboardPage }) => {
    const name = `deleteme${randomSuffix()}`;
    await dashboardPage.createTag(name, 0);
    await expect(dashboardPage.tagItem(name)).toBeVisible();

    await dashboardPage.deleteTag(name);

    await expect(dashboardPage.tagItem(name)).toHaveCount(0);
  });

  test('TAG-07 P1: clicking a tag in the sidebar attaches it to the draft note as a chip', async ({
    dashboardPage,
  }) => {
    const tagName = `sidebartag${randomSuffix()}`;
    await dashboardPage.createTag(tagName, 0);

    await dashboardPage.selectSidebarTagForTodo(tagName);
    await expect(dashboardPage.todoFormTagsChips).toContainText(tagName);

    // The sidebar overlaps the add-note button on this viewport, so close it before
    // submitting — same reasoning TAG-03 documents for the inline #tag flow.
    await dashboardPage.closeTagsSidebar();
    const text = `Attached via sidebar click ${randomSuffix()}`;
    await dashboardPage.addTodo(text);

    await dashboardPage.searchTodos(`#${tagName}`);
    await expect(dashboardPage.todoItem(text)).toBeVisible();
  });

  test('TAG-08 P1: a note can carry more than one inline #tag', async ({ dashboardPage }) => {
    const tagA = `multia${randomSuffix()}`;
    const tagB = `multib${randomSuffix()}`;
    await dashboardPage.createTag(tagA, 0);
    await dashboardPage.createTag(tagB, 1);
    await dashboardPage.closeTagsSidebar();

    const title = `Multi tag note ${randomSuffix()}`;
    await dashboardPage.addTodo(`${title} #${tagA} #${tagB}`);

    const item = await dashboardPage.findTodo(title);
    await expect(item).toContainText(`#${tagA}`);
    await expect(item).toContainText(`#${tagB}`);
  });

  test('TAG-11 P2: a partial inline #tag match still resolves to the existing tag', async ({ dashboardPage }) => {
    // resolveTagFromQuery() (js/dashboard.js) falls back to a substring match when no exact
    // name match exists — typing a prefix of the real tag name should still attach it.
    const fullName = `partialmatch${randomSuffix()}`;
    await dashboardPage.createTag(fullName, 0);
    await dashboardPage.closeTagsSidebar();

    const title = `Partial match note ${randomSuffix()}`;
    await dashboardPage.addTodo(`${title} #partialmatch`);

    const item = await dashboardPage.findTodo(title);
    await expect(item).toContainText(`#${fullName}`);
  });
});
