# ADR-014: Verification layer

**Status:** Accepted

## Context
Cuadre is built mainly by AI agents (ADR-011). The maintainer cannot read every diff closely, so how much work can be delegated depends on how well agents check their own work, and on those checks being hard to fool. Based on how the Claude Code team verifies agent-written code (https://claude.dev/blog/how-the-claude-code-team-thinks-about-verification/), adapted to a solo portfolio project.

## Decision
- **Verification means running the change.** `pnpm verify` boots Postgres, migrates, seeds, starts api + web and runs a Playwright smoke test, reporting traces and screenshots on failure. It is agent-agnostic; a thin `verify` Claude Code skill wraps it and may also drive the running app in a browser. It is the one extra project skill allowed before a pattern repeats (ADR-011): it is the smoke harness everything else relies on.
- **E2E per slice.** Every slice that adds or changes a screen ships Playwright E2E tests for its acceptance criteria. The issue's acceptance criteria are the rubric; there is no separate feature map.
- **Property tests for named invariants.** Domain invariants named by an ADR (money laws, non-negative stock and balances, average cost bounds, gapless numbering, round-trip parsing) get property tests with fast-check, on pure domain code only. Plain CRUD does not. Every counterexample found becomes a fixed example test. Few runs locally, more in CI; seeds are logged so failures replay.
- **Cheap checks first, in two levels.** Stop hook (≈30 s budget): typecheck, Biome, unit tests of the touched packages. Before opening a PR: integration tests against Postgres and `pnpm verify`. This extends the Stop hook of ADR-011.
- **Escalate after three rounds.** If a check still fails after three fix attempts, the agent stops and explains in the issue or PR which check fails and why it thinks so.
- **No flaky tests.** No skips, sleeps or retry-until-green; Playwright runs with `retries: 0`, also in CI. If the root cause cannot be found, the test is deleted and the PR says why.
- **One reviewer, focused.** `REVIEW.md` holds a reliability checklist; each item has a trigger readable from the diff, a check and its origin (ADR or escaped defect). The reviewer runs only the items the diff triggers. More reviewers are not added. A diff that touches the quality gates themselves (tool config, CI workflows, `REVIEW.md`, `verify`, or removes/skips tests) is one of those items: the reviewer flags it and the PR justifies it.
- **Stamp what was verified.** Every PR fills the **Verification** section of the PR template and ends with a `Verified-by:` trailer (`none — <reason>` allowed). Squash commits use the PR title and description, so the trailer lands on `main` and can be queried.
- **Turn misses into rules, and prune.** A bug that reaches `main` gets the `escaped-defect` label and is closed only with a new `REVIEW.md` item, test or hook, not just the fix. When each slice of the build order closes, `REVIEW.md`, `AGENTS.md` and slow or redundant tests are pruned.

### Considered and rejected
- **Feature map** (a document of user flows used as E2E guide and rubric): duplicates the issues' acceptance criteria.
- **CI "gate guard"** (a job requiring a maintainer-only label when a PR touches gate files): heavy for a single maintainer who reviews every PR; replaced by the `REVIEW.md` item.
- **Differential tests:** there is no old system to compare against. Revisit for a rewrite.
- **Formal evaluation of reviewers** (answer keys, recall per stage): out of proportion for this project; `escaped-defect` gives the feedback loop.
- **Commit gate** (block commits from sessions without `verify` or review, observe/enforce modes): deferred to the post-MVP backlog.

## Consequences
- Agents produce evidence (tests, traces, the Verification section) and the maintainer reviews evidence, not every line.
- Slices cost more up front: E2E per screen and property tests for invariants.
- Nothing mechanically stops a PR from weakening its own checks; the maintainer's review, guided by `REVIEW.md`, is the barrier.
- `REVIEW.md` and the test suites need routine pruning or they rot.
