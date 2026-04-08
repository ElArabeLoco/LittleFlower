# Changelog

All notable changes to Florecita will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases from v0.1.0 onward are automated via
[release-please](https://github.com/googleapis/release-please) using
[Conventional Commits](https://www.conventionalcommits.org/).

---

## [0.2.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.1.0...littleflower-v0.2.0) (2026-04-08)


### Features

* add SemVer versioning, release-please CI, and CHANGELOG ([#30](https://github.com/ElArabeLoco/LittleFlower/issues/30)) ([6420a38](https://github.com/ElArabeLoco/LittleFlower/commit/6420a385b90ff1f78569ca5497de9ebc38099f72))
* add sort & filter to month and year views ([5876051](https://github.com/ElArabeLoco/LittleFlower/commit/5876051eed83579499df46f5e2f4caf8a07bee4a))


### Bug Fixes

* remove unused SortKey and YearSortKey type imports in test files ([c03d549](https://github.com/ElArabeLoco/LittleFlower/commit/c03d549ae129805ede4be390a733d3eb40b9c956))
* remove unused TS type imports in test files (TS6133) ([e94276a](https://github.com/ElArabeLoco/LittleFlower/commit/e94276a84071c2e09a01b12283fb34f4deae1d07))

## [Unreleased]

## [0.1.0] — 2026-03-23

Initial public release of Florecita — an offline-first household budget tracker
built for couples.

### Added

#### Core product
- Offline-first architecture: PowerSync (SQLite WASM) + Supabase (Postgres + Auth)
- Real-time sync across devices via PowerSync WebSocket; LWW conflict resolution
- Two-person household model — 6-digit join code for onboarding a second member
- PWA support — installable on desktop and mobile, works fully offline
- Dark / light / auto theme, ES/EN language toggle, abbreviated/full number format

#### Budget
- Monthly budget management with configurable categories (credit card vs cash)
- Year view — spreadsheet-style overview of all 12 months with sticky headers
- Month view — budget cards per category with real-time execution tracking

#### Expenses
- Append-only expense ledger (reversals instead of deletes to preserve history)
- Expense form with category, amount, note, and timestamp

#### Income
- Multi-currency income tracking (COP and USD)
- Per-month TRM (exchange rate) entry with auto-carry-forward from last known rate
- Income month overrides — real amount can differ from the default contract amount

#### Debts
- Debt management with debit/credit transaction history
- Balance calculation via domain service (`computeDebtBalance`)

#### Dashboard
- KPI strip: balance, available income, budgeted, spent, pending
- 6-month trend charts (bar + area)
- Category and payment-method pie charts
- Budget burn-up charts (Domicilios, Mercado, Cosas de Salud, credit cards)
- Daily spend distribution charts (restaurants, groceries)
- Top budgets and exceeded budgets charts
- Debt progress and debt evolution charts
- Recent expenses feed

#### Infrastructure & quality
- DDD architecture: domain / application / infrastructure / features / shared
- All mutations go through `mutationWrappers.ts` (auto-populates audit fields)
- Reactive query layer: all SQL in `infrastructure/powersync/queries/`
- `DashboardDataProvider` context — single query set shared across all chart components
- Unit test suite: 168 tests (domain, application hooks, repositories, shared utils)
- Playwright E2E test suite covering all authenticated user flows
- Sentry error tracking integration
- CI: GitHub Actions for E2E tests (public + authenticated jobs)

---

[Unreleased]: https://github.com/ElArabeLoco/LittleFlower/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ElArabeLoco/LittleFlower/releases/tag/v0.1.0
