# Calendar Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calendar tab that shows daily expenses by category and jumps to the input tab with a selected date.

**Architecture:** Reuse the existing Pinia `budgetStore` and `selectedMonth`. Add a focused `CalendarTab.vue` component for month/date rendering, then connect date selection through `App.vue` to `LedgerTab.vue`.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, Vue Test Utils, CSS grid.

---

### Task 1: App-Level Calendar Flow

**Files:**
- Modify: `src/App.test.ts`
- Modify: `src/App.vue`
- Modify: `src/components/LedgerTab.vue`

- [ ] Add an integration test that records four expenses on one date, opens `캘린더`, verifies category-based display and `외 1건`, clicks the date, then verifies the input tab date.
- [ ] Run `npm run test -- --run src/App.test.ts` and confirm the new test fails because the tab does not exist.
- [ ] Add the `calendar` tab type and date handoff state in `App.vue`.
- [ ] Add `initialExpenseDate` handling in `LedgerTab.vue`.
- [ ] Run `npm run test -- --run src/App.test.ts` and confirm only missing `CalendarTab` behavior remains.

### Task 2: Calendar Component

**Files:**
- Create: `src/components/CalendarTab.vue`
- Modify: `src/App.vue`

- [ ] Implement `CalendarTab.vue` with year/month selects, Sunday-start grid, date cells, category labels, won formatting, and `select-date` emit.
- [ ] Use `store.selectedMonth` as the single source of truth for selected year/month.
- [ ] Mark weekend headers and date cells with a `weekend` class.
- [ ] Limit visible daily expenses to three and append `외 N건` to the third item.
- [ ] Wire `CalendarTab` into `App.vue`.
- [ ] Run `npm run test -- --run src/App.test.ts`.

### Task 3: Styling And Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `docs/ui-samples/calendar-tab-sample.html`

- [ ] Add production CSS matching the approved sample: top-left date numbers, red weekend dates, stable 7-column calendar grid, responsive text wrapping.
- [ ] Keep the sample UI aligned with production styling decisions.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.

## Self-Review

- Spec coverage: The tasks cover the new tab, month selectors, daily expense rendering, `외 N건`, date click input handoff, weekend color, and styling.
- Placeholder scan: No task depends on an undefined follow-up.
- Type consistency: `initialExpenseDate`, `select-date`, and `calendar` names are used consistently.
