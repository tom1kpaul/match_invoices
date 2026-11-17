# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read [AGENTS.md](AGENTS.md) first.** The project is synced with Lovable: never rewrite pushed history (no force-push/amend/rebase of pushed commits), keep `main` working, and don't hand-edit generated files (`src/routeTree.gen.ts`) or Lovable-managed pieces.

## Working with the user

The user is a beginner who is learning: explain everything you do — in simple Czech, say what you are changing, why, and what the relevant concepts mean.

## What it is

"Párování plateb" — a Czech-language, browser-only app (no auth, no DB). An accountant uploads two CSV files (issued invoices + bank statement) and the app matches payments to invoices. The full product spec (CSV columns, matching rules, statuses, outputs) is in [README.md](README.md). UI text, code comments, and commit messages are in Czech.

## Commands

```sh
npm run dev          # Vite dev server
npm run build        # production build
npm run lint         # eslint
npm run format       # prettier --write
npm test             # vitest run (all tests)
npx vitest run src/test/matching.test.ts      # single file
npx vitest run -t "název testu"               # single test by name
```

`bun.lock` is the tracked lockfile (Lovable uses bun; `bunfig.toml` has a 24h release-age guard — ask the user before adding exclusions).

## Architecture

Stack: TanStack Start (React, file-based routing in `src/routes/`, see [src/routes/README.md](src/routes/README.md)), Tailwind + shadcn/ui (`src/components/ui/`), Vitest + jsdom. Path alias `@` → `src`.

Data flow is one-directional and lives almost entirely in three places:

1. **[src/lib/read-csv-file.ts](src/lib/read-csv-file.ts)** — `File` → string (UTF-8, falling back to windows-1250 for Czech bank exports); also `downloadText` for CSV export.
2. **[src/lib/matching.ts](src/lib/matching.ts)** — all business logic as pure functions:
   - Parsing: `parseCsv` (semicolon, quotes, BOM) → `parseInvoicesCsv` / `parseStatementCsv`. Columns are found by header name (diacritics/case-insensitive via `mapColumns`); bad rows become `warnings`, not errors. Row ids are `inv-<line>` / `pay-<line>`.
   - `matchPayments(invoices, payments, today, manual)` → `MatchResult`: ignores amounts ≤ 0, manual pairs take precedence, then match by normalized VS, then VS found in the message; currency mismatch → unmatched. Computes per-invoice status, overdue, possible duplicate, and the summary (owed totals per currency).
   - `suggestInvoice` proposes the closest invoice for unmatched payments (amount, currency, customer name, fuzzy VS ≤1 edit, date window); shown only when ≥3 of 5 params match and currency matches.
3. **[src/routes/index.tsx](src/routes/index.tsx)** — the single page; holds state (loaded files, filter, `ManualPairs`) and calls `matchPayments` in a `useMemo`. Components in `src/components/matching/` only render results.

## Rules

- Keep matching/parsing/status logic in `src/lib/matching.ts` as pure functions; components must not compute business rules.
- Amounts are always integer **haléře** (`parseAmount("12 100,00") === 1210000`); format only at render time with `formatMoney`.
- Tests for the logic are in [src/test/matching.test.ts](src/test/matching.test.ts) and use a fixed `today` date; pass `today` explicitly rather than relying on `new Date()`. `src/lib/sample-data.ts` doubles as test fixture and the in-app "sample" button data.
