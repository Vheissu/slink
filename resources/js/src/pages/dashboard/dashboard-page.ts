import { ApiService, LinkDto, UserStatsDto } from '../../services/api';
import { AuthService } from '../../services/auth';
import { copyText, shortUrl } from '../../utils/clipboard';
import { LatestRequest } from '../../utils/latest-request';

export class DashboardPage {
  static inject = [ApiService, AuthService];
  links: LinkDto[] = [];
  stats: UserStatsDto = { links: 0, clicks: 0, tags: 0 };
  isLoading = true;
  error = '';
  hasToken = false;
  copiedSlug: string | null = null;
  private copyTimeout?: number;
  copyError = '';
  private dataRequest = new LatestRequest();
  private detached = false;

  constructor(private api: ApiService, private auth: AuthService) {}

  get metrics() {
    return [
      { label: 'Links', value: this.stats.links.toLocaleString(), help: 'Managed destinations' },
      { label: 'Total clicks', value: this.stats.clicks.toLocaleString(), help: 'Recorded visits' },
      {
        label: 'Clicks per link',
        value: this.stats.links ? (this.stats.clicks / this.stats.links).toFixed(1) : '0',
        help: 'Across all links',
      },
      { label: 'Tags', value: this.stats.tags.toLocaleString(), help: 'Used for sorting' },
    ];
  }

  get recentLinks() {
    return this.links.slice(0, 4);
  }

  shortUrl = shortUrl;

  async copyLink(slug?: string | null) {
    if (!slug) return;
    this.copyError = '';
    try {
      await copyText(shortUrl(slug));
      if (this.detached) return;
      this.copiedSlug = slug;
      if (this.copyTimeout) window.clearTimeout(this.copyTimeout);
      this.copyTimeout = window.setTimeout(() => { this.copiedSlug = null; }, 2000);
    } catch (error) {
      this.copyError = error instanceof Error ? error.message : 'Could not copy the link.';
    }
  }

  binding() {
    this.hasToken = this.auth.hasToken();
  }

  attached() {
    this.detached = false;
    void this.loadDashboard();
  }

  async loadDashboard() {
    const isCurrent = this.dataRequest.start();
    this.hasToken = this.auth.hasToken();
    if (!this.hasToken) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = '';
    try {
      const [links, stats] = await Promise.all([
        this.api.listLinks({ per_page: 4 }),
        this.api.getUserStats(),
      ]);
      if (!isCurrent()) return;
      this.links = links;
      this.stats = stats;
    } catch (err) {
      if (isCurrent()) this.error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      if (isCurrent()) this.isLoading = false;
    }
  }

  detaching() {
    this.detached = true;
    this.dataRequest.cancel();
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
  }

  statusClass(link: LinkDto) {
    return link.is_active ? 'status-pill' : 'status-pill status-pill--neutral';
  }
}
