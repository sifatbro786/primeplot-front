@AGENTS.md

# PrimePlot Frontend — Working Rules

## Before starting work
1. The project's canonical docs are in the sibling repo: `../primeplot-back/docs/PROGRESS.md` and `../primeplot-back/docs/ARCHITECTURE.md`. Read both. They are also in the claude.ai Project docs under `primeplot/`.
2. Next.js 16 has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code (see AGENTS.md).
3. Before building UI, verify that the backend contract is in `../primeplot-back/docs/API.md`.

## Working rules
- Next.js App Router, pure JavaScript (no TypeScript), Tailwind v4, React Compiler on.
- API calls go only through `/api/*` (Next rewrites → backend), so cookies stay first-party.
- Every user-facing string goes through i18n (`messages/bn.json`, `messages/en.json`, next-intl). No hard-coded text. Routes live under `app/[locale]/`; use `Link`/`useRouter` from `@/i18n/navigation`.
- Design system: tokens in `styles/theme.css`, primitives in `components/ui/`, living style guide at `/[locale]/dev/design` (dev only). Use semantic utilities only.
- Use token-driven styling. Avoid the generic AI-template look (default glassmorphism, gradient text, count-up stats).
- Make targeted, minimal changes; no full-file rewrites.

## At the end of every task (mandatory)
1. Update `../primeplot-back/docs/PROGRESS.md`.
2. Report to the owner **in Bangla**: কী করেছি · আপনার করণীয় · পরের ধাপে কী করব (detailed).
