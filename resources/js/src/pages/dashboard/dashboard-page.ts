import { ApiService, LinkDto, UserStatsDto } from '../../services/api';
import { AuthService } from '../../services/auth';

export class DashboardPage {
  static inject = [ApiService, AuthService];
  links: LinkDto[] = [];
  stats: UserStatsDto = { links: 0, clicks: 0, tags: 0 };
  isLoading = true;
  error = '';
  hasToken = false;
  copiedSlug: string | null = null;
  private copyTimeout?: number;

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

  shortUrl(slug?: string | null) {
    if (!slug) {
      return '';
    }
    return `${window.location.origin}/${slug}`;
  }

  async copyLink(slug?: string | null) {
    if (!slug) {
      return;
    }
    const url = this.shortUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    this.copiedSlug = slug;
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
    this.copyTimeout = window.setTimeout(() => {
      this.copiedSlug = null;
    }, 2000);
  }

  async attached() {
    this.hasToken = this.auth.hasToken();
    if (!this.hasToken) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = '';
    try {
      const [links, stats] = await Promise.all([
        this.api.listLinks(),
        this.api.getUserStats(),
      ]);
      this.links = links;
      this.stats = stats;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      this.isLoading = false;
    }
  }

  detaching() {
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
  }

  statusClass(link: LinkDto) {
    return link.is_active ? 'status-pill' : 'status-pill status-pill--neutral';
  }
}
