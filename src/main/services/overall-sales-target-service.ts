import type { SaveMonthlyOverallSalesTargetInput } from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyOverallSalesTargetRepository } from '../db/repositories/monthly-overall-sales-target-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import { assertMonth, parseThousandYenToYen } from './validation.js';

export class OverallSalesTargetService {
  private readonly targets: MonthlyOverallSalesTargetRepository;
  private readonly closings: MonthClosingRepository;
  private readonly users: UserRepository;

  constructor(db: AppDatabase) {
    this.targets = new MonthlyOverallSalesTargetRepository(db);
    this.closings = new MonthClosingRepository(db);
    this.users = new UserRepository(db);
  }

  getByMonth(input: { targetMonth: string }) {
    return this.targets.getByMonth(assertMonth(input.targetMonth));
  }

  save(input: SaveMonthlyOverallSalesTargetInput) {
    const targetMonth = assertMonth(input.targetMonth);
    this.assertMonthOpen(targetMonth);

    if (input.amountThousandYen === null || String(input.amountThousandYen).trim() === '') {
      this.targets.deleteByMonth(targetMonth);
      return null;
    }

    return this.targets.save(
      targetMonth,
      parseThousandYenToYen(input.amountThousandYen),
      this.users.getInitialAdminId()
    );
  }

  private assertMonthOpen(targetMonth: string): void {
    if (this.closings.isClosed(targetMonth)) {
      throw new Error('MONTH_CLOSED');
    }
  }
}
