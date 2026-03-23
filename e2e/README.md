# E2E Tests — Playwright

End-to-end test suite covering all major user flows. Tests run against the local Vite dev server using Chromium.

---

## Test coverage

| Suite | File | Auth required | What it covers |
|---|---|---|---|
| Login | `tests/auth/login.spec.ts` | No | Login form validation, redirect for unauthenticated users |
| Navigation | `tests/navigation/navigation.spec.ts` | Yes | Main nav links, route access, active states |
| Dashboard | `tests/navigation/dashboard.spec.ts` | Yes | Charts visible, month navigation, data rendering |
| Budget | `tests/budget/budget-management.spec.ts` | Yes | Create/edit budgets, budget month assignment |
| Expenses | `tests/expenses/expenses.spec.ts` | Yes | Add expense, delete (reversal), validation |
| Income | `tests/income/income.spec.ts` | Yes | Add income, multi-currency, TRM entry |
| Debts | `tests/debts/debts.spec.ts` | Yes | Create debt, record transactions, balance display |
| Settings | `tests/settings/settings.spec.ts` | Yes | Household info, user preferences |

---

## Prerequisites

- Node.js 20+
- pnpm
- Playwright browsers installed (see below)
- A running Supabase project with the app's schema applied
- A dedicated E2E test user in Supabase who has completed onboarding (belongs to a household)

---

## Setup

### 1. Install Playwright browsers

```bash
pnpm exec playwright install chromium --with-deps
```

### 2. Create the credentials file

Create `.env.e2e.local` in the project root (this file is gitignored):

```env
E2E_EMAIL=your-test-user@example.com
E2E_PASSWORD=your-test-user-password
```

This must be a real Supabase user that:
- Has a verified email address
- Has completed onboarding (belongs to a household)

### 3. Set up app environment

Make sure `.env.local` exists with your Supabase and PowerSync credentials:

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_POWERSYNC_URL=https://<your-instance>.powersync.journeyapps.com
```

---

## Running tests

```bash
# Run all tests (starts dev server automatically)
pnpm test:e2e

# Interactive UI mode (great for debugging)
pnpm test:e2e:ui

# View the last HTML report
pnpm test:e2e:report

# Run a specific project
pnpm exec playwright test --project=no-auth
pnpm exec playwright test --project=authenticated

# Run a single file
pnpm exec playwright test e2e/tests/expenses/expenses.spec.ts

# Run in headed mode (watch the browser)
pnpm exec playwright test --headed
```

The dev server starts automatically via `webServer` in `playwright.config.ts`. If the server is already running on port 5173, it will be reused.

---

## Project architecture

Playwright uses a **two-project model**:

### `no-auth` project
- Runs `tests/auth/login.spec.ts` only
- No credentials required — uses empty storage state
- Tests the public-facing login form and unauthenticated redirects
- Safe to run in any environment

### `setup` + `authenticated` projects
- `setup` runs `auth.setup.ts` once: logs in, saves localStorage (Supabase auth token) to `e2e/.auth/user.json`
- `authenticated` runs all spec files under `tests/` and restores the saved auth state
- Requires `E2E_EMAIL` + `E2E_PASSWORD` in `.env.e2e.local`

This means login happens exactly once per test run — all authenticated tests share the same session.

### Page Object Model

Test helpers are in `e2e/pages/`:

```
BasePage.ts                 ← shared helpers (wait for app ready, navigation)
LoginPage.ts                ← login form interactions
DashboardPage.ts            ← dashboard assertions and navigation
MonthViewPage.ts            ← month view interactions
BudgetManagementPage.ts     ← budget CRUD interactions
IncomePage.ts               ← income form interactions
DebtsPage.ts                ← debt management interactions
SettingsPage.ts             ← settings page interactions
```

---

## Configuration

### `playwright.config.ts`

Key settings:

| Setting | Value | Reason |
|---|---|---|
| `fullyParallel` | `false` | PowerSync local SQLite is shared across tests |
| `workers` | `1` | Serial execution to avoid SQLite conflicts |
| `retries` | `1` (CI), `0` (local) | Handles transient WASM init flakiness on CI |
| `actionTimeout` | 15 000 ms | WASM init + PowerSync can take ~3 s |
| `navigationTimeout` | 30 000 ms | Initial app load with WASM |
| `timeout` | 60 000 ms | Per-test timeout |
| `locale` | `es-CO` | Forces Spanish UI (app uses `navigator.language`) |

### Artifacts on failure

- **Screenshot** — captured on failure (`screenshot: 'only-on-failure'`)
- **Trace** — captured on first retry (`trace: 'on-first-retry'`)
- **Video** — recorded on first retry (`video: 'on-first-retry'`)

Artifacts land in `test-results/` (gitignored). Open traces with:

```bash
pnpm exec playwright show-trace test-results/<test-name>/trace.zip
```

---

## CI configuration

The E2E workflow in `.github/workflows/e2e.yml` has two jobs:

### Job 1: `no-auth` (always runs)
Runs the public login tests using placeholder Supabase credentials. No secrets needed — the app boots but makes no real API calls.

### Job 2: `authenticated` (runs only when secrets are configured)
Runs all authenticated tests. Requires the following GitHub repository secrets:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_POWERSYNC_URL` | Your PowerSync instance URL |
| `E2E_EMAIL` | E2E test user email |
| `E2E_PASSWORD` | E2E test user password |

To add secrets: GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

The authenticated job is skipped (not failed) when `E2E_EMAIL` or `E2E_PASSWORD` are empty, so forks without secrets configured still pass CI.

---

## Troubleshooting

### "E2E_EMAIL and E2E_PASSWORD must be set"
Create `.env.e2e.local` in the project root with the credentials (see Setup above).

### "E2E test user has no household"
The test user must have completed the onboarding flow (created or joined a household) at least once. Log in manually as that user at `localhost:5173` and finish onboarding.

### Tests timeout on first run
PowerSync initializes a WASM SQLite instance on first load, which can take 3–5 seconds. The timeouts in `playwright.config.ts` account for this. If tests are still timing out, try increasing `actionTimeout`.

### Stale auth state
Delete `e2e/.auth/user.json` to force a fresh login:

```bash
rm -f e2e/.auth/user.json
```

### Port 5173 already in use
Stop any running dev server or change `baseURL` in `playwright.config.ts`. The `reuseExistingServer: !process.env.CI` setting means local runs will reuse an existing server on that port.
