import { ApiService, AuditLogDto } from '../../services/api';
import { AuthService } from '../../services/auth';
import { LatestRequest } from '../../utils/latest-request';

export class SettingsPage {
  static inject = [AuthService, ApiService];
  tokenInput = '';
  status = '';
  auditLogs: AuditLogDto[] = [];
  auditError = '';
  isLoadingAudit = false;
  hasToken = false;
  showToken = false;
  tokenError = '';
  private auditRequest = new LatestRequest();

  constructor(private auth: AuthService, private api: ApiService) {}

  attached() {
    this.tokenInput = this.auth.getToken() ?? '';
    this.hasToken = this.auth.hasToken();
    void this.loadAuditLogs();
  }

  detaching() {
    this.auditRequest.cancel();
  }

  async saveToken() {
    this.tokenError = '';
    this.status = '';
    try {
      this.auth.setToken(this.tokenInput.trim() || null);
    } catch {
      this.tokenError = 'Your browser could not save the token. Check its storage settings and try again.';
      return;
    }
    this.showToken = false;
    this.hasToken = this.auth.hasToken();
    this.status = this.hasToken ? 'Token saved in this browser.' : 'Token cleared.';
    this.dispatchTokenState(this.hasToken);
    await this.loadAuditLogs();
  }

  async clearToken() {
    this.tokenInput = '';
    await this.saveToken();
  }

  toggleTokenVisibility() {
    this.showToken = !this.showToken;
  }

  private dispatchTokenState(hasToken: boolean) {
    window.dispatchEvent(new CustomEvent('slink:token', { detail: hasToken }));
  }

  async loadAuditLogs() {
    const isCurrent = this.auditRequest.start();
    this.auditLogs = [];
    if (!this.auth.getToken()) {
      this.auditError = '';
      this.isLoadingAudit = false;
      return;
    }
    this.isLoadingAudit = true;
    this.auditError = '';
    try {
      const logs = await this.api.listAuditLogs({ per_page: 5 });
      if (isCurrent()) this.auditLogs = logs;
    } catch (err) {
      if (isCurrent()) this.auditError = err instanceof Error ? err.message : 'Failed to load audit logs.';
    } finally {
      if (isCurrent()) this.isLoadingAudit = false;
    }
  }

  formatAction(action: string) {
    return action
      .split('.')
      .map((part) => part.replace(/_/g, ' '))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  formatSubject(subjectType: string | null, subjectId: string | null) {
    if (!subjectType) {
      return subjectId ?? '';
    }
    const subject = subjectType.split('\\').pop() ?? subjectType;
    return subjectId ? `${subject} ${subjectId}` : subject;
  }

  formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }
}
