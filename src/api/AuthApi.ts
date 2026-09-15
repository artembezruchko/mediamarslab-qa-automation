import { APIResponse, expect } from '@playwright/test';
import { endpoints } from './endpoints';
import { accessKeyHeader, createApiContext } from './httpContext';
import { TestUser, makeUser } from '../data/users';

export interface LoginResult {
  token: string;
  role: 'user' | 'admin';
  message: string;
}

// /api/auth/* has its own per-IP rate limit ("Too many auth requests. Please try again
// later.") that a fullyParallel suite provisioning one fresh user per test trips easily.
// Calls are serialized process-wide (one in flight at a time, with a spacing delay) rather
// than fired concurrently, and a 429 is retried with backoff as a second line of defense.
let authQueue: Promise<unknown> = Promise.resolve();
const MIN_SPACING_MS = 400;

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = authQueue.then(fn, fn);
  authQueue = run.then(
    () => new Promise((resolve) => setTimeout(resolve, MIN_SPACING_MS)),
    () => new Promise((resolve) => setTimeout(resolve, MIN_SPACING_MS)),
  );
  return run;
}

const MAX_WORTHWHILE_RETRY_WAIT_S = 20; // beyond this it would blow the test/global timeout anyway

async function postWithRetry(path: string, data: unknown, extraHeaders: Record<string, string> = {}, maxAttempts = 3) {
  const context = await createApiContext({ ...accessKeyHeader(), ...extraHeaders });
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await context.post(path, { data });
    if (response.status() !== 429) {
      return response;
    }
    const retryAfterS = Number(response.headers()['retry-after']);
    if (attempt === maxAttempts || !Number.isFinite(retryAfterS) || retryAfterS > MAX_WORTHWHILE_RETRY_WAIT_S) {
      return response; // a multi-minute rate-limit window can't be waited out inside a test
    }
    await new Promise((resolve) => setTimeout(resolve, retryAfterS * 1000));
  }
  throw new Error('unreachable');
}

/**
 * POST /api/auth/register|login|logout.
 *
 * X-Access-Key is sent on every call: the app's own frontend never sends it, but the
 * backend enforces it on every endpoint except POST /api/applications once a per-IP grace
 * quota of keyless requests is exhausted (confirmed via Phase 0 recon — see README "API
 * contract"). Omitting it here would make this class flaky depending on prior IP traffic.
 */
export class AuthApi {
  static register(user: Pick<TestUser, 'name' | 'email' | 'password' | 'gender'>): Promise<APIResponse> {
    return serialize(() =>
      postWithRetry(endpoints.authRegister, {
        name: user.name,
        email: user.email,
        gender: String(user.gender),
        password: user.password,
        photo: '',
        internalAnalyticsConsent: true,
      }),
    );
  }

  static login(email: string, password: string): Promise<APIResponse> {
    return serialize(() => postWithRetry(endpoints.authLogin, { email, password }));
  }

  static async logout(token: string): Promise<APIResponse> {
    const context = await createApiContext({ ...accessKeyHeader(), Authorization: `Bearer ${token}` });
    return context.post(endpoints.authLogout, { data: {} });
  }

  /** API-first test setup: registers + logs in a fresh unique user, returns the user and its token. */
  static async createAuthedUser(overrides: Partial<TestUser> = {}): Promise<{ user: TestUser; token: string }> {
    const user = makeUser(overrides);

    const registerResponse = await AuthApi.register(user);
    expect(registerResponse.status(), 'user registration failed during test setup').toBe(201);

    const loginResponse = await AuthApi.login(user.email, user.password);
    expect(loginResponse.status(), 'login failed right after registration during test setup').toBe(200);
    const body = (await loginResponse.json()) as LoginResult;

    return { user, token: body.token };
  }
}
