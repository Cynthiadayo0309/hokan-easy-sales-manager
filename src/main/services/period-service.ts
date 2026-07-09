import { generateWholeMonthPeriod } from '../../shared/calculations/periods.js';
import type { AppDatabase } from '../db/connection.js';
import { MonthlyPeriodRepository } from '../db/repositories/monthly-period-repository.js';
import { assertMonth } from './validation.js';

export class PeriodService {
  private readonly periods: MonthlyPeriodRepository;

  constructor(private readonly db: AppDatabase) {
    this.periods = new MonthlyPeriodRepository(db);
  }

  listByMonth(input: { targetMonth: string }) {
    const targetMonth = assertMonth(input.targetMonth);
    const existingPeriods = this.periods.listByMonth(targetMonth);

    if (existingPeriods.length > 0) {
      return existingPeriods;
    }

    return this.periods.createForMonth(targetMonth, [generateWholeMonthPeriod(targetMonth)]);
  }
}
