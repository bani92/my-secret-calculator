# Calendar Read-Only Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a read-only expense popup when a calendar date already has expenses, while keeping the current input-tab navigation for empty dates.

**Architecture:** Keep the behavior local to `CalendarTab.vue`. Calendar cells with expenses open an internal modal and do not emit `select-date`; empty cells continue emitting `select-date` to `App.vue`.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Vitest, Vue Test Utils.

## Global Constraints

- Do not add dependencies or change package versions.
- Preserve existing empty-date calendar behavior.
- The popup is read-only: no add, edit, or delete controls.
- Mobile layout must remain usable and scroll within the popup when needed.

---

### Task 1: Calendar Click Behavior Tests

**Files:**
- Modify: `src/App.test.ts`

**Interfaces:**
- Consumes: Existing calendar tab flow and `data-testid="calendar-date-YYYY-MM-DD"`.
- Produces: Tests that define the new read-only popup behavior.

- [ ] **Step 1: Write failing tests**
  - Update the existing calendar test so an expense date click expects a popup instead of input-tab navigation.
  - Add coverage that an empty date still moves to the input tab.

- [ ] **Step 2: Run the focused test**
  - Run: `npm test -- src/App.test.ts`
  - Expected before implementation: FAIL because the popup does not exist and expense dates still navigate.

### Task 2: Calendar Popup Implementation

**Files:**
- Modify: `src/components/CalendarTab.vue`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `CalendarDay`, `Expense`, `categoryLabel`, `formatWon`.
- Produces: `selectDay(day: CalendarDay)`, `selectedExpenseDay`, and modal close behavior.

- [ ] **Step 1: Implement click branching**
  - Replace direct `emit('select-date', day.date)` with `selectDay(day)`.
  - `selectDay` opens the popup for days with expenses and emits for empty days.

- [ ] **Step 2: Add read-only popup markup**
  - Show date, count, total amount, category, amount, and memo.
  - Add close button and backdrop click close.

- [ ] **Step 3: Add popup styles**
  - Use fixed overlay, centered panel, mobile-safe max height, and internal scrolling.

- [ ] **Step 4: Run focused tests**
  - Run: `npm test -- src/App.test.ts`
  - Expected after implementation: PASS.

### Task 3: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all tests**
  - Run: `npm test`
  - Expected: all tests pass.

- [ ] **Step 2: Run production build**
  - Run: `npm run build`
  - Expected: build succeeds.

- [ ] **Step 3: Commit and push**
  - Commit message: `feat: show calendar expenses in readonly popup`
  - Push to `origin main` after verification.
