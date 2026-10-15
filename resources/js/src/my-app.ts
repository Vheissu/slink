import { ICurrentRoute, IRouter, route } from '@aurelia/router';
import { UiActionsService } from './services/ui-actions';
import { AuthService } from './services/auth';
import { ApiService, QueueHealthDto } from './services/api';
import { LatestRequest } from './utils/latest-request';

@route({
  routes: [
    { path: ['', 'dashboard'], component: import('./pages/dashboard/dashboard-page'), title: 'Dashboard' },
    { path: 'links', component: import('./pages/links/links-page'), title: 'Links' },
    { path: 'analytics', component: import('./pages/analytics/analytics-page'), title: 'Analytics' },
    { path: 'settings', component: import('./pages/settings/settings-page'), title: 'Settings' },
  ],
})
export class MyApp {
  static inject = [IRouter, ICurrentRoute, UiActionsService, AuthService, ApiService];

  appName = 'Slink';
  year = new Date().getFullYear();
  hasToken = false;
  queueHealth: QueueHealthDto | null = null;
  queueError = '';
  isLoadingQueue = false;
  private queueRequest = new LatestRequest();

  constructor(
    private router: IRouter,
    public currentRoute: ICurrentRoute,
    private actions: UiActionsService,
    private auth: AuthService,
    private api: ApiService,
  ) {}

  attached() {
    this.hasToken = Boolean(this.auth.getToken());
    window.addEventListener('slink:token', this.onTokenEvent);
    if (this.hasToken) {
      this.refreshQueueHealth();
    }
  }

  detaching() {
    this.queueRequest.cancel();
    window.removeEventListener('slink:token', this.onTokenEvent);
  }

  private onTokenEvent = (event: Event) => {
    const detail = (event as CustomEvent<boolean>).detail;
    this.hasToken = Boolean(detail);
    if (this.hasToken) {
      this.refreshQueueHealth();
    } else {
      this.queueRequest.cancel();
      this.queueHealth = null;
      this.queueError = '';
      this.isLoadingQueue = false;
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
    const isCurrent = this.queueRequest.start();
    this.isLoadingQueue = true;
    this.queueHealth = null;
    this.queueError = '';
    try {
      const health = await this.api.getQueueHealth();
      if (isCurrent()) this.queueHealth = health;
    } catch (err) {
      if (!isCurrent()) return;
      this.queueError = err instanceof Error ? err.message : 'Failed to load queue status';
      this.queueHealth = null;
    } finally {
      if (isCurrent()) this.isLoadingQueue = false;
    }
  }

  get queueStatusLabel() {
    if (!this.queueHealth) {
      return this.isLoadingQueue ? 'Checking…' : 'Unknown';
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
    return status.charAt(0).toUpperCase() + status.slice(1);
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

  get connectionLabel() {
    return this.hasToken ? 'API token saved' : 'API setup required';
  }
}
