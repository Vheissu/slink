import { ApiService, AuditLogDto } from '../../services/api';
import { AuthService } from '../../services/auth';

export class SettingsPage {
  static inject = [AuthService, ApiService];
  tokenInput = '';
  status = '';
  auditLogs: AuditLogDto[] = [];
  auditError = '';
  isLoadingAudit = false;
  hasToken = false;
  showToken = false;

  constructor(private auth: AuthService, private api: ApiService) {}

  async attached() {
    this.tokenInput = this.auth.getToken() ?? '';
    this.hasToken = this.auth.hasToken();
    await this.loadAuditLogs();
  }

  async saveToken() {
    this.auth.setToken(this.tokenInput.trim() || null);
    this.api.setToken(this.auth.getToken());
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
    if (!this.auth.getToken()) {
      this.auditLogs = [];
      this.auditError = '';
      return;
    }
    this.isLoadingAudit = true;
    this.auditError = '';
    try {
      this.auditLogs = await this.api.listAuditLogs({ per_page: 5 });
    } catch (err) {
      this.auditError = err instanceof Error ? err.message : 'Failed to load audit logs.';
    } finally {
      this.isLoadingAudit = false;
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
