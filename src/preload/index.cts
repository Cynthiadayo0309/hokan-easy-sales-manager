import type { HokanAppApi } from '../shared/types/app-api.js';

// Electron preload is emitted as CommonJS so it can run before the renderer loads.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const IPC_CHANNELS = {
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
  confirmedSalesGetByMonth: 'confirmed-sales:get-by-month',
  confirmedSalesSave: 'confirmed-sales:save',
  overallSalesTargetsGetByMonth: 'overall-sales-targets:get-by-month',
  overallSalesTargetsSave: 'overall-sales-targets:save',
  facilitySalesGetByMonth: 'facility-sales:get-by-month',
  facilitySalesSaveMonthly: 'facility-sales:save-monthly',
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

const api: HokanAppApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appGetInfo),
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing)
  },
  setup: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.setupGetStatus),
    complete: (input) => ipcRenderer.invoke(IPC_CHANNELS.setupComplete, input)
  },
  facilities: {
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitiesList, input),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitiesCreate, input),
    restoreDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.facilitiesRestoreDefaults),
    update: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitiesUpdate, input),
    deactivate: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitiesDeactivate, input)
  },
  rates: {
    list: (input) => ipcRenderer.invoke(IPC_CHANNELS.ratesList, input),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.ratesSave, input)
  },
  targets: {
    getByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.targetsGetByMonth, input),
    saveMonthly: (input) => ipcRenderer.invoke(IPC_CHANNELS.targetsSaveMonthly, input),
    copyPreviousMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.targetsCopyPreviousMonth, input)
  },
  confirmedSales: {
    getByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.confirmedSalesGetByMonth, input),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.confirmedSalesSave, input)
  },
  overallSalesTargets: {
    getByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.overallSalesTargetsGetByMonth, input),
    save: (input) => ipcRenderer.invoke(IPC_CHANNELS.overallSalesTargetsSave, input)
  },
  facilitySales: {
    getByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitySalesGetByMonth, input),
    saveMonthly: (input) => ipcRenderer.invoke(IPC_CHANNELS.facilitySalesSaveMonthly, input)
  },
  periods: {
    listByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.periodsListByMonth, input)
  },
  entries: {
    get: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesGet, input),
    saveDraft: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesSaveDraft, input),
    complete: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesComplete, input),
    getStatusByMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesGetStatusByMonth, input),
    copyPrevious: (input) => ipcRenderer.invoke(IPC_CHANNELS.entriesCopyPrevious, input)
  },
  dashboard: {
    getMonthly: (input) => ipcRenderer.invoke(IPC_CHANNELS.dashboardGetMonthly, input)
  },
  closings: {
    getStatus: (input) => ipcRenderer.invoke(IPC_CHANNELS.closingsGetStatus, input),
    closeMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.closingsCloseMonth, input),
    reopenMonth: (input) => ipcRenderer.invoke(IPC_CHANNELS.closingsReopenMonth, input)
  },
  export: {
    detailCsv: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportDetailCsv, input),
    monthlyCsv: (input) => ipcRenderer.invoke(IPC_CHANNELS.exportMonthlyCsv, input)
  },
  backup: {
    create: () => ipcRenderer.invoke(IPC_CHANNELS.backupCreate),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.backupRestore)
  }
};

contextBridge.exposeInMainWorld('hokanApp', api);
