import { defineStore } from 'pinia';

import type { AppInfo, PingResult } from '@shared/types/app-api';

interface AppStatusState {
  info: AppInfo | null;
  ping: PingResult | null;
  loading: boolean;
  errorMessage: string | null;
}

export const useAppStatusStore = defineStore('appStatus', {
  state: (): AppStatusState => ({
    info: null,
    ping: null,
    loading: false,
    errorMessage: null
  }),
  actions: {
    async loadStatus(): Promise<void> {
      this.loading = true;
      this.errorMessage = null;

      try {
        const [info, ping] = await Promise.all([
          window.hokanApp.app.getInfo(),
          window.hokanApp.app.ping()
        ]);
        this.info = info;
        this.ping = ping;
      } catch {
        this.errorMessage = 'アプリの準備状況を確認できませんでした。もう一度起動してください。';
      } finally {
        this.loading = false;
      }
    }
  }
});
