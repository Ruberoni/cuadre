# ADR-010: English code, Spanish UI

**Status:** Accepted

## Context
The project targets an international portfolio audience, while the product's users are Venezuelan. Domain terms with no clean translation (IGTF, BCV) must not be translated inconsistently by different agents.

## Decision
- Code, identifiers, commits, issues, PRs and docs: **English**.
- UI copy: **Spanish**, structured so i18n can be added later (not implemented in the MVP).
- [`docs/GLOSSARY.md`](../GLOSSARY.md) is the canonical mapping of domain terms. Agents use it, and extend it in the same PR when introducing a new term.

## Consequences
- Consistent naming across modules.
- The glossary must be maintained.
