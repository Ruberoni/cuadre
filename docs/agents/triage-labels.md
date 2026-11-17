# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `agent-ready`        | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

Project-specific label (no skill role):

| Label in our tracker | Meaning |
| -------------------- | ------- |
| `needs-design`       | Adds or changes a screen but its Design handoff is incomplete; cannot become `agent-ready` (ADR-012, `docs/design/README.md`) |
| `escaped-defect`     | A bug that reached `main`; closes only with a new `REVIEW.md` item, test or hook besides the fix (ADR-014) |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
