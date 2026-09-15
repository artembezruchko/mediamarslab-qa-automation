import { APIRequestContext } from '@playwright/test';
import { accessKeyHeader, AccessKeyOptions, createApiContext, ApiContextWrapper } from './httpContext';

export interface ApiClientOptions extends AccessKeyOptions {
  /** Authorization: Bearer <token>, obtained from POST /api/auth/login. */
  token?: string;
}

/**
 * Thin wrapper around Playwright's APIRequestContext for calling protected endpoints
 * (todos, tags, profile, admin) which authenticate via `Authorization: Bearer <token>`.
 */
export class ApiClient extends ApiContextWrapper {
  private constructor(context: APIRequestContext) {
    super(context);
  }

  static async create(opts: ApiClientOptions = {}): Promise<ApiClient> {
    const headers: Record<string, string> = { ...accessKeyHeader(opts) };
    if (opts.token) {
      headers['Authorization'] = `Bearer ${opts.token}`;
    }
    const context = await createApiContext(headers);
    return new ApiClient(context);
  }

  get raw(): APIRequestContext {
    return this.context;
  }
}
