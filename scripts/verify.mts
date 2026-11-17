// `pnpm verify` (ADR-014): boots Postgres, migrates and seeds a fresh e2e database, then runs the
// smoke E2E (Playwright starts and stops the api and web servers itself). Each step is named, so a
// failure says where it happened instead of timing out.
//
// Runs on Node's type stripping (no build, no dependencies). One `verify` per machine at a time:
// the e2e database and ports are shared.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const MINUTE = 60_000;

const e2eDatabaseUrl =
  process.env.DATABASE_URL_E2E ?? "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";
const apiPort = Number(process.env.E2E_API_PORT ?? 3100);
const webPort = Number(process.env.E2E_WEB_PORT ?? 4173);

class StepFailure extends Error {}

function fail(step: string, reason: string): never {
  console.error(`\nverify: step "${step}" failed: ${reason}`);
  process.exit(1);
}

/** Runs one command with inherited output; its exit status decides the step. */
function run(step: string, command: string, timeoutMs: number, env: NodeJS.ProcessEnv = {}) {
  console.log(`\n▶ verify: ${step}`);
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    timeout: timeoutMs,
    env: { ...process.env, ...env },
  });
  if (result.error) {
    const timedOut = "code" in result.error && result.error.code === "ETIMEDOUT";
    throw new StepFailure(
      timedOut ? `timed out after ${timeoutMs / 1000}s` : `could not run: ${result.error.message}`,
    );
  }
  if (result.status !== 0) throw new StepFailure(`\`${command}\` exited with ${result.status}`);
}

function isListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(1500);
    const settle = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
  });
}

/** Paths of the traces and screenshots Playwright keeps for failed tests. */
function failureArtifacts(): string[] {
  const dir = join(root, "apps", "web", "test-results");
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry === "trace.zip" || entry.endsWith(".png")) found.push(path);
    }
  };
  walk(dir);
  return found;
}

const steps: { name: string; run: () => Promise<void> | void }[] = [
  {
    name: "postgres",
    async run() {
      const url = new URL(e2eDatabaseUrl);
      const host = url.hostname;
      const port = Number(url.port || 5432);
      if (await isListening(host, port)) {
        console.log(`Postgres already answers on ${host}:${port}; reusing it.`);
        return;
      }
      run("postgres (docker compose)", "docker compose up -d --wait postgres", 5 * MINUTE);
    },
  },
  {
    name: "ports",
    async run() {
      for (const port of [apiPort, webPort]) {
        if (await isListening("127.0.0.1", port)) {
          throw new StepFailure(
            `port ${port} is in use (another verify or dev server running? set E2E_API_PORT / E2E_WEB_PORT)`,
          );
        }
      }
    },
  },
  {
    name: "database",
    run: () =>
      run(
        "database (create fresh + migrate)",
        "pnpm --filter @cuadre/api db:e2e:prepare --fresh",
        MINUTE,
        {
          DATABASE_URL_E2E: e2eDatabaseUrl,
        },
      ),
  },
  {
    name: "seed",
    run: () => run("seed", "pnpm db:seed", MINUTE, { DATABASE_URL: e2eDatabaseUrl }),
  },
  {
    name: "smoke",
    run() {
      try {
        run(
          "smoke (api + web + Playwright)",
          "pnpm --filter @cuadre/web exec playwright test",
          5 * MINUTE,
          { DATABASE_URL_E2E: e2eDatabaseUrl },
        );
      } catch (error) {
        const artifacts = failureArtifacts();
        const detail =
          artifacts.length > 0
            ? `\nTraces and screenshots:\n${artifacts.map((path) => `  ${path}`).join("\n")}\nOpen a trace with: pnpm --filter @cuadre/web exec playwright show-trace <trace.zip>`
            : "";
        throw new StepFailure(`${(error as Error).message}${detail}`);
      }
    },
  },
];

for (const step of steps) {
  try {
    await step.run();
  } catch (error) {
    if (error instanceof StepFailure) fail(step.name, error.message);
    throw error;
  }
}

console.log("\n✔ verify: all steps passed");
