import { APIRequestContext, expect } from '@playwright/test';
import { env } from '../config/env';
import { endpoints } from './endpoints';
import { accessKeyHeader, AccessKeyOptions, createApiContext, ApiContextWrapper } from './httpContext';

export interface AnalyticsEvent {
  type: string;
  status?: 'success' | 'failed';
  timestamp?: string | number;
  email?: string;
  name?: string;
  gender?: 0 | 1;
  fileName?: string;
  reason?: string;
  analyticsConsent?: boolean;
  [key: string]: unknown;
}

export type EventFilter = Partial<{
  type: string;
  status: 'success' | 'failed';
  email: string;
  name: string;
  gender: 0 | 1;
  fileName: string;
  reason: string;
  analyticsConsent: boolean;
}>;

export interface AnalyticsApiOptions extends AccessKeyOptions {
  /** Omit HTTP Basic auth — used by negative auth tests. Defaults to true. */
  withBasicAuth?: boolean;
}

const EVENTS_PATH = endpoints.analyticsEvents;

function matchesFilter(event: AnalyticsEvent, filter: EventFilter): boolean {
  return (Object.keys(filter) as (keyof EventFilter)[]).every((key) => event[key] === filter[key]);
}

/** Wraps GET /api/analytics/events. Auth is HTTP Basic AND (once the grace quota is spent) X-Access-Key. */
export class AnalyticsApi extends ApiContextWrapper {
  private constructor(context: APIRequestContext) {
    super(context);
  }

  static async create(opts: AnalyticsApiOptions = {}): Promise<AnalyticsApi> {
    const headers: Record<string, string> = { ...accessKeyHeader(opts) };
    if (opts.withBasicAuth ?? true) {
      const token = Buffer.from(`${env.analyticsBasicUser}:${env.analyticsBasicPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }

    const context = await createApiContext(headers);
    return new AnalyticsApi(context);
  }

  async getRawResponse() {
    return this.context.get(EVENTS_PATH);
  }

  /** Fetches all events from the last 24h window returned by the API. */
  async getEvents(): Promise<AnalyticsEvent[]> {
    const response = await this.context.get(EVENTS_PATH);
    expect(response.ok(), `GET ${EVENTS_PATH} failed with ${response.status()}`).toBeTruthy();
    return (await response.json()) as AnalyticsEvent[];
  }

  async findEvent(filter: EventFilter, sinceEpochMs?: number): Promise<AnalyticsEvent | undefined> {
    const events = await this.getEvents();
    return events
      .filter((event) => matchesFilter(event, filter))
      .find((event) => {
        if (sinceEpochMs === undefined) return true;
        const ts = event.timestamp ? new Date(event.timestamp).getTime() : undefined;
        return ts === undefined || ts >= sinceEpochMs;
      });
  }
}
