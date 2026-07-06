import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: '訪看かんたん売上管理',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: join(currentDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void window.webContents.session.clearCache().finally(() => {
      void window.loadURL(devServerUrl);
      window.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    void window.loadFile(join(currentDir, '../renderer/index.html'));
  }

  return window;
}
