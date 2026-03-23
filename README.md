# Florecita

A free, offline-first household budget tracker built for couples. Track expenses, income, debts, and monthly budgets — synced in real time across two devices, with no monthly fee.

**Live app:** [florecita.club](https://florecita.club)

---

## What it does

- **Monthly budget** — set spending limits per category, track execution vs plan
- **Expenses** — append-only ledger (reversals instead of edits, so history is never lost)
- **Income** — multi-currency support (USD income auto-converted to COP using a configurable TRM exchange rate)
- **Debts** — track outstanding balances with debit/credit transactions
- **Dashboard** — 6-month spending trends, category breakdown, debt progress charts
- **Year view** — spreadsheet-style overview across all months
- **Offline-first PWA** — works without internet; changes sync automatically when connectivity returns
- **Two-person household** — built for exactly two cooperative adults sharing finances

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Routing | TanStack Router |
| Local storage | PowerSync (SQLite WASM in browser) |
| Sync & auth backend | Supabase (Postgres + Auth) |
| UI | shadcn/ui + Tailwind CSS |
| PWA | vite-plugin-pwa + Workbox |
| Deployment | Vercel (frontend) + PowerSync Cloud + Supabase |

**Total hosting cost: $0/month** on free tiers.

---

## Using the hosted version

1. Go to [florecita.club](https://florecita.club)
2. Create an account with email + password
3. One person creates a household; the other joins with the 6-digit code
4. Start tracking

The app is installable as a PWA — use "Add to Home Screen" on mobile or the install prompt on desktop Chrome.

---

## Self-hosting / running locally

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project (free tier works)
- A [PowerSync Cloud](https://www.powersync.com) project (free tier works)

### 1. Clone and install

```bash
git clone https://github.com/ElArabeLoco/LittleFlower.git
cd LittleFlower
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local   # if .env.example exists, otherwise create .env.local
```

Add your credentials to `.env.local`:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_POWERSYNC_URL=https://<your-instance>.powersync.journeyapps.com
# Optional
VITE_SENTRY_DSN=<your-sentry-dsn>
```

You can find these values in:
- **Supabase:** Project Settings → API
- **PowerSync:** Dashboard → your instance URL

### 3. Set up Supabase

Run the migrations in `supabase/migrations/` against your project using the Supabase CLI or the SQL editor in the dashboard.

### 4. Configure PowerSync sync rules

In your PowerSync Cloud dashboard, add sync rules so data flows to the client. Each table needs:

```sql
SELECT * FROM <table> WHERE household_id = bucket.household_id
```

See `src/infrastructure/powersync/schema.ts` for the full list of tables.

### 5. Start the dev server

```bash
pnpm dev
```

The app runs at `http://localhost:5173`.

> **Note:** PowerSync uses SharedArrayBuffer and requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` headers. These are set automatically by the Vite dev server and by `vercel.json` in production.

---

## Available scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build locally |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:ui` | Unit tests with Vitest UI |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm test:e2e:ui` | Playwright interactive UI |
| `pnpm test:e2e:report` | Open last E2E HTML report |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type-check only |

---

## Project structure

```
src/
  domain/          # Pure domain types and business logic (zero dependencies)
  application/     # Composable hooks: query + domain calculations
  infrastructure/  # PowerSync repositories, queries, Supabase connector
  features/        # UI pages and components (imports from application/)
  shared/          # Design system, utilities, i18n
e2e/               # Playwright end-to-end tests
supabase/          # Database migrations
```

See [e2e/README.md](e2e/README.md) for E2E test documentation.

---

## Contributing

This is a personal project but PRs are welcome. The codebase follows a strict DDD layering:

- No `useQuery` calls in `features/` — go through `application/` hooks
- No business calculations in `features/` — they belong in `application/`
- All mutations go through `mutationWrappers.ts` — never call `db.execute()` directly
- All monetary values are **integer COP pesos**

See `CLAUDE.md` for the full architecture and conventions reference used during development.
