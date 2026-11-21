# AGENTS.md — `src/auth`

Sign-in with email + password through Better Auth (ADR-003), the session gate, the role gate, and the seeded users. Cross-cutting app code like `health/` and `http/`, **not a module** (maintainer decision on #10): it has no `domain/` or `application/`, because Better Auth owns the rules. Root rules in [`/AGENTS.md`](../../../../AGENTS.md) apply.

## Files

- `auth.table.ts` — Better Auth's four models in the Postgres schema `auth` (`auth.users` with the `role` column and its `CHECK`, `sessions`, `accounts`, `verifications`). Property names are Better Auth's field names; `authTables` is keyed by its model names (`user`, `session`…), which its drizzle adapter requires. A schema change: edit the table, `pnpm --filter @cuadre/api db:generate`.
- `auth.ts` — `createAuth(...)`: sign-up closed (`disableSignUp`), `role` an additional field with `input: false` (no endpoint takes it from the client), sessions and the rate limit at Better Auth's defaults (7 days renewed daily; the limit runs in production only). Do not shorten sessions without a warning before expiry (Login handoff, SC 2.2.1).
- `require-session.ts` — the gate `createApp` puts on `/api/*`: no valid session → 401 `UNAUTHORIZED` (`ApiError`); otherwise `c.get("user")` is the `SessionUser`.
- `roles.ts` — the role matrix at the API (PLAN → Roles, #11). `allowRoles(roles)` goes in each route's `createRoute({ middleware: [allowRoles(...)] })`: `@hono/zod-openapi` runs it before the validators, so a refused role gets 403 `FORBIDDEN` before any 400. `requireRoleDeclaration()` (on `/api/*`, after the session gate) answers 403 to any endpoint that declares no roles: **deny by default**. `routesWithoutRoles(app)` lists such endpoints; `roles.int.test.ts` asserts the app has none.
- `seed-users.ts` — one user per role, test credentials (`SEED_PASSWORD`), idempotent, one transaction per user. The only way users appear.

## Rules

- Better Auth answers `/api/auth/*` itself, with its own bodies (`{ code, message }`), not `ApiError`s: a deliberate exception to `src/http/api-error.ts`. Those routes are not in the OpenAPI document; the web types them with `SessionUser` from contracts and maps their codes in `apps/web/src/features/auth/sign-in-error.ts`.
- Better Auth rejects a cookie-bearing POST whose `Origin` is not trusted (CSRF). Trusted origins come from config (`BETTER_AUTH_URL` + `BETTER_AUTH_TRUSTED_ORIGINS`); tests send `TEST_ORIGIN` (`test/sign-in.ts`).
- Integration tests: `createTestApp(db)` and `signIn(db, testApp, role)` seed only that role (hashing is slow) and return the cookie + origin headers. `signInAll` + `expectAllowedRoles` (`test/roles.ts`) pin a route's roles in one line: allowed roles get the given status, every other role 403 `FORBIDDEN`.
- An **endpoint** for the role gate is any handler under `/api` (Better Auth's aside) registered with a method, or with `ALL` but terminal (`app.all`, a `use` that never calls `next`); middleware that calls `next` is not. A route's roles come from a shared list when the web also needs them (`PRODUCT_ROLES` in contracts); `allowRoles([])` throws when the route is defined.
- Cookies are per host, not per port: dev servers of several worktrees on `localhost` share the session cookie, and a different `BETTER_AUTH_SECRET` or database makes it invalid (sign in again).
