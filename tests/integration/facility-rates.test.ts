import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { initializeDatabase } from '../../src/main/db/connection';
import { RateSettingRepository } from '../../src/main/db/repositories/rate-setting-repository';
import { DashboardService } from '../../src/main/services/dashboard-service';
import { EntryService } from '../../src/main/services/entry-service';
import { ExportService } from '../../src/main/services/export-service';
import { PeriodService } from '../../src/main/services/period-service';
import { RateService } from '../../src/main/services/rate-target-service';
import { FacilityService, SetupService } from '../../src/main/services/setup-service';

describe('facility rates', () => {
  let db: ReturnType<typeof initializeDatabase>;

  beforeEach(() => {
    db = initializeDatabase(':memory:');
  });

  afterEach(() => db.close());

  function rateInput(amountThousandYen: string, facilityId?: number, validFrom = '2026-07-01') {
    return {
      validFrom,
      facilityId,
      rates: new SetupService(db).getStatus().nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        amountThousandYen
      }))
    };
  }

  it('uses the latest facility rate from its start date, ahead of newer common rates', () => {
    const rates = new RateService(db);
    const { facilities } = new SetupService(db).getStatus();
    const [first, second] = facilities;
    rates.save(rateInput('8.5'));
    rates.save(rateInput('10', first.id, '2026-08-01'));
    rates.save(rateInput('11', first.id, '2026-08-01'));
    rates.save(rateInput('9', undefined, '2026-09-01'));
    rates.save(rateInput('0', first.id, '2026-10-01'));

    for (const [validOn, amountYen] of [
      ['2026-07-31', 8500],
      ['2026-08-01', 11000],
      ['2026-09-01', 11000],
      ['2026-10-01', 0]
    ] as const) {
      const effective = rates.list({ facilityId: first.id, validOn });
      expect(effective).toHaveLength(4);
      expect(effective.every((rate) => rate.amountYen === amountYen)).toBe(true);
    }
    expect(rates.list({ facilityId: first.id }).every((rate) => rate.amountYen === 0)).toBe(true);
    expect(rates.list({ facilityId: second.id, validOn: '2026-09-01' })).toEqual(
      rates.list({ validOn: '2026-09-01' })
    );
    expect(rates.list({ validOn: '2026-09-01' }).every((rate) => rate.amountYen === 9000)).toBe(
      true
    );
    expect(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM rate_settings WHERE facility_id = ? AND valid_from = ?'
        )
        .get(first.id, '2026-08-01')
    ).toEqual({ count: 4 });
  });

  it('falls back to common rates for missing categories and expired facility rates', () => {
    const rates = new RateService(db);
    const { facilities, nursingCategories } = new SetupService(db).getStatus();
    const facilityId = facilities[0].id;
    const nursingCategoryId = nursingCategories[0].id;
    rates.save(rateInput('8.5'));
    new RateSettingRepository(db).saveRates(
      '2026-07-01',
      [{ nursingCategoryId, amountYen: 10000 }],
      facilityId
    );
    db.prepare('UPDATE rate_settings SET valid_to = ? WHERE facility_id = ?').run(
      '2026-07-31',
      facilityId
    );

    const july = rates.list({ facilityId, validOn: '2026-07-31' });
    expect(july.find((rate) => rate.nursingCategoryId === nursingCategoryId)?.amountYen).toBe(
      10000
    );
    expect(
      july
        .filter((rate) => rate.nursingCategoryId !== nursingCategoryId)
        .every((rate) => rate.amountYen === 8500)
    ).toBe(true);
    expect(
      rates.list({ facilityId, validOn: '2026-08-01' }).every((rate) => rate.amountYen === 8500)
    ).toBe(true);
  });

  it('rejects invalid facilities and invalid rate sets without changing saved rates', () => {
    const rates = new RateService(db);
    const { facilities } = new SetupService(db).getStatus();
    const facilityId = facilities[0].id;
    const original = rates.save(rateInput('8.5', facilityId));
    for (const invalidId of [0, -1, 1.5, 99999]) {
      expect(() => rates.save(rateInput('10', invalidId))).toThrow();
      expect(() => rates.list({ facilityId: invalidId })).toThrow();
    }
    const invalidRates = rateInput('10', facilityId);
    invalidRates.rates[3].amountThousandYen = '-1';
    expect(() => rates.save(invalidRates)).toThrow();
    expect(() => rates.save({ ...invalidRates, rates: invalidRates.rates.slice(1) })).toThrow(
      'RATE_SETTINGS_INCOMPLETE'
    );
    expect(() =>
      rates.save({ ...invalidRates, rates: invalidRates.rates.map(() => invalidRates.rates[0]) })
    ).toThrow('RATE_SETTINGS_INCOMPLETE');
    expect(rates.list({ facilityId, validOn: '2026-07-01' })).toEqual(original);

    new FacilityService(db).deactivate({ id: facilityId });
    expect(() => rates.save(rateInput('10', facilityId))).toThrow('FACILITY_NOT_ACTIVE');
    expect(() => rates.list({ facilityId })).toThrow('FACILITY_NOT_ACTIVE');
  });

  it('uses each facility rate in entries, monthly and annual totals, and CSV exports', () => {
    const rates = new RateService(db);
    const entries = new EntryService(db);
    const { facilities, nursingCategories } = new SetupService(db).getStatus();
    const targetMonth = '2026-07-01';
    const [period] = new PeriodService(db).listByMonth({ targetMonth });
    rates.save(rateInput('8.5'));
    rates.save(rateInput('10', facilities[0].id));
    rates.save(rateInput('12', facilities[1].id));

    for (const [index, amountYen] of [10000, 12000, 8500].entries()) {
      const input = { targetMonth, monthlyPeriodId: period.id, facilityId: facilities[index].id };
      expect(entries.get(input).details.every((detail) => detail.rateYen === amountYen)).toBe(true);
      const saved = entries.complete({
        ...input,
        details: nursingCategories.map((category, categoryIndex) => ({
          nursingCategoryId: category.id,
          peopleCount: categoryIndex + 1
        }))
      });
      expect(saved.summary.salesYen).toBe(10 * amountYen);
    }
    const dashboard = new DashboardService(db);
    const monthly = dashboard.getMonthly({ targetMonth });
    expect(monthly.summary.actualSalesYen).toBe(305000);
    expect(monthly.facilityRows.slice(0, 3).map((row) => row.actualSalesYen)).toEqual([
      100000, 120000, 85000
    ]);
    expect(dashboard.getAnnual({ year: 2025 }).summary.actualSalesYen).toBe(305000);
    const csv = new ExportService(db).buildDetailCsv(targetMonth).content;
    expect(csv).toContain(`${facilities[0].name},${nursingCategories[0].name},1,10000`);
    expect(csv).toContain(`${facilities[1].name},${nursingCategories[0].name},1,12000`);
    expect(csv).toContain(`${facilities[2].name},${nursingCategories[0].name},1,8500`);
  });

  it('preserves saved snapshots until entries are saved again', () => {
    const rates = new RateService(db);
    const entries = new EntryService(db);
    const { facilities, nursingCategories } = new SetupService(db).getStatus();
    const targetMonth = '2026-07-01';
    const [period] = new PeriodService(db).listByMonth({ targetMonth });
    const input = {
      targetMonth,
      monthlyPeriodId: period.id,
      facilityId: facilities[0].id,
      details: nursingCategories.map((category) => ({
        nursingCategoryId: category.id,
        peopleCount: 1
      }))
    };
    rates.save(rateInput('8.5'));
    entries.complete(input);
    rates.save(rateInput('10', input.facilityId));
    expect(entries.get(input).summary.salesYen).toBe(34000);
    expect(entries.complete(input).summary.salesYen).toBe(40000);
    rates.save(rateInput('12', input.facilityId));
    expect(entries.get(input).summary.salesYen).toBe(40000);
    expect(new DashboardService(db).getMonthly({ targetMonth }).summary.actualSalesYen).toBe(40000);
  });
});
