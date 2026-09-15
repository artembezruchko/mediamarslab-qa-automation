import { AuthenticatedPage } from './AuthenticatedPage';

export type TodoFilter = 'all' | 'active' | 'completed';

/**
 * Todo list items are rendered client-side by js/dashboard.js as plain `<li data-todo-id>`
 * elements with no data-ui hooks (confirmed via Phase 0 recon). Structure per item:
 * a checkbox (no label), a title `<span role="button">` (double-click starts inline edit,
 * which swaps it for a text `<input>` inside `[data-todo-title-block]`), tag badges, and a
 * single delete `<button>`.
 */
export class DashboardPage extends AuthenticatedPage {
  readonly todoForm = this.ui('todo-form');
  readonly todoInput = this.ui('todo-input');
  readonly addTodoButton = this.ui('add-todo-button');
  readonly todoInputGroup = this.ui('todo-input-group');
  readonly todoFormTagsChips = this.ui('todo-form-tags-chips');

  readonly todosList = this.ui('todos-list');
  readonly emptyState = this.ui('empty-state');
  readonly loadingMessage = this.ui('loading-message');

  readonly pagePrev = this.ui('page-prev');
  readonly pageNext = this.ui('page-next');
  readonly pageInfo = this.ui('page-info');

  readonly toggleTagsSidebarButton = this.ui('toggle-tags-sidebar-button');
  readonly tagsSidebar = this.ui('tags-sidebar');
  readonly closeTagsSidebarButton = this.ui('close-tags-sidebar-button');
  readonly tagForm = this.ui('tag-form');
  readonly tagNameInput = this.ui('tag-name-input');
  readonly tagCreateControls = this.ui('tag-create-controls');
  readonly tagColorGrid = this.ui('tag-color-grid');
  readonly tagsList = this.ui('tags-list');

  readonly deleteTodoModal = this.ui('delete-todo-modal');
  readonly cancelDeleteTodoButton = this.ui('cancel-delete-todo-button');
  readonly confirmDeleteTodoButton = this.ui('confirm-delete-todo-button');

  readonly toastContainer = this.ui('toast-container');

  async goto(): Promise<void> {
    await this.page.goto('/dashboard.html');
  }

  async waitForLoaded(): Promise<void> {
    await this.loadingMessage.waitFor({ state: 'hidden' }).catch(() => undefined);
  }

  todoItem(text: string) {
    return this.todosList.locator('li', { hasText: text });
  }

  /**
   * Runs `action`, waits for the matching request/response, and lets its body land before
   * returning. `todoInput`/`tagNameInput` each double as both a create field and a search
   * box, so filling either already starts its own debounced GET to the same endpoint the
   * create action also hits — matching the wrong method here previously raced that
   * unrelated request and returned before the real one had even happened.
   */
  private async waitForApiCall(
    method: 'GET' | 'POST',
    pathPattern: RegExp,
    action: () => Promise<void>,
  ): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.request().method() === method && pathPattern.test(r.url())),
      action(),
    ]);
    await response.finished();
  }

  /**
   * Also waits for the network to go idle afterward: the submission's own trailing
   * fetchTodos() (search reset) and the input's debounced search fetch can both still be
   * in flight right after the POST resolves, and calling this in a loop without absorbing
   * them let iterations' trailing requests interleave — observed live as an inconsistent
   * final `paginationState.totalPages` after adding several notes back to back.
   */
  async addTodo(text: string): Promise<void> {
    await this.todoInput.fill(text);
    await this.waitForApiCall('POST', /\/api\/todos(\?|$)/, () => this.addTodoButton.click());
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
  }

  async searchTodos(text: string): Promise<void> {
    await this.todoInput.fill(text);
  }

  /**
   * Searches for `text` (matches the exact same field used to create it — dashboard.js
   * resets search to '' and page to 1 on creation) and returns its locator. Tests share one
   * account per worker (see base.fixture.ts) so notes accumulate across tests; searching by
   * a unique title guarantees the item is on the current page regardless of how many other
   * notes exist, instead of assuming it happens to land on page 1 of the default view.
   *
   * Also waits for network idle afterward: a GET response landing only confirms the body
   * arrived, not that renderTodos() (which tears down and rebuilds the whole `<ul>` from
   * scratch) has finished running — a click-based interaction started right at that moment
   * can straddle the rebuild and land on an element that's already been torn down.
   */
  async findTodo(text: string) {
    await this.waitForApiCall('GET', /\/api\/todos(\?|$)/, () => this.searchTodos(text));
    const item = this.todoItem(text);
    await item.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    return item;
  }

  async setFilter(filter: TodoFilter): Promise<void> {
    await this.page.locator(`[data-filter="${filter}"]`).click();
  }

  async toggleComplete(text: string): Promise<void> {
    const item = await this.findTodo(text);
    await item.locator('input[type="checkbox"]').click();
  }

  /**
   * Double-clicks the title to enter inline-edit mode, types the new value, and presses
   * Enter to save.
   *
   * `item` (from findTodo) is a `li` filtered by `hasText: currentText` — a *live* selector
   * that Playwright re-evaluates on every access, not a snapshot. The moment inline-edit
   * mode starts, the title `<span>` (real text content) is replaced by an `<input>` whose
   * value holds that text — inputs don't contribute to an element's text content, so
   * `hasText` stops matching and any further `item.locator(...)` call silently resolves to
   * zero elements. Re-pinning the row by its stable `data-todo-id` before editing avoids that.
   */
  async editTodo(currentText: string, newTitle: string): Promise<void> {
    const found = await this.findTodo(currentText);
    const todoId = await found.getAttribute('data-todo-id');
    const item = this.todosList.locator(`li[data-todo-id="${todoId}"]`);

    // A synthetic mouse dblclick() was unreliable here (native double-click also triggers
    // text selection on this span) — dispatching the DOM event directly is more robust.
    await item
      .locator('span[role="button"]')
      .first()
      .evaluate((el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
    const input = item.locator('[data-todo-title-block] input');
    await input.fill(newTitle);
    await input.press('Enter');
  }

  async openDeleteModalFor(text: string): Promise<void> {
    const item = await this.findTodo(text);
    await item.locator('button').click();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteTodoButton.click();
  }

  async cancelDelete(): Promise<void> {
    await this.cancelDeleteTodoButton.click();
  }

  /** The modal element itself is the full-screen backdrop; its dialog box is a centered
   * child, so a click pinned to a corner lands on the backdrop, not the box. */
  async closeDeleteModalViaBackdrop(): Promise<void> {
    await this.deleteTodoModal.click({ position: { x: 5, y: 5 } });
  }

  /**
   * Confirming delete is optimistic: the note vanishes from the list immediately, but the
   * actual DELETE only fires 5s later (dashboard.js `setTimeout`) unless this toast action
   * cancels it first. Clicking it within that window restores the note without ever calling
   * the API.
   */
  async undoDelete(): Promise<void> {
    await this.toastContainer.getByRole('button', { name: 'Отменить' }).click();
  }

  async openTagsSidebar(): Promise<void> {
    await this.toggleTagsSidebarButton.click();
    await this.tagsSidebar.waitFor({ state: 'visible' });
  }

  async closeTagsSidebar(): Promise<void> {
    await this.closeTagsSidebarButton.click();
  }

  /**
   * Waiting for the POST alone isn't enough: the tagForm submit handler (js/dashboard.js)
   * `await`s a trailing `fetchTags('')` *after* that response resolves to refresh the
   * in-page `allTags` cache that `#tag` resolution (exact and partial match alike) reads
   * from. Returning before that refresh finishes let a caller's very next action — creating
   * a note referencing this tag — read a stale cache and silently fall back to creating an
   * unrelated same-named tag instead of resolving this one. Waiting for the tag to actually
   * render in the sidebar list is what actually guarantees that refresh has landed.
   */
  async createTag(name: string, colorIndex = 0): Promise<void> {
    await this.tagNameInput.fill(name);
    await this.tagColorGrid.locator('[role="radio"]').nth(colorIndex).click();
    await this.waitForApiCall('POST', /\/api\/tags(\?|$)/, () => this.tagForm.locator('button[type="submit"]').click());
    await this.tagItem(name).waitFor({ state: 'visible' });
  }

  async searchTags(text: string): Promise<void> {
    await this.tagNameInput.fill(text);
  }

  tagItem(name: string) {
    return this.tagsList.locator('li', { hasText: name });
  }

  /**
   * Clicking the tag `<li>` itself (not its delete button) attaches it to the draft note as
   * a chip in `todoFormTagsChips` — a separate code path from typing `#tag` inline in
   * `todoInput` (`selectTagForTodo()` vs. `parseTodoInput()` in js/dashboard.js).
   */
  async selectSidebarTagForTodo(name: string): Promise<void> {
    await this.tagItem(name).click();
  }

  /** Clicks the tag's own delete (✕) button, not the `<li>` itself — the row's own click
   * handler attaches the tag to the current draft note, which `event.stopPropagation()` on
   * the button prevents from also firing. */
  async deleteTag(name: string): Promise<void> {
    await this.tagItem(name).locator('button').click();
  }
}
