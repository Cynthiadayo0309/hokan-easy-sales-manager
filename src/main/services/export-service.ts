import { dialog } from 'electron';
import { writeFileSync } from 'node:fs';

import { calculateEntryDetail } from '../../shared/calculations/entries.js';
import { applyEntryBilling, billingModeForCategory } from '../../shared/calculations/billing.js';
import { yenToThousandYenLabel } from '../../shared/calculations/dashboard.js';
import type { ExportResult, MonthlyDashboard } from '../../shared/types/app-api.js';
import type { AppDatabase } from '../db/connection.js';
import { FacilityRepository } from '../db/repositories/facility-repository.js';
import { NursingCategoryRepository } from '../db/repositories/nursing-category-repository.js';
import { WeeklyEntryRepository } from '../db/repositories/weekly-entry-repository.js';
import { DashboardService } from './dashboard-service.js';
import { assertMonth } from './validation.js';

const bom = '\uFEFF';

export class ExportService {
  private readonly facilities: FacilityRepository;
  private readonly nursingCategories: NursingCategoryRepository;
  private readonly entries: WeeklyEntryRepository;
  private readonly dashboard: DashboardService;

  constructor(private readonly db: AppDatabase) {
    this.facilities = new FacilityRepository(db);
    this.nursingCategories = new NursingCategoryRepository(db);
    this.entries = new WeeklyEntryRepository(db);
    this.dashboard = new DashboardService(db);
  }

  async detailCsv(input: { targetMonth: string }): Promise<ExportResult> {
    const targetMonth = assertMonth(input.targetMonth);
    const csv = this.buildDetailCsv(targetMonth);
    return writeCsvWithDialog(csv, `${targetMonth.slice(0, 7)}-monthly-details.csv`);
  }

  async monthlyCsv(input: { targetMonth: string }): Promise<ExportResult> {
    const targetMonth = assertMonth(input.targetMonth);
    const csv = this.buildMonthlyCsv(targetMonth);
    return writeCsvWithDialog(csv, `${targetMonth.slice(0, 7)}-monthly-summary.csv`);
  }

  buildDetailCsv(targetMonth: string): { content: string; rowCount: number } {
    const facilities = new Map(
      this.facilities.list(true).map((facility) => [facility.id, facility])
    );
    const categories = new Map(
      this.nursingCategories.list().map((category) => [category.id, category])
    );
    const entries = this.entries.listByMonth(targetMonth);
    const rows: string[][] = [
      ['対象年月', '施設名', '看護区分', '人数', '売上円', '売上千円', '入力状態']
    ];

    entries.forEach((entry) => {
      const facility = facilities.get(entry.facilityId);
      if (!facility) {
        return;
      }

      this.entries.listDetails(entry.id).forEach((detail) => {
        const category = categories.get(detail.nursingCategoryId);
        const billingMode = category ? billingModeForCategory(category) : 'weekly';
        const billedDetail = applyEntryBilling(detail, billingMode, 0);
        const summary = calculateEntryDetail(billedDetail);
        rows.push([
          targetMonth,
          facility.name,
          category?.name ?? '',
          String(summary.peopleCount),
          String(summary.salesYen),
          yenToThousandYenLabel(summary.salesYen),
          entry.status === 'completed' ? '入力完了' : '一時保存'
        ]);
      });
    });

    return { content: bom + toCsv(rows), rowCount: rows.length - 1 };
  }

  buildMonthlyCsv(targetMonth: string): { content: string; rowCount: number } {
    const dashboard = this.dashboard.getMonthly({ targetMonth });
    const rows: string[][] = [
      [
        '種別',
        '名称',
        '目標千円',
        '概算売上千円',
        '確定売上千円',
        '概算達成率',
        '確定達成率',
        '概算差額千円',
        '確定差額千円'
      ],
      ['全体', '全体', ...overallSummaryCells(dashboard)]
    ];

    dashboard.facilityRows.forEach((row) => {
      rows.push(['施設別', row.facilityName, ...facilitySummaryCells(row)]);
    });

    dashboard.nursingCategoryRows.forEach((row) => {
      rows.push(['看護区分別', row.nursingCategoryName, ...estimatedSummaryCells(row)]);
    });

    return { content: bom + toCsv(rows), rowCount: rows.length - 1 };
  }
}

async function writeCsvWithDialog(
  csv: { content: string; rowCount: number },
  defaultPath: string
): Promise<ExportResult> {
  const result = await dialog.showSaveDialog({
    title: 'CSVを保存',
    defaultPath,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });

  if (result.canceled || !result.filePath) {
    return {
      ok: false,
      fileName: null,
      rowCount: 0,
      message: 'CSV保存をキャンセルしました。'
    };
  }

  writeFileSync(result.filePath, csv.content, 'utf8');
  return {
    ok: true,
    fileName: result.filePath.split(/[\\/]/).at(-1) ?? result.filePath,
    rowCount: csv.rowCount,
    message: 'CSVを保存しました。'
  };
}

function overallSummaryCells(dashboard: MonthlyDashboard): string[] {
  const confirmedSalesYen = dashboard.confirmedSalesYen;
  const confirmedAchievement = dashboard.confirmedAchievement;

  return [
    yenToThousandYenLabel(dashboard.summary.targetSalesYen),
    yenToThousandYenLabel(dashboard.summary.actualSalesYen),
    confirmedSalesYen === null ? '' : yenToThousandYenLabel(confirmedSalesYen),
    achievementLabel(dashboard.summary.achievement.ratePercent),
    confirmedAchievement ? achievementLabel(confirmedAchievement.ratePercent) : '',
    yenToThousandYenLabel(Math.abs(dashboard.summary.achievement.remainingYen)),
    confirmedAchievement ? yenToThousandYenLabel(Math.abs(confirmedAchievement.remainingYen)) : ''
  ];
}

function facilitySummaryCells(row: MonthlyDashboard['facilityRows'][number]): string[] {
  const confirmedSalesYen = row.confirmedSales?.confirmedSalesYen;
  return [
    yenToThousandYenLabel(row.targetSalesYen),
    yenToThousandYenLabel(row.actualSalesYen),
    confirmedSalesYen === undefined ? '' : yenToThousandYenLabel(confirmedSalesYen),
    achievementLabel(row.achievement.ratePercent),
    row.confirmedAchievement ? achievementLabel(row.confirmedAchievement.ratePercent) : '',
    yenToThousandYenLabel(Math.abs(row.achievement.remainingYen)),
    row.confirmedAchievement
      ? yenToThousandYenLabel(Math.abs(row.confirmedAchievement.remainingYen))
      : ''
  ];
}

function estimatedSummaryCells(summary: MonthlyDashboard['summary']): string[] {
  return [
    yenToThousandYenLabel(summary.targetSalesYen),
    yenToThousandYenLabel(summary.actualSalesYen),
    '',
    achievementLabel(summary.achievement.ratePercent),
    '',
    yenToThousandYenLabel(Math.abs(summary.achievement.remainingYen)),
    ''
  ];
}

function achievementLabel(ratePercent: number | null): string {
  return ratePercent === null ? '－' : `${ratePercent.toFixed(1)}%`;
}

function toCsv(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}
