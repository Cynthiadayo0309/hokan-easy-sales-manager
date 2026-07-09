export interface AppInfo {
  name: string;
  version: string;
  environment: 'development' | 'production';
  userDataPath: string;
  databasePath: string;
}

export interface PingResult {
  ok: true;
  message: string;
}

export type VisitFrequency = 1 | 2 | 3;
export type NursingCategoryCode =
  'long_term_care' | 'appendix_7' | 'psychiatric' | 'special_instruction';

export interface Facility {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NursingCategory {
  id: number;
  code: NursingCategoryCode;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface RateSetting {
  id: number;
  facilityId: number | null;
  nursingCategoryId: number;
  visitFrequency: VisitFrequency;
  amountYen: number;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyTarget {
  id: number;
  targetMonth: string;
  facilityId: number;
  nursingCategoryId: number;
  targetPeopleCount: number;
  targetVisitCount: number;
  targetSalesYen: number;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMonthlyPeriod {
  periodIndex: number;
  startDate: string;
  endDate: string;
  dayCount: number;
}

export interface MonthlyPeriod extends GeneratedMonthlyPeriod {
  id: number;
  targetMonth: string;
  createdAt: string;
}

export type WeeklyEntryStatus = 'not_started' | 'draft' | 'completed';
export type EntryBillingMode = 'weekly' | 'monthly';

export interface WeeklyEntry {
  id: number;
  targetMonth: string;
  monthlyPeriodId: number;
  facilityId: number;
  status: Exclude<WeeklyEntryStatus, 'not_started'>;
  completedAt: string | null;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyEntryDetail {
  id: number;
  weeklyEntryId: number;
  nursingCategoryId: number;
  peopleCount: number | null;
  rateYen: number;
  salesYen: number;
  billingMode: EntryBillingMode;
  previousPeopleCount: number;
  billablePeopleCount: number;
  billableSalesYen: number;
  oneVisitPeople: number | null;
  twoVisitPeople: number | null;
  threeVisitPeople: number | null;
  rateOneYen: number;
  rateTwoYen: number;
  rateThreeYen: number;
  createdAt: string;
  updatedAt: string;
}

export interface CalculatedEntrySummary {
  peopleCount: number;
  visitCount: number;
  salesYen: number;
}

export interface AchievementResult {
  ratePercent: number | null;
  remainingYen: number;
  status: 'not_set' | 'remaining' | 'achieved' | 'exceeded';
}

export interface ForecastResult {
  forecastSalesYen: number | null;
  completedDayCount: number;
  daysInMonth: number;
}

export interface DashboardSummary {
  targetPeopleCount: number;
  targetVisitCount: number;
  targetSalesYen: number;
  actualPeopleCount: number;
  actualVisitCount: number;
  actualSalesYen: number;
  achievement: AchievementResult;
  forecast: ForecastResult;
}

export interface DashboardFacilityRow extends DashboardSummary {
  facilityId: number;
  facilityName: string;
}

export interface DashboardNursingCategoryRow extends DashboardSummary {
  nursingCategoryId: number;
  nursingCategoryName: string;
}

export interface DashboardPeriodRow extends CalculatedEntrySummary {
  monthlyPeriodId: number;
  periodIndex: number;
  startDate: string;
  endDate: string;
  dayCount: number;
  completedFacilityCount: number;
  facilityCount: number;
}

export interface DashboardInputStatus {
  monthlyPeriodId: number | null;
  periodIndex: number | null;
  completedFacilityCount: number;
  facilityCount: number;
}

export interface MonthlyDashboard {
  targetMonth: string;
  summary: DashboardSummary;
  facilityRows: DashboardFacilityRow[];
  nursingCategoryRows: DashboardNursingCategoryRow[];
  periodRows: DashboardPeriodRow[];
  inputStatus: DashboardInputStatus;
}

export type MonthClosingState = 'open' | 'closed';

export interface MonthClosingRecord {
  id: number;
  targetMonth: string;
  status: MonthClosingState;
  closedAt: string | null;
  closedBy: number | null;
  reopenedAt: string | null;
  reopenedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthClosingWarning {
  type: 'missing_entry' | 'missing_target';
  message: string;
  facilityId?: number;
  facilityName?: string;
  monthlyPeriodId?: number;
  periodIndex?: number;
  nursingCategoryId?: number;
  nursingCategoryName?: string;
}

export interface PreviousMonthComparison {
  previousMonth: string;
  currentSalesYen: number;
  previousSalesYen: number;
  differenceYen: number;
}

export interface MonthClosingStatus {
  targetMonth: string;
  status: MonthClosingState;
  record: MonthClosingRecord | null;
  warnings: MonthClosingWarning[];
  canClose: boolean;
  comparison: PreviousMonthComparison;
}

export interface ExportResult {
  ok: boolean;
  fileName: string | null;
  rowCount: number;
  message: string;
}

export interface BackupResult {
  ok: boolean;
  fileName: string | null;
  message: string;
}

export interface RestoreResult {
  ok: boolean;
  backupFileName: string | null;
  restoredFileName: string | null;
  message: string;
}

export interface WeeklyEntryForm {
  entry: WeeklyEntry | null;
  status: WeeklyEntryStatus;
  targetMonth: string;
  monthlyPeriod: MonthlyPeriod;
  facility: Facility;
  nursingCategories: NursingCategory[];
  details: WeeklyEntryDetail[];
  summary: CalculatedEntrySummary;
}

export interface WeeklyEntryStatusCell {
  monthlyPeriodId: number;
  periodIndex: number;
  facilityId: number;
  status: WeeklyEntryStatus;
  entryId: number | null;
  periodDayCount: number;
}

export interface WeeklyEntryStatusMatrix {
  targetMonth: string;
  periods: MonthlyPeriod[];
  facilities: Facility[];
  cells: WeeklyEntryStatusCell[];
}

export interface InitialSetupStatus {
  completed: boolean;
  facilities: Facility[];
  nursingCategories: NursingCategory[];
  rates: RateSetting[];
}

export interface SaveFacilityInput {
  id?: number;
  name: string;
  displayOrder?: number;
}

export interface SaveRateSettingsInput {
  validFrom: string;
  rates: Array<{
    nursingCategoryId: number;
    amountThousandYen: string | number;
  }>;
}

export interface SaveMonthlyTargetsInput {
  targetMonth: string;
  targets: Array<{
    facilityId: number;
    nursingCategoryId: number;
    targetPeopleCount: number;
    targetVisitCount?: number;
    targetSalesThousandYen: string | number;
  }>;
}

export interface GetWeeklyEntryInput {
  targetMonth: string;
  monthlyPeriodId: number;
  facilityId: number;
}

export interface SaveWeeklyEntryDetailInput {
  nursingCategoryId: number;
  peopleCount?: number | null;
  oneVisitPeople?: number | null;
  twoVisitPeople?: number | null;
  threeVisitPeople?: number | null;
}

export interface SaveWeeklyEntryInput extends GetWeeklyEntryInput {
  details: SaveWeeklyEntryDetailInput[];
}

export type CopyPreviousWeeklyEntryInput = GetWeeklyEntryInput;

export interface CompleteInitialSetupInput {
  facilities: Array<{
    id: number;
    name: string;
  }>;
  rates: Array<{
    nursingCategoryId: number;
    amountThousandYen: string | number;
  }>;
}

export interface HokanAppApi {
  app: {
    getInfo(): Promise<AppInfo>;
    ping(): Promise<PingResult>;
  };
  setup: {
    getStatus(): Promise<InitialSetupStatus>;
    complete(input: CompleteInitialSetupInput): Promise<InitialSetupStatus>;
  };
  facilities: {
    list(input?: { includeInactive?: boolean }): Promise<Facility[]>;
    create(input: SaveFacilityInput): Promise<Facility>;
    restoreDefaults(): Promise<Facility[]>;
    update(input: SaveFacilityInput): Promise<Facility>;
    deactivate(input: { id: number }): Promise<Facility>;
  };
  rates: {
    list(input: { validOn?: string }): Promise<RateSetting[]>;
    save(input: SaveRateSettingsInput): Promise<RateSetting[]>;
  };
  targets: {
    getByMonth(input: { targetMonth: string }): Promise<MonthlyTarget[]>;
    saveMonthly(input: SaveMonthlyTargetsInput): Promise<MonthlyTarget[]>;
    copyPreviousMonth(input: { targetMonth: string }): Promise<MonthlyTarget[]>;
  };
  periods: {
    listByMonth(input: { targetMonth: string }): Promise<MonthlyPeriod[]>;
  };
  entries: {
    get(input: GetWeeklyEntryInput): Promise<WeeklyEntryForm>;
    saveDraft(input: SaveWeeklyEntryInput): Promise<WeeklyEntryForm>;
    complete(input: SaveWeeklyEntryInput): Promise<WeeklyEntryForm>;
    getStatusByMonth(input: { targetMonth: string }): Promise<WeeklyEntryStatusMatrix>;
    copyPrevious(input: CopyPreviousWeeklyEntryInput): Promise<WeeklyEntryForm>;
  };
  dashboard: {
    getMonthly(input: { targetMonth: string }): Promise<MonthlyDashboard>;
  };
  closings: {
    getStatus(input: { targetMonth: string }): Promise<MonthClosingStatus>;
    closeMonth(input: {
      targetMonth: string;
      acknowledgeWarnings: boolean;
    }): Promise<MonthClosingStatus>;
    reopenMonth(input: { targetMonth: string }): Promise<MonthClosingStatus>;
  };
  export: {
    detailCsv(input: { targetMonth: string }): Promise<ExportResult>;
    monthlyCsv(input: { targetMonth: string }): Promise<ExportResult>;
  };
  backup: {
    create(): Promise<BackupResult>;
    restore(): Promise<RestoreResult>;
  };
}

export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  appPing: 'app:ping',
  setupGetStatus: 'setup:get-status',
  setupComplete: 'setup:complete',
  facilitiesList: 'facilities:list',
  facilitiesCreate: 'facilities:create',
  facilitiesRestoreDefaults: 'facilities:restore-defaults',
  facilitiesUpdate: 'facilities:update',
  facilitiesDeactivate: 'facilities:deactivate',
  ratesList: 'rates:list',
  ratesSave: 'rates:save',
  targetsGetByMonth: 'targets:get-by-month',
  targetsSaveMonthly: 'targets:save-monthly',
  targetsCopyPreviousMonth: 'targets:copy-previous-month',
  periodsListByMonth: 'periods:list-by-month',
  entriesGet: 'entries:get',
  entriesSaveDraft: 'entries:save-draft',
  entriesComplete: 'entries:complete',
  entriesGetStatusByMonth: 'entries:get-status-by-month',
  entriesCopyPrevious: 'entries:copy-previous',
  dashboardGetMonthly: 'dashboard:get-monthly',
  closingsGetStatus: 'closings:get-status',
  closingsCloseMonth: 'closings:close-month',
  closingsReopenMonth: 'closings:reopen-month',
  exportDetailCsv: 'export:detail-csv',
  exportMonthlyCsv: 'export:monthly-csv',
  backupCreate: 'backup:create',
  backupRestore: 'backup:restore'
} as const;
