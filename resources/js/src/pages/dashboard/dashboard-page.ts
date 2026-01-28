import { ApiService, LinkDto, UserStatsDto } from '../../services/api';

export class DashboardPage {
  static inject = [ApiService];
  links: LinkDto[] = [];
  stats: UserStatsDto = { links: 0, clicks: 0, tags: 0 };
  isLoading = true;
  error = '';
  copiedSlug: string | null = null;
  private copyTimeout?: number;

  constructor(private api: ApiService) {}

  get metrics() {
    return [
      { label: 'Links', value: this.stats.links.toLocaleString() },
      { label: 'Total clicks', value: this.stats.clicks.toLocaleString() },
      { label: 'Tags', value: this.stats.tags.toLocaleString() },
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
    this.isLoading = true;
    this.error = '';
    try {
      this.links = await this.api.listLinks();
      this.stats = await this.api.getUserStats();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      this.isLoading = false;
    }
  }
}
