export interface PollOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 500;

/**
 * Polls `fn` until it returns a truthy value or the timeout elapses.
 * Analytics events are written asynchronously, so a single GET is not reliable.
 */
export async function poll<T>(fn: () => Promise<T | undefined | null>, opts: PollOptions = {}): Promise<T | undefined> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() >= deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
