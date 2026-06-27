# Spending Statistics Tab Design

## Goal

Add a new `통계` tab that focuses only on spending trends. The first version should help the user quickly answer:

- How much did I spend by year?
- How much did I spend by month within a selected year?
- Which month was the highest spending month?
- What is my average monthly spending?

Income, remaining balance, and person-to-person money records are out of scope for this first statistics version.

## Selected Approach

Use approach A: spending-flow centered statistics.

The tab will show yearly and monthly expense bar charts using the existing local budget data. It will not introduce an external chart library in the first version. CSS-based bars are enough for the current app size, easier to test, and consistent with the existing Vue component style.

## User Experience

The app will add a fourth top-level tab:

- `입력`
- `대시보드`
- `통계`
- `사람`

When the user opens `통계`, the screen shows:

1. A yearly spending summary chart
   - One bar per registered year.
   - Each bar shows total spending for that year.
   - Clicking a year selects it for the monthly chart.

2. Key spending summary cards
   - Total spending for the selected year.
   - Average monthly spending for months that have spending records.
   - Highest spending month in the selected year.

3. A monthly spending chart
   - Months `1월` through `12월` for the selected year.
   - Months with no spending show a zero-height or muted bar.
   - The currently highest month gets a subtle accent treatment.

If there is no spending data, the tab shows an empty state telling the user to add daily expenses first.

## Data Model

No storage schema change is required.

The statistics tab derives all values from existing `BudgetData.expenses`.

New derived store values should be added to `budgetStore`:

- `expenseYears`: registered years that have at least one expense.
- `yearlyExpenseStats`: total expense amount by year.
- `monthlyExpenseStatsForSelectedYear`: monthly expense totals for the selected statistics year.

The selected statistics year can be held inside the statistics component unless another screen needs it later.

## Components

Add one new component:

- `src/components/StatisticsTab.vue`

The component should:

- Read expense-derived stats from `useBudgetStore`.
- Keep a local `selectedYear`.
- Render yearly and monthly CSS bar charts.
- Reuse existing design tokens, panels, section headings, and summary card visual language.

Optional helper types or functions can live near the store or in `src/domain/calculations.ts` if the logic is easier to test there.

## Visual Design

Keep the current Ocean Blue + Copper direction.

- Primary blue bars for normal spending.
- Copper accent for selected year or highest-spending month.
- Muted bars for zero-spending months.
- No card-inside-card nesting.
- Charts should remain readable on mobile by stacking vertically and keeping labels compact.

## Testing

Use TDD for implementation.

Add tests that prove:

- The `통계` tab appears in the app navigation.
- The statistics tab shows an empty state when there are no expenses.
- Yearly totals are calculated from expenses only.
- Selecting a year changes the monthly chart.
- Monthly bars include all 12 months for the selected year.

Existing tests for input, dashboard, import/export, and person records must continue passing.

## Out Of Scope

Do not include these in the first statistics version:

- Income charts.
- Balance charts.
- Category pie charts.
- External chart libraries.
- Exporting charts as images.
- Date range filters beyond year selection.

These can be added later after the spending-flow tab is stable.

## Implementation Notes

The current dashboard change already introduced registered year/month selection patterns. The statistics tab should reuse the same interaction idea where practical, but it should not depend on dashboard component internals.

The first implementation should favor clear, testable derived data over visual complexity.
