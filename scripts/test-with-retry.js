#!/usr/bin/env node
'use strict';

// Wraps `playwright test` with a rate-limit-aware retry: /api/auth/* enforces a hard
// 40-requests-per-15-minute-window-per-IP limit (see README "Rate limits"), and a full
// suite run can exhaust it right near the end, failing whichever tests happened to need an
// auth call in that last stretch. A plain Playwright retry (playwright.config.ts `retries`)
// fires immediately and re-hits the same exhausted window, so it can't fix this — this
// script instead checks the real budget via the API's own RateLimit-*/Retry-After response
// headers, waits only as long as actually needed, and then re-runs just the failed tests
// (`--last-failed`) rather than the whole suite again.
const { spawnSync } = require('child_process');
const https = require('https');
const http = require('http');
require('dotenv').config();

const MAX_ROUNDS = Number(process.env.RETRY_ROUNDS ?? 3);
const FALLBACK_COOLDOWN_MS = Number(process.env.RETRY_COOLDOWN_MS ?? 6 * 60 * 1000);

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

  if (budget && budget.remaining !== null && budget.remaining > 5) {
    console.log(`  /api/auth/* budget looks fine (${budget.remaining} remaining) — retrying without waiting.`);
    return;
  }

  const waitMs = budget && budget.retryAfterS ? (budget.retryAfterS + 5) * 1000 : FALLBACK_COOLDOWN_MS;
  const budgetNote = budget ? ` (${budget.remaining ?? '?'} remaining)` : ' (could not probe it)';
  console.log(
    `  /api/auth/* budget looks low${budgetNote} — waiting ${Math.round(waitMs / 1000)}s ` +
      `(round ${round}/${MAX_ROUNDS}) before retrying the failed tests...`,
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
    '\nSome tests failed. This suite is bound by a real per-IP rate limit on /api/auth/* ' +
      '(see README "Rate limits") — failures clustered near the end of a full run are usually ' +
      'that budget, not a regression. Re-running only the failed tests once the window allows it...',
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
