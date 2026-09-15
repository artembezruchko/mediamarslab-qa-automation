import { test as base } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { AnalyticsApi } from '../api/AnalyticsApi';
import { AuthApi } from '../api/AuthApi';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AdminPage } from '../pages/AdminPage';
import { VacancyApplicationPage } from '../pages/VacancyApplicationPage';
import { TestUser } from '../data/users';

interface Fixtures {
  apiClient: ApiClient;
  analyticsApi: AnalyticsApi;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  dashboardPage: DashboardPage;
  profilePage: ProfilePage;
  adminPage: AdminPage;
  vacancyApplicationPage: VacancyApplicationPage;
}

interface WorkerFixtures {
  workerUser: { user: TestUser; token: string };
}

// /api/auth/* enforces a hard 40-requests-per-15-minutes-per-IP limit (confirmed via the
// RateLimit-*/Retry-After response headers during Phase 0 recon). A fresh user per TEST
// blows through that budget almost immediately on a suite this size, so the session is
// instead provisioned once per WORKER PROCESS and reused by every test that worker runs.
// Because a worker runs its tests one at a time, this still avoids the original problem
// (two tests concurrently mutating the same account — e.g. one flips analyticsConsent off
// while another asserts an event fires) without exhausting the auth-endpoint quota.
// dashboardPage's DashboardPage.findTodo()/toggleComplete()/editTodo()/openDeleteModalFor()
// search by each note's unique generated title so accumulated data from earlier tests on
// the same worker never hides an item behind pagination.
export const test = base.extend<Fixtures, WorkerFixtures>({
  workerUser: [
    async ({}, use) => {
      const authed = await AuthApi.createAuthedUser();
      await use(authed);
    },
    { scope: 'worker' },
  ],

  apiClient: async ({}, use) => {
    const client = await ApiClient.create();
    await use(client);
    await client.dispose();
  },

  analyticsApi: async ({}, use) => {
    const api = await AnalyticsApi.create();
    await use(api);
    await api.dispose();
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },

  vacancyApplicationPage: async ({ page }, use) => {
    await use(new VacancyApplicationPage(page));
  },

  // Auth-flow tests that manage their own session end-to-end (register/login/logout UI,
  // e2e journeys) must NOT use these fixtures — instantiate `new DashboardPage(page)` /
  // `new ProfilePage(page)` directly there instead, since injecting the worker's session
  // token would trigger register.html/index.html's own "already logged in" redirect before
  // the test's manual flow runs.
  dashboardPage: async ({ page, workerUser }, use) => {
    await page.addInitScript((t: string) => window.localStorage.setItem('token', t), workerUser.token);
    await use(new DashboardPage(page));
  },

  profilePage: async ({ page, workerUser }, use) => {
    await page.addInitScript((t: string) => window.localStorage.setItem('token', t), workerUser.token);
    await use(new ProfilePage(page));
  },

  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
});

export type { TestUser };
export { expect } from '@playwright/test';
