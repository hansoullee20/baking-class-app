# Baking Class App Architecture

## Runtime order
1. `app.js` — GitHub connection, persistence, base CRUD/render shell
2. `business-engine.js` — canonical financial and recipe/class calculation engine
3. `data-normalization.js` — stable IDs, price provenance and recipe cost reconciliation
4. `auth-persist.js` — connection persistence
5. `sunny-theme.js` — appearance only
6. `class-ops.js` / `bulk-payment.js` — participant and payment editing UI
7. `business-engine-adapter.js` — loads canonical rules/index/provenance and forces legacy surfaces to use the canonical engine
8. `operations-ui.js` — decision-oriented dashboard, schedule, recipe quality and finance presentation

## Authoritative data repository
`hansoullee20/baking-class-ops`

- `data/business-rules.json`: canonical business rules
- `data/entity-index.json`: recipe/class/ingredient stable IDs and aliases
- `data/price-provenance.json`: Coupang/default and specified-product sourcing evidence
- `data/costing-policy.json`: purchasing/costing priority
- `data/recipes.json`: recipe definitions and approved operating cost
- `data/ingredient-costs.json`: ingredient unit-cost master
- `data/schedule.json`: current/planned classes and payment data
- `data/history.json`: verified historical classes
- `data/source-sync.json`: recipe-source synchronization state

## Calculation rule
View modules must not define rent, material-cost, profit, margin, ROI, break-even or recipe-matching formulas independently. Financial results must come from `BakingBusiness` (`business-engine.js`).

`data-normalization.js` may calculate recipe ingredient totals for reconciliation, but it must not redefine class profit rules.

## Current compatibility boundary
`app.js` and `class-ops.js` originated before the canonical engine and still contain legacy helper calculations internally. Their visible financial outputs are overridden by `business-engine-adapter.js`. They are retained temporarily because they also contain core CRUD and participant-management behavior.

The next refactor target is to split those non-financial capabilities into smaller modules and remove the legacy calculation helpers entirely. Until then, CI prevents any of the retired patch/finance modules from returning to the runtime or repository.

## UI information architecture
- Dashboard: current decision summary → action queue → nearest classes → 6-month revenue/payment trend
- Schedule: operational summary → editable class list
- Recipes: cost-confidence/provenance summary → recipe details
- Finance: next-month forecast → selected-period summary → cost/profit structure → menu performance → collapsed diagnostics

## Financial terminology
- `수업 매출`: completed or booked class revenue basis from class data
- `입금 기록`: participant/payment records only; older history can be zero if payment tracking did not exist
- `예상이익`: planned/current class profit using approved recipe cost
- `현재 원가 기준 추정이익`: historical class modeled using current recipe cost
- `실제이익`: only when explicitly entered
- `원가 커버리지`: classes with usable complete/conditional approved recipe costs divided by all classes in the view

## Deployment gates
GitHub Pages deploy must pass:
- JavaScript syntax validation
- canonical business-engine regression tests
- normalization regression tests
- runtime asset guard
- repository guard preventing deprecated calculation/analytics files from being reintroduced
