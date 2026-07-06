import type { MonthlyPeriod, WeeklyEntryStatus } from '../types/app-api.js';

export function weeklyEntryStatusLabel(status: WeeklyEntryStatus): string {
  if (status === 'completed') {
    return '入力完了';
  }

  if (status === 'draft') {
    return '一時保存';
  }

  return '未入力';
}

export function buildCopyPreviousMessage(
  previousPeriod: MonthlyPeriod,
  targetPeriod: MonthlyPeriod
): string {
  const baseMessage = `${formatShortRange(previousPeriod)}の内容を、${formatShortRange(
    targetPeriod
  )}へコピーします。`;

  if (previousPeriod.dayCount === targetPeriod.dayCount) {
    return baseMessage;
  }

  return `${baseMessage}\n前の期間は${previousPeriod.dayCount}日間、今回の期間は${targetPeriod.dayCount}日間です。日数が違うため確認してください。`;
}

function formatShortRange(period: MonthlyPeriod): string {
  return `${formatShortDate(period.startDate)}〜${formatShortDate(period.endDate)}`;
}

function formatShortDate(value: string): string {
  const month = Number.parseInt(value.slice(5, 7), 10);
  const day = Number.parseInt(value.slice(8, 10), 10);
  return `${month}月${day}日`;
}
