import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const styles = readFileSync('src/styles.css', 'utf8');

describe('responsive styles', () => {
  test('keeps recurring fixed expense header aligned on desktop and mobile', () => {
    const headingRuleStart = styles.indexOf('.recurring-heading {');
    const rowRuleStart = styles.indexOf('.recurring-heading-row {');
    const actionsRuleStart = styles.indexOf('.recurring-heading-actions {');
    const totalRuleStart = styles.indexOf('.recurring-rule-total {');
    const totalLabelRuleStart = styles.indexOf('.recurring-rule-total .recurring-rule-total-label {');
    const mobileBreakpointStart = styles.indexOf('@media (max-width: 640px)');
    const nextBreakpointStart = styles.indexOf('@media (max-width: 480px)', mobileBreakpointStart);
    const mobileStyles = styles.slice(
      mobileBreakpointStart,
      nextBreakpointStart > mobileBreakpointStart ? nextBreakpointStart : undefined
    );

    expect(styles).not.toContain('.income-heading.recurring-heading');
    expect(headingRuleStart).toBeGreaterThanOrEqual(0);
    expect(styles.slice(headingRuleStart, styles.indexOf('}', headingRuleStart))).toContain('display: grid');
    expect(rowRuleStart).toBeGreaterThanOrEqual(0);
    expect(styles.slice(rowRuleStart, styles.indexOf('}', rowRuleStart))).toContain('display: flex');
    expect(styles.slice(rowRuleStart, styles.indexOf('}', rowRuleStart))).toContain('align-items: center');
    expect(styles.slice(rowRuleStart, styles.indexOf('}', rowRuleStart))).toContain('justify-content: space-between');
    expect(actionsRuleStart).toBeGreaterThanOrEqual(0);
    expect(styles.slice(actionsRuleStart, styles.indexOf('}', actionsRuleStart))).toContain('height: var(--touch-target)');
    expect(styles.slice(actionsRuleStart, styles.indexOf('}', actionsRuleStart))).toContain('display: flex');
    expect(styles.slice(actionsRuleStart, styles.indexOf('}', actionsRuleStart))).toContain('align-items: center');
    expect(styles.slice(actionsRuleStart, styles.indexOf('}', actionsRuleStart))).toContain('flex-wrap: nowrap');
    expect(totalRuleStart).toBeGreaterThanOrEqual(0);
    expect(styles.slice(totalRuleStart, styles.indexOf('}', totalRuleStart))).toContain('align-items: center');
    expect(styles.slice(totalRuleStart, styles.indexOf('}', totalRuleStart))).toContain('margin-bottom: 0');
    expect(totalLabelRuleStart).toBeGreaterThanOrEqual(0);
    expect(styles.slice(totalLabelRuleStart, styles.indexOf('}', totalLabelRuleStart))).toContain('justify-content: center');
    expect(styles.slice(totalLabelRuleStart, styles.indexOf('}', totalLabelRuleStart))).toContain('text-align: center');
    expect(styles.slice(totalLabelRuleStart, styles.indexOf('}', totalLabelRuleStart))).toContain('width: 100%');
    expect(styles).toContain('.section-heading > span');
    expect(mobileStyles).toContain('.recurring-heading-actions');
    expect(mobileStyles).toContain('justify-content: flex-end');
  });

  test('keeps calendar expense text horizontal on narrow mobile screens', () => {
    const mobileBreakpointStart = styles.indexOf('@media (max-width: 640px)');
    const nextBreakpointStart = styles.indexOf('@media (max-width: 480px)', mobileBreakpointStart);
    const mobileCalendarStyles = styles.slice(
      mobileBreakpointStart,
      nextBreakpointStart > mobileBreakpointStart ? nextBreakpointStart : undefined
    );

    expect(mobileBreakpointStart).toBeGreaterThanOrEqual(0);
    expect(mobileCalendarStyles).toContain('.calendar-grid');
    expect(mobileCalendarStyles).toContain('.date-cell');
    expect(mobileCalendarStyles).toContain('.expense-list li');
    expect(mobileCalendarStyles).toContain('white-space: nowrap');
    expect(mobileCalendarStyles).toContain('overflow: hidden');
    expect(mobileCalendarStyles).toContain('text-overflow: ellipsis');
    expect(mobileCalendarStyles).toContain('overflow-wrap: normal');
  });
});
