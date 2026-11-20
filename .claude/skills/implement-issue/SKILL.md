---
name: implement-issue
description: Take a GitHub issue from plan to a reviewed, ready PR. Run it as /implement-issue N, from a worktree. One issue, one branch, one PR.
argument-hint: "<issue-number>"
disable-model-invocation: true
---

# implement-issue

Issue → reviewed plan → implementation → verification → draft PR → review → ready PR. The maintainer approves the plan and reviews the final PR; everything in between runs without questions. Talk to the maintainer in Spanish; write code, commits, PRs and issues in English (AGENTS.md).

Target: issue **#$ARGUMENTS**.

## Contract

- **Invoking this skill authorizes:** renaming the branch, commits, `git push` of this branch, **one** PR (draft, then ready) and comments on the target issue (to ask or to escalate). Nothing else: no merge, no push to `main`, no force-push, no other branches, no issues created without asking.
- **All questions happen in Phase 1.** After the plan is approved, ask nothing until the final report. Only these stop you: a real blocker only the maintainer can solve; the three-rounds escalation (AGENTS.md); a contradiction with an ADR. Say which in the session and in the PR.
- Never weaken a gate (tool config, CI, `REVIEW.md`, `verify`, tests) to get green. If a gate must change, the PR justifies it (REVIEW item 10).
- Do not edit ADRs or fiscal rules: propose the change in the PR (AGENTS.md).

## Phase 0 — Guards

1. **Worktree.** `[ "$(git rev-parse --path-format=absolute --git-dir)" != "$(git rev-parse --path-format=absolute --git-common-dir)" ]` must hold (absolute paths, so it also works from a subdirectory). In the main checkout, stop and tell the maintainer: parallel sessions share it.
2. **Issue.** `gh issue view <n> --json number,title,body,labels,comments`. Stop unless it has the `agent-ready` label. If it touches `apps/web` and its **Design handoff** is incomplete (or it carries `needs-design`), stop (ADR-012): comment on the issue and tell the maintainer in the session to run `/design-screen <n>`, which drafts the design and writes the handoff for them to approve. Do not start the implementation and do not touch the labels.
3. **Branch.** Rename the generated `claude/…` branch before anything else: `git branch -m <type>/<n>-<slug>` (Conventional Commits type the PR title will carry; slug from the issue title). Renaming after the first push closes the PR.

## Phase 1 — Plan (all questions live here)

1. Enter plan mode. Read `docs/GLOSSARY.md`, the ADRs of the area, the module's `AGENTS.md` and the code the issue touches **before** asking anything: ask only what they do not answer.
2. Draft the plan.
3. **Review it:** spawn the `plan-reviewer` agent with the issue number and your draft. Take what is right, reject what is not, and keep a note of both.
4. Ask the maintainer every open question at once (`AskUserQuestion`, up to 4 per round; a second round only if an answer opens something new). An ambiguous fiscal rule is asked, never guessed; record the answer in the PR.
5. Present the plan with `ExitPlanMode`, with these sections:
   1. Steps, each as `step → verify: <command or test>`.
   2. Table: acceptance criterion → the test that covers it.
   3. `REVIEW.md` items the diff will trigger.
   4. Files touched.
   5. **Changes from the plan review:** what changed and what was rejected, and why.
6. The approval click is where the maintainer switches model and picks Auto. Do nothing about that; continue on whatever model is active.

## Phase 2 — Implement

- Test-first for domain rules; integration tests against Postgres for use cases; the issue's acceptance examples become tests; screens ship Playwright E2E for their acceptance criteria; ADR-named invariants get fast-check property tests (AGENTS.md → Non-negotiable rules, ADR-014).
- Small Conventional Commits as you go. New domain terms go into `docs/GLOSSARY.md` (Spanish column for UI copy).
- Stay inside the issue's **Out of scope**. Follow-ups you notice are listed for Phase 6, not built.

## Phase 3 — Verify

Run, and fix until green (three rounds, then escalate by commenting on the issue and stopping):

- Always: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, `pnpm test:integration` (`docker compose up -d` first), then the `verify` skill (`pnpm verify`).
- If the diff touches `apps/web`: also `pnpm test:e2e`, and the "Inspecting the running app" part of the `verify` skill on each changed screen (focus order, error states, console).

Anything not run is declared in the PR with its reason, never silently skipped. `PLAYWRIGHT_CHANNEL=msedge` where the Playwright download is unreachable.

**Parallel sessions.** Each worktree has its own databases (AGENTS.md → Worktrees), but `verify` and `pnpm test:e2e` share ports 3100/4173. If either fails at the `ports` step (or Playwright cannot bind them), assume another session is running: wait (about a minute between tries, up to 10 minutes) and retry. Waiting does not count as a fix round. After 10 minutes, stop and say so.

## Phase 4 — Draft PR

1. `git push -u origin <branch>`; `gh pr create --draft` with the repo's PR template (`Closes #<n>`, what changed, Verification ticked only for what ran, `Verified-by:` last line). Title: the Conventional Commit.
2. The review line (`pr-reviewer` with `REVIEW.md`, triggered items) and the `Verified-by:` trailer are left pending on purpose: Phase 6 fills them.

## Phase 5 — Review

1. Spawn the `pr-reviewer` agent with the PR number and the issue number, and tell it that the PR's review line and `Verified-by:` trailer are still pending (it must not report them). It returns one list tagged **Important**, **Nit** or **Pre-existing** and never edits files.
2. Apply it:
   - **Important:** fix, always.
   - **Nit:** fix if cheap; otherwise list it as accepted, with the reason, in the PR.
   - **Pre-existing:** do not touch; note it as a follow-up in the PR.
   - A finding whose fix contradicts an ADR or the issue is not applied: note it for the maintainer.
3. If an Important fix changed non-trivial logic, run `pr-reviewer` once more, telling it to review the **cumulative diff** against the base. Two rounds at most.
4. Re-run the Phase 3 checks that the fixes could affect, and push.

## Phase 6 — Ready

1. Update the PR body: Verification (what actually ran), triggered `REVIEW.md` items, findings fixed / accepted / follow-up, the fixes made after the last review (nobody reviewed those: Nit fixes and second-round fixes), and the `Verified-by:` trailer (use `pr-reviewer`, not `code-review`, for the review).
2. `gh pr checks` **once**. A failed check is fixed (it counts toward the three rounds), and the report says its new run is still pending or red until you have seen it. A check still running is not waited for: say so in the report.
3. `gh pr ready`.
4. Report to the maintainer, in Spanish and short: the PR link; what was verified and what was not; review findings (fixed, accepted, follow-ups); and **where to look in the manual review**: ADR edits, gate changes (REVIEW item 10), and any decision taken without asking.
5. Offer to create each follow-up as a `needs-triage` issue ("Found in <PR>"). Create them only on a yes.
