---
name: implement-issue
description: Take a Cuadre GitHub issue from reviewed plan to a reviewed, ready PR in Antigravity. Use when the maintainer asks to implement a GitHub issue number (one issue, one branch, one PR, run from a git worktree).
---

# implement-issue

Issue → reviewed plan → implementation → verification → draft PR → review → ready PR. The maintainer approves the plan and reviews the final PR; everything in between runs without questions. Talk to the maintainer in Spanish; write code, commits, PRs and issues in English (`AGENTS.md`).

Apply this workflow to the target GitHub issue number `<n>` provided by the maintainer.

## Contract

- **Invoking this skill authorizes:** creating or renaming the branch, commits, `git push` of this branch, **one** PR (draft, then ready) and comments on the target issue (to ask or to escalate). Nothing else: no merge, no push to `main`, no force-push, no other branches, no issues created without asking.
- **All questions happen in Phase 1.** After the plan is approved, ask nothing until the final report. Only these stop you: a real blocker only the maintainer can solve; the three-rounds escalation (`AGENTS.md`); a contradiction with an ADR. Say which in the session and in the PR.
- Never weaken a gate (tool config, CI, `REVIEW.md`, `verify`, tests) to get green. If a gate must change, the PR justifies it (REVIEW item 10).
- Do not edit ADRs or fiscal rules: propose the change in the PR (`AGENTS.md`).
- **Network / GitHub CLI on Windows:** `gh` and `git push` may require `BypassSandbox: true` in `run_command` (try sandboxed first per terminal rules, then retry with `BypassSandbox: true` if blocked).

## Phase 0 — Guards

1. **Worktree.** Verify you are running in a linked git worktree, not the main checkout:
   - PowerShell: `(git rev-parse --path-format=absolute --git-dir) -ne (git rev-parse --path-format=absolute --git-common-dir)`
   - If running in the main checkout, stop and tell the maintainer to open or create a `git worktree` (parallel sessions share the main checkout).
2. **Issue.** Run `gh issue view <n> --json number,title,body,labels,comments`. Stop unless it has the `agent-ready` label. If it touches `apps/web` and its **UI spec** is missing state, copy, or error details, do not stop here — gather those questions and ask the maintainer in Phase 1 before coding (ADR-012).
3. **Branch.** Ensure the branch follows `<type>/<n>-<slug>` (Conventional Commits type the PR title will carry; lowercase kebab-case slug from the issue title):
   - If currently on `main`, create the branch with `git checkout -b <type>/<n>-<slug>` (never rename `main`).
   - If on an unpublished temporary work branch that does not match the convention, rename it with `git branch -m <type>/<n>-<slug>` before the first push (renaming after the first push closes the PR).

## Phase 1 — Plan (all questions live here)

1. Read `docs/GLOSSARY.md`, the ADRs of the area, the module's `AGENTS.md`, and the code the issue touches **before** asking anything: ask only what they do not answer.
2. Draft the implementation plan.
3. **Review it:** invoke the `plan-reviewer` subagent via `invoke_subagent` with the issue number and your draft plan. Take what is right, reject what is not, and keep a note of both.
4. Ask the maintainer every open question at once with `ask_question` (a second round only if an answer opens something new). An ambiguous fiscal rule is asked, never guessed; record the answer in the PR.
5. Present the final plan: if Plan Mode is active (where `write_file` is read-only/blocked), present the full plan directly in chat and wait for explicit maintainer approval before calling `exit_plan_mode`; otherwise write it as an artifact using `write_file` with `ArtifactMetadata: { UserFacing: true, RequestFeedback: true }`. Include:
   1. Steps, each as `step → verify: <command or test>`.
   2. Table: acceptance criterion → the test that covers it.
   3. `REVIEW.md` items the diff will trigger.
   4. Files touched.
   5. **Changes from the plan review:** what changed and what was rejected, and why.
6. Wait for explicit maintainer approval before making any code changes.

## Phase 2 — Implement

- Test-first for domain rules; integration tests against Postgres for use cases; the issue's acceptance examples become tests; screens ship Playwright E2E for their acceptance criteria; ADR-named invariants get fast-check property tests (`AGENTS.md` → Non-negotiable rules, ADR-014).
- Small Conventional Commits as you go. New domain terms go into `docs/GLOSSARY.md` (Spanish column for UI copy).
- Stay inside the issue's **Out of scope**. Follow-ups you notice are listed for Phase 6, not built.

## Phase 3 — Verify

Run, and fix until green (three rounds, then escalate by commenting on the issue and stopping):

- Always: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration` (`docker compose up -d` first), then the `verify` skill (`pnpm verify`).
- If the diff touches `apps/web`: also run `pnpm test:e2e`, read the `verify` skill, and complete its "Inspecting the running app beyond the smoke test" section via the `browser` subagent on every changed screen (1280 px layout, focus order, error states, console) before Phase 4. Record the inspected screens in the PR's **Evidence / notes** (or leave the live UI inspection checkbox unticked with the reason).

Anything not run is declared in the PR with its reason, never silently skipped. Where the Playwright browser download is unreachable on Windows PowerShell, use `$env:PLAYWRIGHT_CHANNEL = "msedge"; pnpm verify` (or `pnpm test:e2e`).

**Parallel sessions.** `verify` and `pnpm test:e2e` share ports 3100/4173 and the `cuadre_e2e` database; the integration tests share `cuadre_test`. If `verify` or `test:e2e` fails at the `ports` step, or a database is busy, assume another session is running: wait (about a minute between tries, up to 10 minutes) and retry. Two integration runs at once give no clear error, only odd failures: before "fixing" an inexplicable integration failure, check whether another session is running (`docker compose logs`, open connections to `cuadre_test`) and retry alone. Waiting does not count as a fix round. After 10 minutes, stop and say so.

## Phase 4 — Draft PR

1. `git push -u origin <branch>`; `gh pr create --draft` with the repo's PR template (`.github/pull_request_template.md`: `Closes #<n>`, what changed, Verification ticked only for what ran, `Verified-by:` last line). Title: the Conventional Commit.
2. The review line (`pr-reviewer` with `REVIEW.md`, triggered items) and the `Verified-by:` trailer are left pending on purpose: Phase 6 fills them.

## Phase 5 — Review

1. Invoke the `pr-reviewer` subagent via `invoke_subagent` with the PR number and the issue number, telling it that the PR's review line and `Verified-by:` trailer are still pending (it must not report them). It returns one list tagged **Important**, **Nit** or **Pre-existing** and never edits files.
2. Apply it:
   - **Important:** fix, always.
   - **Nit:** fix if cheap; otherwise list it as accepted, with the reason, in the PR.
   - **Pre-existing:** do not touch; note it as a follow-up in the PR.
   - A finding whose fix contradicts an ADR or the issue is not applied: note it for the maintainer.
3. If an Important fix changed non-trivial logic, run `pr-reviewer` once more, telling it to review the **cumulative diff** against the base. Two rounds at most.
4. Re-run the Phase 3 checks that the fixes could affect, and push.

## Phase 6 — Ready

1. Update the PR body: Verification (what actually ran), triggered `REVIEW.md` items, findings fixed / accepted / follow-up, the fixes made after the last review (nobody reviewed those: Nit fixes and second-round fixes), and the `Verified-by:` trailer (use `pr-reviewer` for the review).
2. Run `gh pr checks` **once**. A failed check is fixed (it counts toward the three rounds), and the report says its new run is still pending or red until you have seen it. A check still running is not waited for: say so in the report.
3. Run `gh pr ready`.
4. Report to the maintainer, in Spanish and short: the PR link; what was verified and what was not; review findings (fixed, accepted, follow-ups); and **where to look in the manual review**: ADR edits, gate changes (REVIEW item 10), and any decision taken without asking.
5. Offer to create each follow-up as a `needs-triage` issue ("Found in `<PR>`"). Create them only on a yes.
