/// <reference types="vite/client" />

import type { HokanAppApi } from '../shared/types/app-api';

declare global {
  interface Window {
    hokanApp: HokanAppApi;
  }
}

export {};
