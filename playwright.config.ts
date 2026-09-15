import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.BASE_URL ?? 'https://qa-a.recruitment.mediamarslab.com';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  // Fully serialized (not left at the CPU-count default): /api/auth/* enforces a hard 40
  // requests / 15 minutes per IP (confirmed via RateLimit-*/Retry-After response headers —
  // see README "API contract"). With >1 worker, Playwright can run multiple *projects*
  // concurrently (each with its own worker-scoped fixtures), which multiplies real auth
  // calls well past what a single project's own budget implies. workers:1 guarantees only
  // one test (in one project) ever runs at a time for the whole suite.
  //
  // NOTE: ordering between projects is intentionally NOT enforced via Playwright's
  // `dependencies` beyond the one legitimate case (admin needs setup's storageState).
  // `dependencies` skips a project entirely if its dependency has ANY failing test — fine
  // for a real setup step, but abusing it purely to sequence unrelated test projects means
  // one flaky chromium-ui test silently skips auth-ui/e2e/admin instead of just failing.
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The app's own frontend never sends this header, but the backend grants each IP only
    // a small grace quota of keyless requests before it starts strictly requiring a valid
    // X-Access-Key on every endpoint except POST /api/applications (confirmed via Phase 0
    // recon + live probing — see README "API contract"). Sending it unconditionally here
    // avoids the whole suite going flaky once that quota is exhausted mid-run.
    extraHTTPHeaders: process.env.X_ACCESS_KEY ? { 'X-Access-Key': process.env.X_ACCESS_KEY } : {},
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'api',
      testDir: './tests/api',
      use: {},
    },
    {
      name: 'chromium-ui',
      testDir: './tests/ui',
      testIgnore: ['**/auth/**', '**/admin/**'],
      // No shared storageState: the dashboardPage/profilePage fixtures provision one fresh
      // user per WORKER process (not per test — see base.fixture.ts). With workers:1 that's
      // exactly one user for this project's entire run.
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'auth-ui',
      testDir: './tests/ui/auth',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testDir: './tests/ui/admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
});
