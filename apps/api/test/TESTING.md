# API Testing Guide

This API now uses a three-layer Jest structure:

- `src/**/*.spec.ts`: fast unit tests for business rules, guards, service branching, and controller behavior.
- `test/integration/**/*.integration-spec.ts`: Nest DI integration tests that wire real services together with shared mocks for repositories and external adapters.
- `test/**/*.e2e-spec.ts`: `supertest` route coverage for request validation, guard-protected endpoints, and critical HTTP contracts.

## Commands

- `pnpm test`: run every Jest project from `jest.config.ts`
- `pnpm test:unit`: run unit tests only
- `pnpm test:integration`: run integration tests only
- `pnpm test:e2e`: run e2e tests only
- `pnpm test:cov`: collect coverage for unit + integration suites
- `pnpm test:ci`: release gate command for CI pipelines

## Shared Test Utilities

Use the helpers in `test/helpers/` whenever new suites are added:

- `test/helpers/testing.ts`: repository mocks, query-builder mocks, query-runner mocks, Nest HTTP app bootstrap, and auth/guard helpers
- `test/helpers/fixtures.ts`: canonical builders for users, wallets, subscriptions, leads, assignments, and distribution rules

## Required Release Gates

Before shipping changes that touch money movement, subscriptions, or lead delivery:

1. `pnpm test:ci` must pass.
2. `pnpm test:cov` must pass.
3. Any changed money-moving or assignment-moving module must have:
   - a unit spec for happy path and failure path
   - an integration spec for the service wiring
   - an e2e spec for the exposed HTTP contract if the flow is controller-accessible
4. Idempotency-sensitive paths must include a duplicate/replay test:
   - Stripe top-ups
   - wallet credits
   - wallet debits tied to purchases
   - refund approvals
   - auto-reload charges
5. Lead-routing changes must include eligibility, skip, and retry coverage.

## Coverage Expectations

Use these thresholds as the CI target for critical domains:

- `wallet`, `stripe`, `subscriptions`, `leads`, `distribution`: aim for `>= 85%` branch coverage on core services touched by the change
- `auth`, `onboarding`, `admin`, `integrations`, `notifications`: aim for `>= 75%` branch coverage on changed state-mutating services/controllers
- read-only or thin modules can be lower, but they still need route validation tests if publicly exposed

## Scenario Naming

Business-critical regressions should use explicit scenario names, for example:

- `wallet-topup-is-idempotent`
- `lead-cannot-be-purchased-twice`
- `refund-approval-credits-exactly-once`
- `distribution-skips-buyers-over-budget`
- `auto-reload-does-not-double-charge`

## Adding New Suites

When a new module is added:

1. start with `test/helpers/fixtures.ts` builders if new entities are involved
2. add unit specs beside the service/controller
3. add at least one integration spec if the module coordinates repositories or collaborators
4. add an e2e spec if the module exposes an HTTP endpoint with validation or auth
5. run the narrowest suite first, then `pnpm test:ci`
