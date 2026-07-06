import type { AchievementResult, ForecastResult } from '../types/app-api.js';

export function calculateAchievement(
  targetSalesYen: number,
  actualSalesYen: number
): AchievementResult {
  const remainingYen = targetSalesYen - actualSalesYen;

  if (targetSalesYen === 0) {
    return {
      ratePercent: null,
      remainingYen,
      status: actualSalesYen > 0 ? 'not_set' : 'achieved'
    };
  }

  const ratePercent = Math.round((actualSalesYen / targetSalesYen) * 1000) / 10;
  return {
    ratePercent,
    remainingYen,
    status: remainingYen < 0 ? 'exceeded' : remainingYen === 0 ? 'achieved' : 'remaining'
  };
}

export function calculateForecast(
  actualSalesYen: number,
  completedDayCount: number,
  daysInMonth: number
): ForecastResult {
  if (completedDayCount <= 0) {
    return {
      forecastSalesYen: null,
      completedDayCount,
      daysInMonth
    };
  }

  return {
    forecastSalesYen: Math.round((actualSalesYen / completedDayCount) * daysInMonth),
    completedDayCount,
    daysInMonth
  };
}

export function yenToThousandYenLabel(amountYen: number): string {
  const thousandYen = Math.round(amountYen / 100) / 10;
  const formatted = Number.isInteger(thousandYen)
    ? thousandYen.toLocaleString('ja-JP', { maximumFractionDigits: 0 })
    : thousandYen.toLocaleString('ja-JP', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1
      });

  return `${formatted}千円`;
}
