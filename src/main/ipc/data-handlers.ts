import { ipcMain } from 'electron';

import {
  IPC_CHANNELS,
  type CompleteInitialSetupInput,
  type CopyPreviousWeeklyEntryInput,
  type GetWeeklyEntryInput,
  type SaveFacilityInput,
  type SaveMonthlyTargetsInput,
  type SaveRateSettingsInput,
  type SaveWeeklyEntryInput
} from '../../shared/types/app-api.js';
import type { DatabaseManager } from '../db/connection.js';
import { BackupService } from '../services/backup-service.js';
import { DashboardService } from '../services/dashboard-service.js';
import { EntryService } from '../services/entry-service.js';
import { ExportService } from '../services/export-service.js';
import { MonthClosingService } from '../services/month-closing-service.js';
import { PeriodService } from '../services/period-service.js';
import { RateService, TargetService } from '../services/rate-target-service.js';
import { FacilityService, SetupService } from '../services/setup-service.js';

type FacilityListInput = { includeInactive?: boolean };
type FacilityIdInput = { id: number };
type MonthInput = { targetMonth: string };
type CloseMonthInput = { targetMonth: string; acknowledgeWarnings: boolean };

export function registerDataIpcHandlers(dbManager: DatabaseManager, userDataPath: string): void {
  const db = () => dbManager.getDb();

  handleDataIpc(IPC_CHANNELS.setupGetStatus, () => new SetupService(db()).getStatus());
  handleDataIpc(IPC_CHANNELS.setupComplete, (input) =>
    new SetupService(db()).complete(input as CompleteInitialSetupInput)
  );
  handleDataIpc(IPC_CHANNELS.facilitiesList, (input) =>
    new FacilityService(db()).list(input as FacilityListInput | undefined)
  );
  handleDataIpc(IPC_CHANNELS.facilitiesCreate, (input) =>
    new FacilityService(db()).create(input as SaveFacilityInput)
  );
  handleDataIpc(IPC_CHANNELS.facilitiesRestoreDefaults, () =>
    new FacilityService(db()).restoreDefaults()
  );
  handleDataIpc(IPC_CHANNELS.facilitiesUpdate, (input) =>
    new FacilityService(db()).update(input as SaveFacilityInput)
  );
  handleDataIpc(IPC_CHANNELS.facilitiesDeactivate, (input) =>
    new FacilityService(db()).deactivate(input as FacilityIdInput)
  );
  handleDataIpc(IPC_CHANNELS.ratesList, (input) =>
    new RateService(db()).list(input as { validOn?: string } | undefined)
  );
  handleDataIpc(IPC_CHANNELS.ratesSave, (input) =>
    new RateService(db()).save(input as SaveRateSettingsInput)
  );
  handleDataIpc(IPC_CHANNELS.targetsGetByMonth, (input) =>
    new TargetService(db()).getByMonth(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.targetsSaveMonthly, (input) =>
    new TargetService(db()).saveMonthly(input as SaveMonthlyTargetsInput)
  );
  handleDataIpc(IPC_CHANNELS.targetsCopyPreviousMonth, (input) =>
    new TargetService(db()).copyPreviousMonth(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.periodsListByMonth, (input) =>
    new PeriodService(db()).listByMonth(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.entriesGet, (input) =>
    new EntryService(db()).get(input as GetWeeklyEntryInput)
  );
  handleDataIpc(IPC_CHANNELS.entriesSaveDraft, (input) =>
    new EntryService(db()).saveDraft(input as SaveWeeklyEntryInput)
  );
  handleDataIpc(IPC_CHANNELS.entriesComplete, (input) =>
    new EntryService(db()).complete(input as SaveWeeklyEntryInput)
  );
  handleDataIpc(IPC_CHANNELS.entriesGetStatusByMonth, (input) =>
    new EntryService(db()).getStatusByMonth(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.entriesCopyPrevious, (input) =>
    new EntryService(db()).copyPrevious(input as CopyPreviousWeeklyEntryInput)
  );
  handleDataIpc(IPC_CHANNELS.dashboardGetMonthly, (input) =>
    new DashboardService(db()).getMonthly(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.closingsGetStatus, (input) => {
    const monthInput = input as MonthInput;
    const dashboard = new DashboardService(db()).getMonthly(monthInput);
    const previousDashboard = new DashboardService(db()).getMonthly({
      targetMonth: dashboard.summary.forecast.daysInMonth
        ? getPreviousMonth(monthInput.targetMonth)
        : monthInput.targetMonth
    });
    return new MonthClosingService(db()).getStatus(monthInput, dashboard, previousDashboard);
  });
  handleDataIpc(IPC_CHANNELS.closingsCloseMonth, (input) =>
    new MonthClosingService(db()).closeMonth(input as CloseMonthInput)
  );
  handleDataIpc(IPC_CHANNELS.closingsReopenMonth, (input) =>
    new MonthClosingService(db()).reopenMonth(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.exportDetailCsv, (input) =>
    new ExportService(db()).detailCsv(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.exportMonthlyCsv, (input) =>
    new ExportService(db()).monthlyCsv(input as MonthInput)
  );
  handleDataIpc(IPC_CHANNELS.backupCreate, () =>
    new BackupService(dbManager, userDataPath).create()
  );
  handleDataIpc(IPC_CHANNELS.backupRestore, () =>
    new BackupService(dbManager, userDataPath).restore()
  );
}

function handleDataIpc<Output>(
  channel: string,
  handler: (input: unknown) => Output | Promise<Output>
): void {
  ipcMain.handle(channel, async (_event, input: unknown) => {
    try {
      return await handler(input);
    } catch (error) {
      console.error(`[ipc:${channel}]`, error);
      throw error;
    }
  });
}

function getPreviousMonth(targetMonth: string): string {
  const year = Number.parseInt(targetMonth.slice(0, 4), 10);
  const monthIndex = Number.parseInt(targetMonth.slice(5, 7), 10) - 1;
  return new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString().slice(0, 10);
}
