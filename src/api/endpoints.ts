/**
 * Central inventory of API paths, confirmed via Phase 0 network/source recon against the
 * live app (js/*.js). See README.md "API contract" for the full request/response reference.
 *
 * Auth model: every endpoint except POST /api/applications expects `Authorization: Bearer
 * <token>` (token from POST /api/auth/login). The app's own frontend never sends
 * `X-Access-Key` at all, but the backend DOES enforce it server-side on every one of these
 * endpoints once a per-IP grace quota of keyless requests is exhausted — this suite always
 * sends a valid one (see `accessKeyHeader()` in `httpContext.ts`) rather than depend on that
 * quota. GET /api/analytics/events additionally requires HTTP Basic auth on top of the key.
 * Full writeup: README.md "API contract" and `tests/api/access-control.spec.ts` (DISC-01/02).
 */
export const endpoints = {
  applications: '/api/applications',

  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',

  profile: '/api/profile',
  profilePhoto: '/api/profile/photo',
  profilePassword: '/api/profile/password',

  todos: '/api/todos',
  todo: (id: string) => `/api/todos/${id}`,

  tags: '/api/tags',
  tag: (id: string) => `/api/tags/${id}`,
  tagsEnsure: '/api/tags/ensure',
  tagsPalette: '/api/tags/palette',

  adminOverview: '/api/admin/overview',

  analyticsEvents: '/api/analytics/events',
} as const;
