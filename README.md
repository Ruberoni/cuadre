# Cuadre

An ERP for a small Venezuelan distribution business — purchasing, inventory, sales, invoicing and payments with Bs/USD multi-currency, BCV exchange rates, IVA and IGTF.

Built as a personal portfolio project, developed primarily by AI agents from well-specified GitHub issues, with CI as the safety net.

- Plan: [`docs/PLAN.md`](docs/PLAN.md)
- Architecture decisions: [`docs/adr/`](docs/adr/)
- Domain glossary: [`docs/GLOSSARY.md`](docs/GLOSSARY.md)
- Agent instructions: [`AGENTS.md`](AGENTS.md)

> Status: walking skeleton. The monorepo, tooling and CI gates are in place; business features arrive slice by slice.

## Quick start

Requires Node 26, pnpm and Docker.

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

See [`AGENTS.md`](AGENTS.md) for the full list of commands.

All sample data in this repository is fictitious.
