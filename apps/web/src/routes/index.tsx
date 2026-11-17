import { createFileRoute } from "@tanstack/react-router";

// Blank on purpose: UI code starts after the design token sync (ADR-012).
export const Route = createFileRoute("/")({ component: () => <main /> });
