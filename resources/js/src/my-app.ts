import { DashboardPage } from './pages/dashboard/dashboard-page';
import { LinksPage } from './pages/links/links-page';
import { AnalyticsPage } from './pages/analytics/analytics-page';
import { SettingsPage } from './pages/settings/settings-page';
import { IRouter } from '@aurelia/router';
import { UiActionsService } from './services/ui-actions';
import { AuthService } from './services/auth';
import { ApiService, QueueHealthDto } from './services/api';

export class MyApp {
  static inject = [IRouter, UiActionsService, AuthService, ApiService];
  static routes = [
    { path: ['', 'dashboard'], component: DashboardPage, title: 'Dashboard' },
    { path: 'links', component: LinksPage, title: 'Links' },
    { path: 'analytics', component: AnalyticsPage, title: 'Analytics' },
    { path: 'settings', component: SettingsPage, title: 'Settings' },
  ];

  appName = 'Slink';
  year = new Date().getFullYear();
  hasToken = false;
  queueHealth: QueueHealthDto | null = null;
  queueError = '';

  constructor(
    private router: IRouter,
    private actions: UiActionsService,
    private auth: AuthService,
    private api: ApiService
  ) {}

  attached() {
    this.hasToken = Boolean(this.auth.getToken());
    window.addEventListener('slink:token', this.onTokenEvent);
    if (this.hasToken) {
      this.refreshQueueHealth();
    }
  }

  detached() {
    window.removeEventListener('slink:token', this.onTokenEvent);
  }

  private onTokenEvent = (event: Event) => {
    const detail = (event as CustomEvent<boolean>).detail;
    this.hasToken = Boolean(detail);
    if (this.hasToken) {
      this.refreshQueueHealth();
    } else {
      this.queueHealth = null;
    }
  };

  async requestCreate() {
    this.actions.trigger('create');
    await this.router.load('links');
  }

  async requestImport() {
    this.actions.trigger('import');
    await this.router.load('links');
  }

  async refreshQueueHealth() {
    if (!this.hasToken) {
      return;
    }
    this.queueError = '';
    try {
      this.queueHealth = await this.api.getQueueHealth();
    } catch (err) {
      this.queueError = err instanceof Error ? err.message : 'Failed to load queue status';
      this.queueHealth = null;
    }
  }

  get queueStatusLabel() {
    if (!this.queueHealth) {
      return 'Unknown';
    }
    const status = this.queueHealth.status;
    if (status === 'running') {
      return 'Active';
    }
    if (status === 'paused') {
      return 'Paused';
    }
    if (status === 'inactive') {
      return 'Inactive';
    }
    return status;
  }

  get queueStatusClass() {
    if (!this.queueHealth) {
      return 'status-pill status-pill--neutral';
    }
    const status = this.queueHealth.status;
    if (status === 'running') {
      return 'status-pill';
    }
    if (status === 'paused') {
      return 'status-pill status-pill--warning';
    }
    if (status === 'inactive') {
      return 'status-pill status-pill--error';
    }
    return 'status-pill status-pill--neutral';
  }
}
