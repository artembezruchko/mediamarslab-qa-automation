import { expect } from '@playwright/test';
import { AnalyticsApi, AnalyticsEvent, EventFilter } from '../api/AnalyticsApi';
import { poll } from './wait';

export interface WaitForEventOptions {
  timeoutMs?: number;
  intervalMs?: number;
  /** Only consider events at/after this epoch ms, to avoid matching stale events from other runs. */
  sinceEpochMs?: number;
}

/**
 * Polls GET /api/analytics/events until an event matching `filter` shows up.
 * Event writes are asynchronous, so this must poll rather than issue a single GET.
 */
export async function waitForEvent(
  api: AnalyticsApi,
  filter: EventFilter,
  opts: WaitForEventOptions = {},
): Promise<AnalyticsEvent> {
  const event = await poll(() => api.findEvent(filter, opts.sinceEpochMs), {
    timeoutMs: opts.timeoutMs,
    intervalMs: opts.intervalMs,
  });

  expect(event, `Expected an analytics event matching ${JSON.stringify(filter)} but none appeared`).toBeTruthy();
  return event as AnalyticsEvent;
}

/**
 * Asserts that no event matching `filter` appears within a short grace window.
 * Used for "consent disabled" scenarios where events must NOT be recorded.
 */
export async function assertNoEvent(
  api: AnalyticsApi,
  filter: EventFilter,
  opts: WaitForEventOptions = {},
): Promise<void> {
  const event = await poll(() => api.findEvent(filter, opts.sinceEpochMs), {
    timeoutMs: opts.timeoutMs ?? 3_000,
    intervalMs: opts.intervalMs ?? 500,
  });
  expect(event, `Expected no analytics event matching ${JSON.stringify(filter)} but found one`).toBeFalsy();
}
