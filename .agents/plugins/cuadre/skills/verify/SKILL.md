---
name: verify
description: Run the app for real to verify a change (ADR-014). Use before opening a PR, when asked to "verify", "run the smoke test" or "check it works", and whenever a change touches the API, the web app, migrations or the seed.
---

# verify

Verification means running the change, not just compiling it. `pnpm verify` is the one command; this skill only tells you when to run it and what to do with the result.

## Run it

```powershell
pnpm verify
```

Needs Docker running (or Postgres already answering on `localhost:5433`). On a Windows machine without the Playwright browser download, use an installed browser in PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"; pnpm verify
```

(or `"chrome"`). Run **one `verify` at a time per machine**: the `cuadre_e2e` database and ports 3100/4173 are shared (`E2E_API_PORT`, `E2E_WEB_PORT` override the ports).

## What it does

Each step prints `▶ verify: <name>`; a failure ends with `verify: step "<name>" failed: <reason>`.

| Step | Does | A failure here means |
|---|---|---|
| `postgres` | Reuses Postgres if it answers, else `docker compose up -d --wait postgres` | Docker is not running or the container is unhealthy |
| `ports` | Checks 3100 and 4173 are free | Another `verify` or server is running |
| `database` | Drops and recreates `cuadre_e2e`, runs the migrations | A broken or conflicting migration |
| `seed` | Runs `pnpm db:seed` against `cuadre_e2e` | The seed does not apply on the current schema |
| `smoke` | Playwright starts the api and web servers, runs the smoke E2E | The app does not boot, or the smoke flow broke |

On a smoke failure it prints the paths of the Playwright `trace.zip` and screenshots under `apps/web/test-results/`. Open a trace with `pnpm --filter @cuadre/web exec playwright show-trace <trace.zip>`; inspect screenshots with `read_file`.

## Rules

- Never weaken `verify`, the smoke test or Playwright's `retries: 0` to get green; fix the cause. After three failed fix rounds, stop and explain (`AGENTS.md`).
- Passing the smoke does not mean your change works: it only proves the app boots and the main flow runs. Check your change by hand too (below).
- Fill the PR's **Verification** section and `Verified-by:` trailer with what ran.

## Inspecting the running app beyond the smoke test

1. Start Postgres and prepare the dev database: `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`.
2. Start the `api` (port 3000) and `web` (port 5173) dev servers as background daemons with `run_command` using **`IsDaemon: true` and `BypassSandbox: true`**:
   - `pnpm --filter @cuadre/api dev`
   - `pnpm --filter @cuadre/web dev`
   > On Windows, a server started inside the sandbox is only reachable from the same command that started it — neither the `browser` subagent nor the user's browser can reach it unless started with `BypassSandbox: true`.
3. Delegate interactive UI inspection to Antigravity's built-in `browser` subagent via `invoke_subagent` (with `TypeName: "browser"` and `Model: "flash"`): navigate to `http://localhost:5173`, check keyboard order and focus, error states (stop the `api` daemon to verify load errors), and browser console / network errors.
4. Stop both daemon tasks with `manage_task` (`Action: "kill"`) when finished and before switching worktrees (they share ports 3000 and 5173).
