import { endpoints } from './endpoints';
import { createApiContext } from './httpContext';

export interface ApplicationPayload {
  fullName: string;
  [key: string]: unknown;
}

/**
 * POST /api/applications — the only endpoint that does NOT require X-Access-Key.
 * Returns a fresh access key + one-time admin credentials.
 */
export class ApplicationsApi {
  static async submit(payload: ApplicationPayload) {
    // Context is intentionally not disposed here: disposing invalidates the still-unread
    // APIResponse body. Each call creates a short-lived context that Playwright tears down
    // with the worker process.
    const context = await createApiContext();
    return context.post(endpoints.applications, { data: payload });
  }
}
