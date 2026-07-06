import { describe, expect, it } from 'vitest';

import {
  calculateAchievement,
  calculateForecast,
  yenToThousandYenLabel
} from '../../src/shared/calculations/dashboard';

describe('dashboard calculations', () => {
  it('calculates achievement and remaining sales', () => {
    const achievement = calculateAchievement(1_000_000, 750_000);

    expect(achievement).toMatchObject({
      ratePercent: 75.0,
      remainingYen: 250_000,
      status: 'remaining'
    });
  });

  it('calculates over-achievement safely', () => {
    const achievement = calculateAchievement(1_000_000, 1_080_000);

    expect(achievement).toMatchObject({
      ratePercent: 108.0,
      remainingYen: -80_000,
      status: 'exceeded'
    });
  });

  it('does not divide by zero when target sales is zero', () => {
    expect(calculateAchievement(0, 10_000)).toMatchObject({
      ratePercent: null,
      status: 'not_set'
    });
  });

  it('calculates monthly forecast from completed days', () => {
    const forecast = calculateForecast(600_000, 18, 31);

    expect(forecast.forecastSalesYen).toBe(1_033_333);
  });

  it('does not forecast when completed day count is zero', () => {
    expect(calculateForecast(600_000, 0, 31)).toMatchObject({
      forecastSalesYen: null,
      completedDayCount: 0,
      daysInMonth: 31
    });
  });

  it('formats yen values as thousand-yen labels', () => {
    expect(yenToThousandYenLabel(1_250_000)).toBe('1,250千円');
    expect(yenToThousandYenLabel(8_500)).toBe('8.5千円');
  });
});
