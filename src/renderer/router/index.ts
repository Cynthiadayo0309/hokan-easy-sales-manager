import { createRouter, createWebHashHistory } from 'vue-router';

import BackupView from '../views/BackupView.vue';
import FacilityView from '../views/FacilityView.vue';
import HistoryView from '../views/HistoryView.vue';
import HomeView from '../views/HomeView.vue';
import InitialSetupView from '../views/InitialSetupView.vue';
import SettingsView from '../views/SettingsView.vue';
import WeeklyInputView from '../views/WeeklyInputView.vue';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/initial-setup', name: 'initial-setup', component: InitialSetupView },
    { path: '/weekly-input', name: 'weekly-input', component: WeeklyInputView },
    { path: '/facility', name: 'facility', component: FacilityView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/backup', name: 'backup', component: BackupView }
  ]
});

router.beforeEach(async (to) => {
  if (!window.hokanApp?.setup) {
    return true;
  }

  const status = await window.hokanApp.setup.getStatus();

  if (!status.completed && to.name !== 'initial-setup') {
    return { name: 'initial-setup' };
  }

  if (status.completed && to.name === 'initial-setup') {
    return { name: 'home' };
  }

  return true;
});
