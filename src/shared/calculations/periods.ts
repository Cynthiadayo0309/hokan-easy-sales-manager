import type { GeneratedMonthlyPeriod } from '../types/app-api.js';

const monthPattern = /^\d{4}-\d{2}-01$/;
const oneDayMs = 24 * 60 * 60 * 1000;

export function generateMonthlyPeriods(targetMonth: string): GeneratedMonthlyPeriod[] {
  if (!monthPattern.test(targetMonth)) {
    throw new Error('MONTH_INVALID');
  }

  const year = Number.parseInt(targetMonth.slice(0, 4), 10);
  const monthIndex = Number.parseInt(targetMonth.slice(5, 7), 10) - 1;
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));

  if (Number.isNaN(firstDay.getTime()) || toIsoDate(firstDay) !== targetMonth) {
    throw new Error('MONTH_INVALID');
  }

  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const periods: GeneratedMonthlyPeriod[] = [];
  let current = firstDay;
  let periodIndex = 1;

  while (current.getTime() <= lastDay.getTime()) {
    const daysUntilSaturday = (6 - current.getUTCDay() + 7) % 7;
    const saturday = addDays(current, daysUntilSaturday);
    const endDate = saturday.getTime() > lastDay.getTime() ? lastDay : saturday;

    periods.push({
      periodIndex,
      startDate: toIsoDate(current),
      endDate: toIsoDate(endDate),
      dayCount: differenceInDays(current, endDate) + 1
    });

    current = addDays(endDate, 1);
    periodIndex += 1;
  }

  return periods;
}

export function formatPeriodDateRange(
  period: Pick<GeneratedMonthlyPeriod, 'startDate' | 'endDate' | 'dayCount'>
): string {
  return `${formatJapaneseDate(period.startDate)}〜${formatJapaneseDate(period.endDate)}・${period.dayCount}日間`;
}

export function formatJapaneseDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${weekdays[date.getUTCDay()]}）`;
}

export function isPartialPeriod(period: Pick<GeneratedMonthlyPeriod, 'dayCount'>): boolean {
  return period.dayCount < 7;
}

function parseIsoDate(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error('DATE_INVALID');
  }

  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || toIsoDate(date) !== isoDate) {
    throw new Error('DATE_INVALID');
  }

  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * oneDayMs);
}

function differenceInDays(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / oneDayMs);
}
