import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { env } from '../config/env';

export interface AccessKeyOptions {
  /**
   * Send X-Access-Key. Defaults to true — every endpoint except POST /api/applications
   * enforces this once the per-IP grace quota of keyless requests is exhausted (see
   * README "API contract"). Set to false, or pass an override, only for the tests that
   * specifically probe this behavior.
   */
  withAccessKey?: boolean;
  accessKeyOverride?: string;
}

/** The single place that decides whether/what X-Access-Key value to send. */
export function accessKeyHeader(opts: AccessKeyOptions = {}): Record<string, string> {
  if (!(opts.withAccessKey ?? true)) {
    return {};
  }
  return { 'X-Access-Key': opts.accessKeyOverride ?? env.accessKey };
}

/** Every API wrapper in `src/api` talks to the same base URL through this one factory. */
export async function createApiContext(headers: Record<string, string> = {}): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: env.apiBaseUrl, extraHTTPHeaders: headers });
}

/**
 * Shared `dispose()` for the thin class wrappers in `src/api` (ApiClient, AnalyticsApi) that
 * hold one APIRequestContext and nothing else.
 */
export abstract class ApiContextWrapper {
  protected constructor(protected readonly context: APIRequestContext) {}

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
