import { test as base } from './base.fixture';
import { AnalyticsEvent, EventFilter } from '../api/AnalyticsApi';
import { waitForEvent, assertNoEvent, WaitForEventOptions } from '../utils/analytics';

interface AnalyticsFixtures {
  /** Wall-clock start of the test, used to filter out stale events from earlier runs. */
  testStartMs: number;
  /** waitForEvent/assertNoEvent pre-bound to this test's analyticsApi and testStartMs. */
  analytics: {
    waitForEvent(filter: EventFilter, opts?: WaitForEventOptions): Promise<AnalyticsEvent>;
    assertNoEvent(filter: EventFilter, opts?: WaitForEventOptions): Promise<void>;
  };
}

export const test = base.extend<AnalyticsFixtures>({
  testStartMs: async ({}, use) => {
    await use(Date.now());
  },

  analytics: async ({ analyticsApi, testStartMs }, use) => {
    await use({
      waitForEvent: (filter, opts) => waitForEvent(analyticsApi, filter, { sinceEpochMs: testStartMs, ...opts }),
      assertNoEvent: (filter, opts) => assertNoEvent(analyticsApi, filter, { sinceEpochMs: testStartMs, ...opts }),
    });
  },
});

export { expect } from '@playwright/test';
