import { describe, expect, it } from 'vitest';

import {
  buildCopyPreviousMessage,
  weeklyEntryStatusLabel
} from '../../src/shared/calculations/entry-status';
import type { MonthlyPeriod } from '../../src/shared/types/app-api';

describe('weekly entry status display helpers', () => {
  it('returns Japanese labels for entry statuses', () => {
    expect(weeklyEntryStatusLabel('not_started')).toBe('未入力');
    expect(weeklyEntryStatusLabel('draft')).toBe('一時保存');
    expect(weeklyEntryStatusLabel('completed')).toBe('入力完了');
  });

  it('adds a day-count warning when copied periods have different lengths', () => {
    const previousPeriod = createPeriod(1, '2026-07-01', '2026-07-04', 4);
    const targetPeriod = createPeriod(2, '2026-07-05', '2026-07-11', 7);

    expect(buildCopyPreviousMessage(previousPeriod, targetPeriod)).toContain(
      '日数が違うため確認してください'
    );
  });
});

function createPeriod(
  periodIndex: number,
  startDate: string,
  endDate: string,
  dayCount: number
): MonthlyPeriod {
  return {
    id: periodIndex,
    targetMonth: '2026-07-01',
    periodIndex,
    startDate,
    endDate,
    dayCount,
    createdAt: '2026-07-01T00:00:00.000Z'
  };
}
