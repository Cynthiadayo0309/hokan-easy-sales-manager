import { app, BrowserWindow, ipcMain, shell } from 'electron';

import { IPC_CHANNELS, type AppInfo, type PingResult } from '../shared/types/app-api.js';
import { DatabaseManager, getApplicationDbPath } from './db/connection.js';
import { registerDataIpcHandlers } from './ipc/data-handlers.js';
import { createMainWindow } from './window.js';

function registerIpcHandlers(userDataPath: string, databasePath: string): void {
  ipcMain.handle(IPC_CHANNELS.appGetInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    environment: app.isPackaged ? 'production' : 'development',
    userDataPath,
    databasePath
  }));

  ipcMain.handle(IPC_CHANNELS.appPing, (): PingResult => ({
    ok: true,
    message: 'Main / Preload / Renderer の接続を確認しました。'
  }));
}

function registerSecurityGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    contents.on('will-navigate', (event, url) => {
      const currentUrl = contents.getURL();
      if (currentUrl && url !== currentUrl) {
        event.preventDefault();
      }
    });
  });
}

async function bootstrap(): Promise<void> {
  registerSecurityGuards();

  await app.whenReady();

  const userDataPath = app.getPath('userData');
  const databasePath = getApplicationDbPath(userDataPath);
  const dbManager = new DatabaseManager(databasePath);
  registerIpcHandlers(userDataPath, databasePath);
  registerDataIpcHandlers(dbManager, userDataPath);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

void bootstrap();
