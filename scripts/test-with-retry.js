#!/usr/bin/env node
'use strict';

// Wraps `playwright test` with a rate-limit-aware retry. Two separate per-IP limits can
// cause a run to fail (see README "Rate limits"): /api/auth/* (40 req/15min, probed below
// via its own RateLimit-*/Retry-After headers) and a general limit on every other endpoint
// (200 req/60s — e.g. /api/tags*) that this script has no header to probe, since a failing
// test doesn't hand us one. A plain Playwright retry (playwright.config.ts `retries`) fires
// immediately and can re-hit either exhausted window, so it can't fix this on its own —
// this script always waits at least MIN_COOLDOWN_MS (comfortably past the general bucket's
// 60s window) before every retry round, and extends that wait further if the auth-specific
// probe reports a longer Retry-After, then re-runs just the failed tests (`--last-failed`)
// rather than the whole suite again.
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');
require('dotenv').config();

const MAX_ROUNDS = Number(process.env.RETRY_ROUNDS ?? 3);
const FALLBACK_COOLDOWN_MS = Number(process.env.RETRY_COOLDOWN_MS ?? 6 * 60 * 1000);
// The general (non-auth) rate limit resets in 60s (see README "Rate limits") — this is the
// floor every retry round waits out, regardless of what the auth-specific probe below says,
// since that probe can't see this bucket at all.
const MIN_COOLDOWN_MS = Number(process.env.RETRY_MIN_COOLDOWN_MS ?? 90 * 1000);

function runPlaywright(args) {
  const result = spawnSync('npx', ['playwright', 'test', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A deliberately-wrong login: only the RateLimit-*/Retry-After response headers matter here,
// not the (rejected) credentials.
function checkAuthBudget() {
  return new Promise((resolve) => {
    const base = process.env.API_BASE_URL;
    if (!base) {
      resolve(null);
      return;
    }
    let url;
    try {
      url = new URL('/api/auth/login', base);
    } catch {
      resolve(null);
      return;
    }
    const body = JSON.stringify({ email: 'rate-limit-probe@example.com', password: 'x' });
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(process.env.X_ACCESS_KEY ? { 'X-Access-Key': process.env.X_ACCESS_KEY } : {}),
        },
        timeout: 10_000,
      },
      (res) => {
        res.resume();
        const remaining = Number(res.headers['ratelimit-remaining']);
        const retryAfterS = Number(res.headers['retry-after']);
        resolve({
          remaining: Number.isFinite(remaining) ? remaining : null,
          retryAfterS: Number.isFinite(retryAfterS) ? retryAfterS : null,
        });
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

async function waitForBudget(round) {
  const budget = await checkAuthBudget();

  const authLooksLow = !budget || budget.remaining === null || budget.remaining <= 5;
  const authWaitMs = budget && budget.retryAfterS ? (budget.retryAfterS + 5) * 1000 : FALLBACK_COOLDOWN_MS;
  const waitMs = authLooksLow ? Math.max(MIN_COOLDOWN_MS, authWaitMs) : MIN_COOLDOWN_MS;

  const budgetNote = budget ? `${budget.remaining ?? '?'} remaining` : 'could not probe it';
  console.log(
    `  /api/auth/* budget: ${budgetNote}. Waiting ${Math.round(waitMs / 1000)}s (round ${round}/${MAX_ROUNDS}) — ` +
      'also covers the separate general per-IP limit on other endpoints, which this script ' +
      'has no header to probe — before retrying the failed tests...',
  );
  await sleep(waitMs);
}

async function main() {
  const extraArgs = process.argv.slice(2);

  if (runPlaywright(extraArgs)) {
    console.log('\nAll tests passed on the first attempt.');
    return;
  }

  console.log(
    '\nSome tests failed. This suite shares a live backend with real per-IP rate limits ' +
      '(see README "Rate limits") — failures clustered near the end of a full run are usually ' +
      'one of those budgets, not a regression. Re-running only the failed tests once the ' +
      'windows have had time to clear...',
  );

  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    await waitForBudget(round);

    if (runPlaywright(['--last-failed', ...extraArgs])) {
      console.log(`\nAll previously-failed tests passed on retry round ${round}.`);
      return;
    }
  }

  console.error(
    `\nTests are still failing after ${MAX_ROUNDS} retry round(s) — this may be a real ` +
      'regression rather than rate-limiting. Check the HTML report (npm run report).',
  );
  process.exitCode = 1;
}

main();
