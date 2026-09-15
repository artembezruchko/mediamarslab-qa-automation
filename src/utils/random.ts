/**
 * Non-sequential random suffix for test data that gets located via the app's todo/tag
 * search. GET /api/todos and GET /api/tags appear to match loosely (not a strict
 * substring) — two `Date.now()` values a millisecond apart still share an 11+ digit
 * prefix, which was enough to cross-match unrelated items in the same test run. A
 * short random base36 string avoids any shared prefix between concurrently-created items.
 */
export function randomSuffix(length = 8): string {
  let out = '';
  while (out.length < length) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, length);
}
