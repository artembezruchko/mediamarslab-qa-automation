import { Locator, Page } from '@playwright/test';
import { ui } from '../utils/selectors';

export class BasePage {
  constructor(protected readonly page: Page) {}

  protected ui(name: string): Locator {
    return this.page.locator(ui(name));
  }

  /** Fills each [locator, value] pair in order. Submitting is left to the caller. */
  protected async fillFields(fields: ReadonlyArray<readonly [Locator, string]>): Promise<void> {
    for (const [locator, value] of fields) {
      await locator.fill(value);
    }
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }
}
