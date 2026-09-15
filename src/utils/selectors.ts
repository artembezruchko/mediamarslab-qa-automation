/** Builds a `[data-ui="name"]` locator selector string. All app locators go through this helper. */
export function ui(name: string): string {
  return `[data-ui="${name}"]`;
}
