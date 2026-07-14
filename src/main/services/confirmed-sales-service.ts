import type { SaveMonthlyConfirmedSalesInput } from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { MonthClosingRepository } from '../db/repositories/month-closing-repository.js';
import { MonthlyConfirmedSalesRepository } from '../db/repositories/monthly-confirmed-sales-repository.js';
import { UserRepository } from '../db/repositories/user-repository.js';
import { assertMonth, parseThousandYenToYen } from './validation.js';

export class ConfirmedSalesService {
  private readonly confirmedSales: MonthlyConfirmedSalesRepository;
  private readonly closings: MonthClosingRepository;
  private readonly users: UserRepository;

  constructor(db: AppDatabase) {
    this.confirmedSales = new MonthlyConfirmedSalesRepository(db);
    this.closings = new MonthClosingRepository(db);
    this.users = new UserRepository(db);
  }

  getByMonth(input: { targetMonth: string }) {
    return this.confirmedSales.getByMonth(assertMonth(input.targetMonth));
  }

  save(input: SaveMonthlyConfirmedSalesInput) {
    const targetMonth = assertMonth(input.targetMonth);
    this.assertMonthOpen(targetMonth);

    if (input.amountThousandYen === null || String(input.amountThousandYen).trim() === '') {
      this.confirmedSales.deleteByMonth(targetMonth);
      return null;
    }

    return this.confirmedSales.save(
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
