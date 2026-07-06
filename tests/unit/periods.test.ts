import { describe, expect, it } from 'vitest';

import {
  formatPeriodDateRange,
  generateMonthlyPeriods
} from '../../src/shared/calculations/periods';

describe('generateMonthlyPeriods', () => {
  it('generates five periods for July 2026', () => {
    expect(generateMonthlyPeriods('2026-07-01')).toEqual([
      { periodIndex: 1, startDate: '2026-07-01', endDate: '2026-07-04', dayCount: 4 },
      { periodIndex: 2, startDate: '2026-07-05', endDate: '2026-07-11', dayCount: 7 },
      { periodIndex: 3, startDate: '2026-07-12', endDate: '2026-07-18', dayCount: 7 },
      { periodIndex: 4, startDate: '2026-07-19', endDate: '2026-07-25', dayCount: 7 },
      { periodIndex: 5, startDate: '2026-07-26', endDate: '2026-07-31', dayCount: 6 }
    ]);
  });

  it('generates six periods for August 2026', () => {
    expect(generateMonthlyPeriods('2026-08-01')).toEqual([
      { periodIndex: 1, startDate: '2026-08-01', endDate: '2026-08-01', dayCount: 1 },
      { periodIndex: 2, startDate: '2026-08-02', endDate: '2026-08-08', dayCount: 7 },
      { periodIndex: 3, startDate: '2026-08-09', endDate: '2026-08-15', dayCount: 7 },
      { periodIndex: 4, startDate: '2026-08-16', endDate: '2026-08-22', dayCount: 7 },
      { periodIndex: 5, startDate: '2026-08-23', endDate: '2026-08-29', dayCount: 7 },
      { periodIndex: 6, startDate: '2026-08-30', endDate: '2026-08-31', dayCount: 2 }
    ]);
  });

  it('starts with a seven-day period when the first day is Sunday', () => {
    const [firstPeriod] = generateMonthlyPeriods('2026-02-01');

    expect(firstPeriod).toEqual({
      periodIndex: 1,
      startDate: '2026-02-01',
      endDate: '2026-02-07',
      dayCount: 7
    });
  });

  it('ends on Saturday when the last day is Saturday', () => {
    const periods = generateMonthlyPeriods('2026-01-01');
    const lastPeriod = periods.at(-1);

    expect(lastPeriod).toEqual({
      periodIndex: 5,
      startDate: '2026-01-25',
      endDate: '2026-01-31',
      dayCount: 7
    });
  });

  it('covers the month without gaps, overlaps, or outside dates', () => {
    const periods = generateMonthlyPeriods('2026-08-01');
    const coveredDates = periods.flatMap((period) => expandDates(period.startDate, period.endDate));

    expect(coveredDates).toHaveLength(31);
    expect(new Set(coveredDates)).toHaveLength(31);
    expect(coveredDates[0]).toBe('2026-08-01');
    expect(coveredDates.at(-1)).toBe('2026-08-31');
    expect(coveredDates.every((date) => date.startsWith('2026-08-'))).toBe(true);
  });

  it('formats date ranges with Japanese weekdays', () => {
    expect(
      formatPeriodDateRange({
        startDate: '2026-07-01',
        endDate: '2026-07-04',
        dayCount: 4
      })
    ).toBe('7月1日（水）〜7月4日（土）・4日間');
  });
});

function expandDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return dates;
}
