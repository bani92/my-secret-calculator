import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const styles = readFileSync('src/styles.css', 'utf8');

describe('responsive styles', () => {
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
