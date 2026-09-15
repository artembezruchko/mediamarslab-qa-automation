# Quick start

Playwright + TypeScript test suite for the mediamarslab recruitment QA app. For the full
picture (API contract, rate limits, test patterns, coverage notes) see [README.md](README.md)
— this file only gets you running.

## 1. Install

```bash
npm install
npx playwright install --with-deps chromium
```

## 2. Configure

```bash
cp .env.example .env
```

Fill in `.env` with real values: the app origin, the `X_ACCESS_KEY` and admin credentials
issued once by `POST /api/applications`, and the analytics Basic-auth credentials. Never
commit `.env`.

## 3. Run

```bash
npm test              # everything
npm run test:resilient # everything, auto-retrying rate-limit-caused failures
npm run test:ui-mode  # Playwright's interactive UI mode — good for a first look
npm run report        # open the last HTML report
```

Tests run fully serialized (one at a time) — this is intentional, not a performance bug. The
backend enforces a hard rate limit on login/register calls, and running in parallel blows
through it. See README.md → "Rate limits" before changing `workers` in
`playwright.config.ts`.

## Something failed

Before assuming it's a real bug: re-run just that test on its own. This suite shares a live
QA environment with a tight rate limit, so a handful of failures clustered at the end of a
full run are usually that budget resetting, not a regression — `npm run test:resilient`
handles this automatically. Details: README.md → "Rate limits" and "Known limitations".
