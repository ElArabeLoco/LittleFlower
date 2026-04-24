# Changelog

All notable changes to Florecita will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases from v0.1.0 onward are automated via
[release-please](https://github.com/googleapis/release-please) using
[Conventional Commits](https://www.conventionalcommits.org/).

---

## [0.10.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.9.0...littleflower-v0.10.0) (2026-04-24)


### Features

* **finances:** add Transactions page with CC and cash grids ([#51](https://github.com/ElArabeLoco/LittleFlower/issues/51)) ([acfe599](https://github.com/ElArabeLoco/LittleFlower/commit/acfe599d3613b0c4ed736c6d862dd38fc36583c7))

## [0.9.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.8.0...littleflower-v0.9.0) (2026-04-24)


### Features

* **budget:** rename Balance Real → Balance Ideal + add true Balance Real ([d1e0087](https://github.com/ElArabeLoco/LittleFlower/commit/d1e0087a4db6dece0433031a16427073b231e4ef))
* **budget:** rename Balance Real → Balance Ideal; add true Balance Real ([228f772](https://github.com/ElArabeLoco/LittleFlower/commit/228f772f70a835e2654bbb2976ab4d7e9c2e2a7d))


### Bug Fixes

* **budget:** Balance real uses cash-only expenses, not all transactions ([387155a](https://github.com/ElArabeLoco/LittleFlower/commit/387155ac902b492eeeee46a0aba19d0b885ee28f))

## [0.8.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.7.0...littleflower-v0.8.0) (2026-04-24)


### Features

* **dashboard:** add cash burn-up chart alongside credit card burn-up ([#47](https://github.com/ElArabeLoco/LittleFlower/issues/47)) ([bd0db20](https://github.com/ElArabeLoco/LittleFlower/commit/bd0db204deef8c1731871e1da62ad8e505997ef2))

## [0.7.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.6.0...littleflower-v0.7.0) (2026-04-24)


### Features

* add dual payment mode for budgets ([#45](https://github.com/ElArabeLoco/LittleFlower/issues/45)) ([d581fbf](https://github.com/ElArabeLoco/LittleFlower/commit/d581fbf3f331b84076f8f92c8f56e1ebd9f6d5b3))


### Bug Fixes

* add paid_with_credit_card to RegisterFullPaymentPayload and ExpenseRepository mapper ([1cd503f](https://github.com/ElArabeLoco/LittleFlower/commit/1cd503f8bce123b31536cd8a9d65c7715777f292))

## [0.6.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.5.0...littleflower-v0.6.0) (2026-04-14)


### Features

* **dashboard:** add 'Por pagar este mes' pending payments chart ([#44](https://github.com/ElArabeLoco/LittleFlower/issues/44)) ([a997b99](https://github.com/ElArabeLoco/LittleFlower/commit/a997b993f005d783df1a8e2a78eb86e82a686fef))


### Bug Fixes

* **mobile:** collapsible year-view column + dialog bottom sheet ([#43](https://github.com/ElArabeLoco/LittleFlower/issues/43)) ([103d0a0](https://github.com/ElArabeLoco/LittleFlower/commit/103d0a0dcf24450150ecfd639ff082f9be3228c7))
* resolve TS errors in export/import service ([#41](https://github.com/ElArabeLoco/LittleFlower/issues/41)) ([58c05a7](https://github.com/ElArabeLoco/LittleFlower/commit/58c05a7e9232fbf3b6d313c1c17e6b76773e41fb))

## [0.5.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.4.0...littleflower-v0.5.0) (2026-04-10)


### Features

* add data export/import to Settings ([76599b4](https://github.com/ElArabeLoco/LittleFlower/commit/76599b4a81e1ebb1eb6f8cbce3643178bc2e02e6))
* improve horizontal space utilization on wide screens ([#39](https://github.com/ElArabeLoco/LittleFlower/issues/39)) ([6393235](https://github.com/ElArabeLoco/LittleFlower/commit/63932352ad514cfebe58641893eaec7144a62f6a))

## [0.4.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.3.0...littleflower-v0.4.0) (2026-04-10)


### Features

* add interactive income history chart to dashboard ([#37](https://github.com/ElArabeLoco/LittleFlower/issues/37)) ([550c8d7](https://github.com/ElArabeLoco/LittleFlower/commit/550c8d7687bc8db844cc6df068fef7430d6f7db9))

## [0.3.0](https://github.com/ElArabeLoco/LittleFlower/compare/littleflower-v0.2.0...littleflower-v0.3.0) (2026-04-10)


### Features

* make dashboard month-navigable with prev/next navigation ([#34](https://github.com/ElArabeLoco/LittleFlower/issues/34)) ([4998ad6](https://github.com/ElArabeLoco/LittleFlower/commit/4998ad6a6ee75352ea5146864780700ed5489395))
* rich cell interactions on YearView spreadsheet ([#36](https://github.com/ElArabeLoco/LittleFlower/issues/36)) ([dd48a06](https://github.com/ElArabeLoco/LittleFlower/commit/dd48a06cf5793d1ba443994da1c5ea3ad0788654))

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
