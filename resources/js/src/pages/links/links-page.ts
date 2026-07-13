import QRCode from 'qrcode';
import { ApiService, LinkDto, TagDto } from '../../services/api';
import { AuthService } from '../../services/auth';
import { UiActionsService, UiAction } from '../../services/ui-actions';

type StatusFilter = 'all' | 'active' | 'inactive';

export class LinksPage {
  static inject = [ApiService, UiActionsService, AuthService];
  links: LinkDto[] = [];
  tags: TagDto[] = [];
  isLoading = true;
  hasToken = false;
  loadError = '';
  createError = '';
  createdLink: LinkDto | null = null;

  newUrl = '';
  newTitle = '';
  newPassword = '';
  isSaving = false;

  searchQuery = '';
  statusFilter: StatusFilter = 'all';
  selectedTag = '';
  dateFrom = '';
  dateTo = '';
  showDateFilters = false;
  page = 1;
  readonly perPage = 20;
  lastPage = 1;
  pageFrom: number | null = null;
  pageTo: number | null = null;
  total = 0;

  isImporting = false;
  importStatus = '';
  importError = '';

  urlInput?: HTMLInputElement;
  csvInput?: HTMLInputElement;

  copiedSlug: string | null = null;
  copiedOriginal: string | null = null;
  private copyTimeout?: number;

  selectedIds: string[] = [];
  bulkTagId = '';
  bulkActionStatus = '';
  bulkActionError = '';

  activeLink: LinkDto | null = null;
  isDrawerOpen = false;
  editTitle = '';
  editOriginalUrl = '';
  editNotes = '';
  editExpiresAt = '';
  editMaxClicks = '';
  editIsActive = true;
  editPassword = '';
  clearPassword = false;
  editTagIds: string[] = [];
  qrDataUrl = '';
  isSavingDetails = false;
  detailStatus = '';
  detailError = '';
  newTagName = '';
  newTagColor = '#c24718';

  private unsubscribe?: () => void;

  constructor(
    private api: ApiService,
    private actions: UiActionsService,
    private auth: AuthService,
  ) {}

  get selectedCount() {
    return this.selectedIds.length;
  }

  get allSelected() {
    return this.links.length > 0 && this.links.every((link) => this.selectedIds.includes(link.id));
  }

  get pageSummary() {
    if (!this.total || this.pageFrom === null || this.pageTo === null) {
      return '0 links';
    }
    return `${this.pageFrom}-${this.pageTo} of ${this.total} links`;
  }

  async attached() {
    this.hasToken = this.auth.hasToken();
    this.unsubscribe = this.actions.onAction((action) => this.handleAction(action));
    document.addEventListener('keydown', this.handleKeydown);

    const pending = this.actions.consume();
    if (pending) {
      this.handleAction(pending);
    }

    if (!this.hasToken) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.loadError = '';
    try {
      const [page, tags] = await Promise.all([this.api.listLinksPage(), this.api.listTags()]);
      this.applyPage(page);
      this.tags = tags;
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'Failed to load links.';
    } finally {
      this.isLoading = false;
    }
  }

  detaching() {
    this.unsubscribe?.();
    document.removeEventListener('keydown', this.handleKeydown);
    document.body.classList.remove('drawer-open');
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
  }

  async loadLinks(page = this.page) {
    this.isLoading = true;
    this.loadError = '';
    try {
      const response = await this.api.listLinksPage({
        search: this.searchQuery.trim() || undefined,
        status: this.statusFilter,
        tag: this.selectedTag || undefined,
        from: this.dateFrom || undefined,
        to: this.dateTo || undefined,
        page,
      });
      this.applyPage(response);
      this.selectedIds = [];
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'Failed to load links.';
    } finally {
      this.isLoading = false;
    }
  }

  async applyFilters() {
    await this.loadLinks(1);
  }

  async clearFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.selectedTag = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.showDateFilters = false;
    await this.loadLinks(1);
  }

  setStatusFilter(status: StatusFilter) {
    this.statusFilter = status;
  }

  async createLink() {
    this.isSaving = true;
    this.createError = '';
    this.createdLink = null;
    try {
      const originalUrl = this.normalizeUrl(this.newUrl);
      const created = await this.api.createLink({
        original_url: originalUrl,
        title: this.newTitle || null,
        password: this.newPassword || null,
      });
      this.createdLink = created;
      this.total += 1;
      this.lastPage = Math.max(1, Math.ceil(this.total / this.perPage));
      if (this.page === 1) {
        this.links = [created, ...this.links].slice(0, this.perPage);
        this.pageFrom = 1;
        this.pageTo = this.links.length;
      }
      this.newUrl = '';
      this.newTitle = '';
      this.newPassword = '';
    } catch (err) {
      this.createError = err instanceof Error ? err.message : 'Failed to create link.';
    } finally {
      this.isSaving = false;
    }
  }

  shortUrl(slug?: string | null) {
    if (!slug) {
      return '';
    }
    return `${window.location.origin}/${slug}`;
  }

  healthLabel(link: LinkDto) {
    const status = link.health_status ?? 'unknown';
    if (status === 'healthy') {
      return 'Healthy';
    }
    if (status === 'unreachable') {
      return 'Unreachable';
    }
    return 'Unknown';
  }

  healthClass(link: LinkDto) {
    const status = link.health_status ?? 'unknown';
    if (status === 'healthy') {
      return 'status-pill';
    }
    if (status === 'unreachable') {
      return 'status-pill status-pill--error';
    }
    return 'status-pill status-pill--neutral';
  }

  async copyLink(slug?: string | null) {
    if (!slug) {
      return;
    }
    const url = this.shortUrl(slug);
    await this.copyText(url);
    this.copiedSlug = slug;
    this.copiedOriginal = null;
    this.resetCopyState();
  }

  async copyOriginal(url?: string | null) {
    if (!url) {
      return;
    }
    await this.copyText(url);
    this.copiedOriginal = url;
    this.copiedSlug = null;
    this.resetCopyState();
  }

  private async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  private resetCopyState() {
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
    this.copyTimeout = window.setTimeout(() => {
      this.copiedSlug = null;
      this.copiedOriginal = null;
    }, 2000);
  }

  toggleSelected(id: string) {
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((item) => item !== id);
    } else {
      this.selectedIds = [...this.selectedIds, id];
    }
  }

  toggleSelectAll() {
    if (this.allSelected) {
      this.selectedIds = [];
      return;
    }
    this.selectedIds = this.links.map((link) => link.id);
  }

  triggerCsvImport() {
    this.csvInput?.click();
  }

  async handleCsvChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.importStatus = '';
    this.importError = '';
    this.isImporting = true;

    try {
      const text = await file.text();
      const rows = this.parseCsv(text);
      const { payloads, skipped } = this.buildBulkPayload(rows);

      if (!payloads.length) {
        this.importError = 'No valid rows found in the CSV.';
        return;
      }

      const response = await this.api.bulkCreateLinks(payloads);
      const created = response.data ?? [];
      this.total += created.length;
      this.lastPage = Math.max(1, Math.ceil(this.total / this.perPage));
      if (this.page === 1) {
        this.links = [...created, ...this.links].slice(0, this.perPage);
        this.pageFrom = this.links.length ? 1 : null;
        this.pageTo = this.links.length || null;
      }
      this.importStatus = `Imported ${created.length} links${skipped ? `, skipped ${skipped}` : ''}.`;
    } catch (err) {
      this.importError = err instanceof Error ? err.message : 'Failed to import CSV.';
    } finally {
      this.isImporting = false;
      input.value = '';
    }
  }

  async bulkAction(action: 'activate' | 'deactivate' | 'delete' | 'tag' | 'untag') {
    this.bulkActionError = '';
    this.bulkActionStatus = '';

    const ids = [...this.selectedIds];
    if (!ids.length) {
      return;
    }

    if (action === 'delete' && !confirm(`Delete ${ids.length} selected links?`)) {
      return;
    }

    if ((action === 'tag' || action === 'untag') && !this.bulkTagId) {
      this.bulkActionError = 'Select a tag for this action.';
      return;
    }

    try {
      const payload = { action, ids, tag_id: this.bulkTagId || undefined };
      const response = await this.api.bulkActionLinks(payload);
      this.bulkActionStatus = `${response.affected ?? ids.length} links updated.`;
      await this.loadLinks();
    } catch (err) {
      this.bulkActionError = err instanceof Error ? err.message : 'Bulk action failed.';
    }
  }

  exportSelectedCsv() {
    const ids = [...this.selectedIds];
    if (!ids.length) {
      return;
    }
    const selectedLinks = this.links.filter((link) => ids.includes(link.id));
    const header = ['title', 'original_url', 'slug', 'short_url', 'is_active', 'clicks'];
    const rows = selectedLinks.map((link) => [
      link.title ?? '',
      link.original_url,
      link.slug,
      this.shortUrl(link.slug),
      link.is_active ? 'active' : 'inactive',
      link.clicks_count?.toString() ?? '0',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'slink-links.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  openDetails(link: LinkDto) {
    this.activeLink = link;
    this.isDrawerOpen = true;
    document.body.classList.add('drawer-open');
    this.editTitle = link.title ?? '';
    this.editOriginalUrl = link.original_url ?? '';
    this.editNotes = link.notes ?? '';
    this.editIsActive = Boolean(link.is_active);
    this.editMaxClicks = link.max_clicks ? String(link.max_clicks) : '';
    this.editExpiresAt = link.expires_at ? this.formatDateInput(link.expires_at) : '';
    this.editTagIds = link.tags?.map((tag) => tag.id) ?? [];
    this.editPassword = '';
    this.clearPassword = false;
    this.qrDataUrl = '';
    this.detailStatus = '';
    this.detailError = '';
    if (link.slug) {
      this.generateQr(link.slug);
    }
  }

  closeDetails() {
    this.isDrawerOpen = false;
    document.body.classList.remove('drawer-open');
    this.activeLink = null;
    this.qrDataUrl = '';
  }

  toggleTag(tagId: string) {
    if (this.editTagIds.includes(tagId)) {
      this.editTagIds = this.editTagIds.filter((id) => id !== tagId);
      return;
    }
    this.editTagIds = [...this.editTagIds, tagId];
  }

  async createTag() {
    const name = this.newTagName.trim();
    if (!name) {
      return;
    }
    try {
      const created = await this.api.createTag({ name, color: this.newTagColor || null });
      this.tags = [created, ...this.tags];
      this.newTagName = '';
      this.newTagColor = '#c24718';
    } catch (err) {
      this.detailError = err instanceof Error ? err.message : 'Failed to create tag.';
    }
  }

  async saveDetails() {
    if (!this.activeLink) {
      return;
    }

    this.isSavingDetails = true;
    this.detailError = '';
    this.detailStatus = '';
    try {
      const originalUrl = this.normalizeUrl(this.editOriginalUrl);
      const payload: {
        title?: string | null;
        original_url?: string | null;
        notes?: string | null;
        expires_at?: string | null;
        max_clicks?: number | null;
        is_active?: boolean;
        tags?: string[];
        password?: string | null;
      } = {
        title: this.editTitle || null,
        original_url: originalUrl,
        notes: this.editNotes || null,
        expires_at: this.editExpiresAt || null,
        max_clicks: this.editMaxClicks ? Number(this.editMaxClicks) : null,
        is_active: this.editIsActive,
        tags: this.editTagIds,
      };

      if (this.clearPassword) {
        payload.password = '';
      } else if (this.editPassword) {
        payload.password = this.editPassword;
      }

      const updated = await this.api.updateLink(this.activeLink.id, payload);
      this.links = this.links.map((link) => (link.id === updated.id ? updated : link));
      this.activeLink = updated;
      this.editPassword = '';
      this.clearPassword = false;
      this.detailStatus = 'Changes saved.';
    } catch (err) {
      this.detailError = err instanceof Error ? err.message : 'Failed to save changes.';
    } finally {
      this.isSavingDetails = false;
    }
  }

  async generateQr(slug: string) {
    try {
      this.qrDataUrl = await QRCode.toDataURL(this.shortUrl(slug), {
        width: 200,
        margin: 1,
      });
    } catch (err) {
      this.qrDataUrl = '';
    }
  }

  downloadQr() {
    if (!this.qrDataUrl || !this.activeLink?.slug) {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = this.qrDataUrl;
    anchor.download = `${this.activeLink.slug}.png`;
    anchor.click();
  }

  private handleAction(action: UiAction) {
    if (action === 'create') {
      this.focusCreate();
      return;
    }
    if (action === 'import') {
      this.triggerCsvImport();
    }
  }

  async goToPage(page: number) {
    if (page < 1 || page > this.lastPage || page === this.page) {
      return;
    }
    await this.loadLinks(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  linkStatusClass(link: LinkDto) {
    return link.is_active ? 'status-pill' : 'status-pill status-pill--neutral';
  }

  private applyPage(response: {
    data: LinkDto[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
  }) {
    this.links = response.data;
    this.page = response.current_page;
    this.lastPage = response.last_page;
    this.pageFrom = response.from;
    this.pageTo = response.to;
    this.total = response.total;
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.isDrawerOpen) {
      this.closeDetails();
    }
  };

  private normalizeUrl(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error('Destination URL is required.');
    }

    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error('Enter a valid destination URL.');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS destinations are supported.');
    }

    return url.toString();
  }

  private focusCreate() {
    if (!this.urlInput) {
      return;
    }
    this.urlInput.focus();
    this.urlInput.select();
  }

  private formatDateInput(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }

  private parseCsv(text: string) {
    const rows: string[][] = [];
    let current: string[] = [];
    let value = '';
    let inQuotes = false;

    const pushValue = () => {
      current.push(value);
      value = '';
    };

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"') {
        const next = text[i + 1];
        if (inQuotes && next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        pushValue();
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && text[i + 1] === '\n') {
          i += 1;
        }
        pushValue();
        if (current.some((field) => field.trim() !== '')) {
          rows.push(current.map((field) => field.trim()));
        }
        current = [];
        continue;
      }

      value += char;
    }

    if (value.length || current.length) {
      pushValue();
      if (current.some((field) => field.trim() !== '')) {
        rows.push(current.map((field) => field.trim()));
      }
    }

    return rows;
  }

  private buildBulkPayload(rows: string[][]) {
    if (!rows.length) {
      return { payloads: [], skipped: 0 };
    }

    const header = rows[0].map((col) => col.toLowerCase());
    const headerMap: Record<string, string> = {
      url: 'original_url',
      original_url: 'original_url',
      link: 'original_url',
      title: 'title',
      expires_at: 'expires_at',
      max_clicks: 'max_clicks',
    };

    const hasHeader = header.some((col) => headerMap[col]);
    const startIndex = hasHeader ? 1 : 0;
    const payloads: Array<{
      original_url: string;
      title?: string | null;
      expires_at?: string | null;
      max_clicks?: number | null;
    }> = [];
    let skipped = 0;

    for (let i = startIndex; i < rows.length; i += 1) {
      const row = rows[i];
      const payload: Record<string, string> = {};

      if (hasHeader) {
        header.forEach((col, index) => {
          const key = headerMap[col];
          if (key && row[index]) {
            payload[key] = row[index];
          }
        });
      } else {
        payload.original_url = row[0] ?? '';
        if (row[1]) {
          payload.title = row[1];
        }
      }

      if (!payload.original_url) {
        skipped += 1;
        continue;
      }

      payloads.push({
        original_url: payload.original_url,
        title: payload.title || null,
        expires_at: payload.expires_at || null,
        max_clicks: payload.max_clicks ? Number(payload.max_clicks) : null,
      });
    }

    return { payloads, skipped };
  }
}
