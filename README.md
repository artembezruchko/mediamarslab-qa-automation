# QA Automation — mediamarslab recruitment app

Playwright + TypeScript test suite (Page Object Model) for
`https://qa-a.recruitment.mediamarslab.com/`, covering UI E2E, API contracts, and
cross-verification against the app's internal analytics feed
(`GET /api/analytics/events`).

## Stack

- [Playwright](https://playwright.dev/) + TypeScript
- Page Object Model (`src/pages`), API clients (`src/api`), Playwright fixtures (`src/fixtures`)

## Setup

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env   # fill in real values, see below
npm test
```

### Environment variables (`.env`)

| Variable                                            | Description                                                   |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `BASE_URL` / `API_BASE_URL`                         | App origin, e.g. `https://qa-a.recruitment.mediamarslab.com`  |
| `X_ACCESS_KEY`                                      | `<id>.<secret>` access key issued by `POST /api/applications` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`                    | One-time admin credentials from the same application          |
| `ANALYTICS_BASIC_USER` / `ANALYTICS_BASIC_PASSWORD` | HTTP Basic credentials for the analytics feed                 |

**Never commit `.env`.** The repository is public — secrets live only in `.env` locally and
in GitHub Actions secrets in CI (see `.github/workflows/playwright.yml`).

## Running tests

```bash
npm test              # everything
npm run test:api      # API-only project (no browser flows)
npm run test:ui       # UI project (dashboard/profile)
npm run test:auth     # register/login/logout flows
npm run test:admin    # admin panel
npm run test:e2e      # cross-cutting E2E + analytics verification scenarios
npm run test:resilient # everything, auto-retrying rate-limit-caused failures (see below)
npm run test:headed   # any of the above with --headed
npm run test:ui-mode  # Playwright's interactive UI mode
npm run report        # open the last HTML report
```

The suite runs fully serialized (`workers: 1`) — see "Rate limits" below for why; running it
with higher parallelism against this particular backend causes real, hard-to-diagnose
failures, not just slowness.

**`npm run test:resilient`**: a full run's own traffic can exhaust either of the two rate
limits documented below right near the end, failing whichever tests happened to need a call
in that last stretch (confirmed repeatedly — a different subset fails each run, and every one
passes cleanly in isolation once the window clears). Playwright's own `retries` (in
`playwright.config.ts`) fires immediately and just re-hits the same exhausted window, so it
can't fix this. `scripts/test-with-retry.js` wraps `playwright test`: on failure it waits at
least `RETRY_MIN_COOLDOWN_MS` (default 90s — comfortably past the general limit's 60s window,
which has no response header this script can probe) before every retry round, extending that
further if the `/api/auth/*`-specific probe (via the API's own `RateLimit-Remaining`/
`Retry-After` headers) reports a longer `Retry-After` (falling back to `RETRY_COOLDOWN_MS`,
default 6 minutes, if that probe itself fails), then re-runs only the failed tests
(`playwright test --last-failed`) — up to `RETRY_ROUNDS` times (default 3). Any arguments
after the script name are forwarded to `playwright test` on every attempt, e.g. `npm run
test:resilient -- --project=e2e`. If it's still failing after all rounds, that's a real
regression, not rate-limiting. CI (`.github/workflows/playwright.yml`) uses this instead of a
bare `playwright test` for the same reason, and runs `api-tests` after `test` rather than
concurrently, since two GitHub-hosted runners hitting the same rate-limited backend at once
just compounds both budgets' exhaustion.

## Project structure

```
src/
  config/env.ts        # env var loading + validation
  api/                  # ApiClient, AuthApi, AnalyticsApi, ApplicationsApi, endpoints.ts
  pages/                # Page Object Model classes, one per screen
  fixtures/             # Playwright fixtures: api clients, page objects, analytics helpers
  data/                 # test user factory + fixed upload assets (avatar.png, avatar-invalid.txt)
  utils/                # selectors ui(name), polling, analytics event matching
tests/
  global.setup.ts       # logs in as admin once per run, saves storageState
  api/                  # access control, applications, analytics-events contract tests
  ui/auth/              # register / login / logout (run unauthenticated)
  ui/dashboard/         # todo CRUD, filters, search, pagination, tags
  ui/profile/           # profile edit, avatar, password change, analytics consent
  ui/admin/             # admin auth (unauthenticated) + admin users (pre-authenticated)
  ui/vacancy-application.spec.ts  # public vacancy-application form (no auth) — submits at
                                   # most once per run, see "Known limitations" below
  e2e/                  # full user journeys cross-checked against the analytics feed
```

## Patterns

- **Locators**: every static UI locator goes through `ui('data-ui-value')` →
  `[data-ui="data-ui-value"]`. Dynamically-rendered todo `<li>` items have no `data-ui` hooks
  (confirmed via Phase 0 recon of `js/dashboard.js`) — those are targeted structurally
  (`input[type="checkbox"]`, the title `span[role="button"]`, the one delete `button` per
  item) via `DashboardPage`.
- **API-first setup**: user accounts for API-level and dashboard/profile UI tests are
  created via `AuthApi` (`POST /api/auth/register` + `login`) instead of driving the
  register form, for speed and to control the rate-limit budget below. The same principle
  applies to bulk fixture data — `TODO-10` (pagination) seeds its 7 notes via `POST
/api/todos` directly rather than looping the UI form, since `todoInput` doubling as the
  search box makes rapid successive UI submissions genuinely racy (see `DashboardPage`
  patterns below) and the test is about pagination _navigation_, not note creation.
- **Worker-scoped test user, not per-test**: `dashboardPage`/`profilePage` fixtures
  provision **one fresh user per worker process** (`src/fixtures/base.fixture.ts`), reused
  by every test that worker runs — not a fresh user per test. A worker runs its tests one at
  a time, so this still prevents two tests concurrently mutating the same account (the
  original failure mode: one test disabling `analyticsConsent` silently broke an unrelated
  test's event assertions), while keeping `/api/auth/*` call volume within the rate limit
  (see below). Because notes/tags accumulate across tests sharing a worker,
  `DashboardPage.findTodo()`/`toggleComplete()`/`editTodo()`/`openDeleteModalFor()` search by
  each note's unique generated title before interacting with it, so pagination never hides
  an item behind other tests' leftover data. `TODO-11` (empty state) is the one exception —
  it provisions its own dedicated fresh user, since it specifically needs a guaranteed-empty
  account.
- **Auth-flow tests are the exception**: `ui/auth/*`, `ui/admin/admin-auth.spec.ts`, and
  `e2e/*` manage a session end-to-end themselves (they _are_ the register/login/logout
  flow under test) and opt out of the fixtures above by constructing
  `new DashboardPage(page)` / `new ProfilePage(page)` directly instead of via the fixture,
  since the fixture's own session-injection would trip the app's "already logged in"
  redirect before the test's manual flow runs. `src/utils/registerViaUi.ts` dedupes the
  "register a throwaway user through the real form and wait for the dashboard redirect"
  setup step shared by these files — used everywhere that registration is just setup, not
  the thing under test (`AUTH-01`/`AUTH-02`'s own duplicate-email case still call
  `registerPage.register()` directly, since that mechanic _is_ what's being tested there).
  Session lives in `localStorage.token` /
  `localStorage.adminToken`, not cookies — tests that need a clean unauthenticated page
  mid-test call `page.evaluate(() => localStorage.clear())` rather than `clearCookies()`.
  `admin-auth.spec.ts` additionally needs `test.use({ storageState: { cookies: [], origins:
[] } })` to override the `admin` project's shared `.auth/admin.json` — note the explicit
  empty object, not `storageState: undefined`, which Playwright does not reliably treat as
  "clear the project's value" (confirmed the hard way: the login form stayed hidden behind
  the already-authenticated panel until switched to the explicit form). The other auth-flow
  files don't need this at all, since `auth-ui`/`e2e` have no project-level `storageState`
  to override in the first place.
- **A page reached via the app's own redirect isn't necessarily "ready" yet**: after
  register.js's `window.location.href` (not a Playwright `page.goto()`), `expect(page).
toHaveURL(...)` only confirms the URL changed — not that the new page's script has
  finished running and bound its event listeners. Clicking too early lands on a real,
  visible button with no listener yet, which just does nothing (see `logout.spec.ts`,
  fixed by `page.waitForLoadState('domcontentloaded')` before the click). A tempting
  alternative — waiting for `[data-ui="loading-message"]` to reach `hidden` — is _not_ a
  real signal here: it starts `hidden` in the static HTML, so waiting for that state can
  resolve instantly without ever having waited on anything.
- **Playwright locators are live, not snapshots** — `DashboardPage.editTodo()` learned this
  the hard way: `findTodo()`'s `item` is `li` filtered by `hasText: currentText`, and that
  filter is _re-evaluated_ every time you touch the locator again. The moment inline-edit
  starts, the title `<span>` (real text) is replaced by an `<input>` (value, not text
  content) — `hasText` stops matching, and any further `item.locator(...)` call silently
  resolves to zero elements instead of erroring clearly. The fix re-pins the row by its
  stable `data-todo-id` attribute before editing, rather than continuing to filter by text
  that's about to stop being text.
- **Analytics verification layer** (`src/utils/analytics.ts`, `analytics` fixture): after a
  UI or API action, `analytics.waitForEvent({ type, email, ... })` polls
  `GET /api/analytics/events` (Basic auth + X-Access-Key) until a matching event appears,
  and asserts on its fields. `analytics.assertNoEvent(...)` verifies the negative case. Every
  match is scoped to `timestamp >= testStartMs` to avoid cross-test/cross-run interference.
- **One HTTP context factory, not four** (`src/api/httpContext.ts`): `createApiContext()`
  and `accessKeyHeader()` are the single place that build a Playwright `APIRequestContext`
  and decide the X-Access-Key value — `ApiClient`, `AnalyticsApi`, and `AuthApi` all compose
  them instead of each re-implementing context creation and the key-header logic. The two
  class wrappers (`ApiClient`, `AnalyticsApi`) also share `dispose()` via the small
  `ApiContextWrapper` base class. Changing how the key is sent, or the base URL is resolved,
  is a one-file change instead of four.
- **Coverage-gap follow-ups**: a post-implementation coverage review found the vacancy
  application form, delete-undo, tag deletion, admin role boundaries, and register-with-photo
  had no tests. Added: `ui/vacancy-application.spec.ts` (form submit + required-field
  guard), `TODO-05b` (the toast "Undo" cancels the pending delete and no `todoDelete` event
  ever fires — distinct from `TODO-05`'s modal-cancel path), `TAG-06` (delete removes a tag
  from the list), `ADM-08` (`sharedToken`, a regular user's token, is rejected by `GET
/api/admin/overview` — reuses the existing shared token in `access-control.spec.ts` rather
  than minting a new one), and `AUTH-09` (`RegisterPage.register()` now accepts an optional
  `photoPath` — uploaded via `POST /api/upload/photo`, a separate endpoint from profile photo
  upload, confirmed via recon of `js/register.js` — and the test asserts the dashboard avatar
  is a real image, not the generated-placeholder SVG). A follow-up pass covered the
  next tier of gaps: `ADM-11` (pagination), `PROF-12` (password-modal Cancel/×), `TAG-07`
  (sidebar-click tag attachment, a separate code path from inline `#tag`), `TAG-08` (multiple
  `#tag`s in one note), `TAG-09`/`TAG-10` (API-level duplicate-name `409` and missing/invalid
  color `400` — both blocked client-side, so only reachable by calling `POST /api/tags`
  directly), `AUTH-10` (`profile.html`'s unauthenticated guard, alongside `AUTH-08`'s
  `dashboard.html` one), and `ADM-09`/`ADM-10` (the admin JSON modal's close button and
  backdrop). A final pass covered what was left: `TODO-12`/`TODO-13` and `TAG-12` (Escape
  and backdrop-click also close the delete-confirmation modal and the tags sidebar, not just
  their explicit buttons), `TAG-11` (`resolveTagFromQuery()`'s substring-match fallback for
  a partial inline `#tag`), `ADM-12` (a non-matching admin search actually empties the list,
  not just that a match narrows it), and `tests/api/todos.spec.ts` (`API-10`/`API-11`:
  `PATCH`/`DELETE /api/todos/:id` return `404 "Todo not found"` for a well-formed but
  non-existent id, and `400 "Invalid todo id"` for a malformed one).

## API contract

Confirmed by reading every page's client-side script (`js/*.js`) and by driving the live
app during Phase 0 recon — this supersedes automation-plan.md's assumptions in a few places
(noted inline below).

**Auth model**: `POST /api/auth/register` and `POST /api/auth/login` (`{email,password}` →
`{token, role: 'user'|'admin', message}`) are the only auth endpoints; there is no separate
admin login endpoint — `admin.html`'s form posts to the same `/api/auth/login` and just
stores the returned token under a different `localStorage` key based on `role`. Every other
endpoint requires `Authorization: Bearer <token>`.

**X-Access-Key — real behavior, not vestigial**: the app's own frontend JS never sends this
header at all. Live probing found it genuinely enforced server-side on every endpoint except
`POST /api/applications`, but only once a per-IP **grace quota of keyless requests** is
spent — early in a fresh session, requests without any key succeed; afterwards the backend
starts returning `401 {"message":"Missing X-Access-Key header"}` (or `"Invalid access key"`
for a wrong one). Since a real user's browser never sends it, a busy production IP could in
principle get legitimate users locked out — this is either an intentional trap in this
exercise or a genuine app bug; either way this suite always sends a valid key
(`playwright.config.ts` `use.extraHTTPHeaders`, plus explicitly in `AuthApi`/`ApiClient`/
`AnalyticsApi`) rather than depending on the grace window. See
`tests/api/access-control.spec.ts` (`DISC-01`/`DISC-02`) for the tolerant-of-either-state
test writeup.

**Rate limits (important for anyone extending this suite)**:

- `POST /api/auth/*` (register/login/logout combined): hard **40 requests per 15-minute
  window per IP**, confirmed via `RateLimit-Limit`/`RateLimit-Remaining`/`Retry-After`
  response headers. This is the binding constraint on this suite's design — see "Worker-
  scoped test user" above and `AuthApi`'s call serialization/spacing.
  `429 {"message":"Too many auth requests. Please try again later."}`. `workers: 1` in
  `playwright.config.ts` exists specifically because of this: Playwright can run _multiple
  projects_ concurrently once `workers > 1`, and this suite's realistic call budget across
  all projects together sits close enough to 40 that any extra parallelism reliably blows
  through it (confirmed by running the full suite repeatedly — cascading register/login
  failures every time above 1 worker, none at `workers: 1`). Project _ordering_ is left to
  Playwright's own scheduling rather than forced via `dependencies`, since `dependencies`
  skips a project entirely on any failure in its dependency — fine for `admin`'s genuine
  need for `setup`'s storageState, but would silently skip whole projects' worth of tests
  over one unrelated flaky test if used just to sequence unrelated projects.
- `POST /api/applications`: separately rate-limited per IP (observed `429
{"message":"Too many application requests from this IP. Try again later."}` after only a
  handful of calls). `tests/api/applications.spec.ts` (`API-01`) calls it once; avoid
  re-running it in a loop or self-provisioning a key per test run.
- A 429 on `/api/auth/*` is retried once with the server's own `Retry-After` value, but only
  if that value is short (≤20s) — a multi-minute window can't be waited out inside a single
  test's timeout, so beyond that the call fails fast rather than hanging.
- **All other endpoints share a separate, general per-IP limit**: `ratelimit-policy:
200;w=60` (200 requests per 60-second window), observed on `/api/tags*` while iterating on
  `TAG-08`. It resets fast (60s, not 15 minutes) and normal UI-paced test execution stays
  well under it, but a tag/todo-heavy file run back-to-back with itself right after manual
  API probing (e.g. curl-ing `/api/tags` directly while writing a test) can transiently blow
  through it — surfaces as `dashboard.js`'s own fetches getting `429`s the app swallows into
  a toast, which then reads as a Playwright action timing out waiting for a network call
  that never happens. Not something this suite works around programmatically (no retry logic
  outside `AuthApi`); if a run trips it, waiting under a minute and re-running is enough.

**Endpoint reference**:

| Endpoint                                                                                                | Auth                               | Notes                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/applications`                                                                                | none                               | Rate-limited (see above). Returns `{accessKey, adminEmail, adminPassword, applicationId, fullName, startedAt}`, status `201`.                                                                                                                                                                                                               |
| `POST /api/auth/register`                                                                               | X-Access-Key                       | `{name,email,gender:'0'\|'1',password,photo,internalAnalyticsConsent:true}` → `201`. No server-side email-format or password-length validation — only the client's `<input type="email">` and the register form's mandatory consent checkbox gate anything. `409` on duplicate email.                                                       |
| `POST /api/auth/login`                                                                                  | X-Access-Key                       | `{email,password}` → `{token,role,message}`. Same `400 "Invalid credentials"` for wrong password and unknown email.                                                                                                                                                                                                                         |
| `POST /api/auth/logout`                                                                                 | Bearer + X-Access-Key              | Fire-and-forget; client clears `localStorage` regardless of the response.                                                                                                                                                                                                                                                                   |
| `GET /api/profile` / `PATCH /api/profile`                                                               | Bearer + X-Access-Key              | `PATCH` body `{name, internalAnalyticsConsent, gender?}` or `{photo: null}` to remove the avatar. Saving from `profile.html` redirects to `/dashboard.html` on success.                                                                                                                                                                     |
| `POST /api/profile/photo`                                                                               | Bearer + X-Access-Key              | Multipart `FormData` field `photo`. Disallowed file types return a raw `500` with an unparseable body (an unhandled server error, not a clean `4xx`) — the client swallows it into a generic toast. `fileName` recorded in the `photoUpload` analytics event is server-generated (e.g. `photo-<ts>-<rand>.png`), not the uploaded filename. |
| `POST /api/profile/password`                                                                            | Bearer + X-Access-Key              | `{newPassword,confirmPassword}` — mismatch is caught **client-side only** and never reaches this endpoint; a short-but-matching password (`<6` chars) is what actually triggers the server-side `400 "Password must be at least 6 characters"` / `passwordChangeFailed` event.                                                              |
| `GET /api/todos` (`status,search,page,limit,sort,tagIds[]`) / `POST` / `PATCH /:id` / `DELETE /:id`     | Bearer + X-Access-Key              | Page size is **5**. Deleting from the UI is optimistic with a 5s undo window before the actual `DELETE` fires.                                                                                                                                                                                                                              |
| `GET /api/tags` (`search`) / `POST` / `POST /api/tags/ensure` / `DELETE /:id` / `GET /api/tags/palette` | Bearer + X-Access-Key              | Tags are not paginated.                                                                                                                                                                                                                                                                                                                     |
| `GET /api/admin/overview` (`page,limit,search`)                                                         | Bearer (admin role) + X-Access-Key | Page size **5**. Per-user `events[]` entries back the "Показать JSON" (`data-ui="admin-show-event-json"`) modal.                                                                                                                                                                                                                            |
| `GET /api/analytics/events`                                                                             | HTTP Basic + X-Access-Key          | Returns the last 24h of events as a flat JSON array.                                                                                                                                                                                                                                                                                        |

**Analytics event schema** (confirmed live): common fields `type`, `status`
(`success`/`failed`), `email`, `applicationId`, `timestamp`. Per-type extras: `register`
(`name`, `gender` as **number** `0`/`1`), `login failed` (`reason: "Invalid credentials"`),
`photoUpload` (`fileName`, server-generated), `passwordChangeFailed` (`reason`),
`analyticsConsentChange` (`analyticsConsent` boolean). `todoCreate`/`todoComplete`/
`todoEdit`/`todoDelete`/`logout`/`passwordChangeSuccess` carry no extra fields — notably no
todo id, so events can only be correlated by `email` + `type` + time window, not a specific
todo.

## Known limitations / assumptions

- Analytics events are written asynchronously; all verifications poll rather than issue a
  single `GET`, with a default 10s timeout / 500ms interval (`src/utils/wait.ts`), though in
  practice events appeared close to synchronous during recon.
- The QA environment is shared and rate-limited (see above); tests avoid hardcoded data and
  generate unique users/emails/notes/tags per run, but the suite's own realistic
  `/api/auth/*` call budget sits close to the 40-per-15-minutes ceiling — re-running it
  repeatedly in a short window (e.g. iterating locally) can trip the limit even without any
  bug in the tests themselves.
