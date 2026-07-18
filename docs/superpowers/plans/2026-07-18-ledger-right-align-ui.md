# Ledger Right Align UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the income add dialog default to today's date and align ledger amounts/actions in stable right-side columns.

**Architecture:** Keep existing store APIs and ledger group data unchanged. Only adjust `LedgerTab.vue` defaults/markup and `styles.css` layout rules, with App tests covering the date default and the ledger column structure.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, CSS.

## Global Constraints

- Do not change Supabase or store persistence logic.
- Preserve income records as itemized `+` entries.
- Mobile layout must avoid amount/action clipping.
- Merge the completed branch into `main` and push `main` to `origin/main`.

---

### Task 1: Income Add Default Date

**Files:**
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/App.test.ts`

**Interfaces:**
- Consumes: existing `today` constant in `LedgerTab.vue`.
- Produces: income add dialog with `incomeForm.date === today` when opened.

- [ ] **Step 1: Add failing App test**

Add a test that opens `수입 추가` and expects `[data-testid="add-income-date"]` to equal today's mocked date.

- [ ] **Step 2: Implement**

Set `incomeForm.date` to `today` initially and in `openAddIncomeDialog()`.

- [ ] **Step 3: Verify**

Run `npm test -- src/App.test.ts`.

---

### Task 2: Ledger Right Column Layout

**Files:**
- Modify: `src/components/LedgerTab.vue`
- Modify: `src/styles.css`
- Modify: `src/App.test.ts`

**Interfaces:**
- Consumes: existing `ledger-entry-side`, `ledger-entry-amount`, and `ledger-entry-actions` markup.
- Produces: B-option layout with separate amount and action columns.

- [ ] **Step 1: Add App structure test**

Assert each ledger row contains a `.ledger-entry-amount` and `.ledger-entry-actions` inside `.ledger-entry-side`.

- [ ] **Step 2: Update markup**

Keep `.ledger-entry-side`, but make it a grid-friendly wrapper for separate amount/actions.

- [ ] **Step 3: Update CSS**

Use desktop columns `minmax(0, 1fr) minmax(220px, auto)` for `.ledger-entry`, and inside `.ledger-entry-side` use `grid-template-columns: minmax(96px, auto) minmax(92px, auto)`.
At `max-width: 560px`, stack row to one column and right-align amount/actions without clipping.

- [ ] **Step 4: Verify**

Run `npm test -- src/App.test.ts src/stores/budgetStore.test.ts`, `npm test`, and `npm run build`.
