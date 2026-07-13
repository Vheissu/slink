import { ICurrentRoute, IRouter, route } from '@aurelia/router';
import { UiActionsService } from './services/ui-actions';
import { AuthService } from './services/auth';
import { ApiService, QueueHealthDto } from './services/api';

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

  constructor(
    private router: IRouter,
    public currentRoute: ICurrentRoute,
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

  detaching() {
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

  get connectionLabel() {
    return this.hasToken ? 'API connected' : 'API setup required';
  }

  isRouteActive(path: string) {
    const currentPath = this.currentRoute.path || window.location.pathname.replace(/^\//, '');
    return path === 'dashboard'
      ? currentPath === '' || currentPath === 'dashboard'
      : currentPath === path;
  }
}
