---
name: verify
description: Run the app for real to verify a change (ADR-014). Use before opening a PR, when asked to "verify", "run the smoke test" or "check it works", and whenever a change touches the API, the web app, migrations or the seed.
---

# verify

Verification means running the change, not just compiling it. `pnpm verify` is the one command; this skill only tells you when to run it and what to do with the result.

## Run it

```bash
pnpm verify
```

Needs Docker running (or a Postgres already answering on `localhost:5433`). On a machine without the Playwright browser download, use an installed one: `PLAYWRIGHT_CHANNEL=msedge pnpm verify` (or `chrome`). Run **one `verify` at a time per machine**: ports 3100/4173 are shared (`E2E_API_PORT`, `E2E_WEB_PORT` override them). The e2e database is the checkout's own (`cuadre_e2e`, or `cuadre_wt_<worktree>__e2e` in a worktree).

## What it does

Each step prints `▶ verify: <name>`; a failure ends with `verify: step "<name>" failed: <reason>`.

| Step | Does | A failure here means |
|---|---|---|
| `postgres` | Reuses Postgres if it answers, else `docker compose up -d --wait postgres` | Docker is not running or the container is unhealthy |
| `ports` | Checks 3100 and 4173 are free | Another `verify` or server is running |
| `database` | Drops and recreates the e2e database, runs the migrations | A broken or conflicting migration |
| `seed` | Runs `pnpm db:seed` against the e2e database | The seed does not apply on the current schema |
| `smoke` | Playwright starts the api and web servers, runs the smoke E2E | The app does not boot, or the smoke flow broke |

On a smoke failure it prints the paths of the Playwright `trace.zip` and screenshots under `apps/web/test-results/`. Open a trace with `pnpm --filter @cuadre/web exec playwright show-trace <trace.zip>`; read screenshots with the Read tool.

## Rules

- Never weaken `verify`, the smoke test or Playwright's `retries: 0` to get green; fix the cause. After three failed fix rounds, stop and explain (AGENTS.md).
- Passing the smoke does not mean your change works: it only proves the app boots and the main flow runs. Check your change by hand too (below).
- Fill the PR's **Verification** section and `Verified-by:` trailer with what ran.

## Inspecting the running app beyond the smoke test

1. Start Postgres and the dev database: `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`.
2. Start the servers with the preview tools: `preview_start` with `api` (port 3000), then `web` (port 5173). Stop previews before switching worktrees; they share the ports.
3. Drive the page with the built-in browser tools (`navigate`, `read_page`, `find`, `computer`, `read_console_messages`, `read_network_requests`). Prefer `read_page` over screenshots for text and structure.
4. Check keyboard order and focus, error states (stop the api to see the load error) and the browser console.
