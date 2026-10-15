import QRCode from 'qrcode';
import { ApiService, BulkAction, LinkDto, LinkPageDto, TagDto, UpdateLinkPayload } from '../../services/api';
import { AuthService } from '../../services/auth';
import { UiActionsService, UiAction } from '../../services/ui-actions';
import { LatestRequest } from '../../utils/latest-request';
import { copyText, shortUrl } from '../../utils/clipboard';
import { buildBulkPayload, downloadCsv, parseCsv } from '../../utils/csv';
import { normalizeUrl, parseClickLimit } from '../../utils/link-input';

type StatusFilter = 'all' | 'active' | 'inactive';

export class LinksPage {
  static inject = [ApiService, UiActionsService, AuthService];
  links: LinkDto[] = [];
  tags: TagDto[] = [];
  isLoading = true;
  hasToken = false;
  loadError = '';
  tagError = '';
  copyError = '';
  isBulkUpdating = false;
  isCreatingTag = false;
  detailsDialog?: HTMLDialogElement;
  detailsCloseButton?: HTMLButtonElement;
  searchInput?: HTMLInputElement;
  private detailsTrigger?: HTMLElement;
  private linksRequest = new LatestRequest();
  private tagsRequest = new LatestRequest();
  private detached = false;
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

  binding() {
    this.hasToken = this.auth.hasToken();
  }

  attached() {
    this.detached = false;
    this.unsubscribe = this.actions.onAction((action) => this.handleAction(action));
    const pending = this.actions.consume();
    if (pending) this.handleAction(pending);
    if (!this.hasToken) {
      this.isLoading = false;
      return;
    }
    void this.loadLinks(1);
    void this.loadTags();
  }

  detaching() {
    this.detached = true;
    this.linksRequest.cancel();
    this.tagsRequest.cancel();
    this.unsubscribe?.();
    this.closeDetails();
    if (this.copyTimeout) window.clearTimeout(this.copyTimeout);
  }

  async loadTags() {
    const isCurrent = this.tagsRequest.start();
    this.tagError = '';
    try {
      const tags = await this.api.listTags();
      if (isCurrent()) this.tags = tags;
    } catch (error) {
      if (isCurrent()) this.tagError = error instanceof Error ? error.message : 'Could not load tags.';
    }
  }

  async loadLinks(page = this.page) {
    const isCurrent = this.linksRequest.start();
    this.isLoading = true;
    this.loadError = '';
    const params = {
      search: this.searchQuery.trim() || undefined,
      status: this.statusFilter,
      tag: this.selectedTag || undefined,
      from: this.dateFrom || undefined,
      to: this.dateTo || undefined,
      per_page: this.perPage,
    };
    try {
      if (this.dateFrom && this.dateTo && this.dateFrom > this.dateTo) {
        throw new Error('The end date must be on or after the start date.');
      }
      let response = await this.api.listLinksPage({ ...params, page });
      if (!isCurrent()) return;
      // Deleting the final item on a page should take the user to the last remaining page.
      if (response.current_page > response.last_page) {
        response = await this.api.listLinksPage({ ...params, page: response.last_page });
      }
      if (!isCurrent()) return;
      this.applyPage(response);
      this.selectedIds = [];
    } catch (err) {
      if (isCurrent()) this.loadError = err instanceof Error ? err.message : 'Failed to load links.';
    } finally {
      if (isCurrent()) this.isLoading = false;
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

  async createLink() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.createError = '';
    this.createdLink = null;
    try {
      const originalUrl = normalizeUrl(this.newUrl);
      const created = await this.api.createLink({
        original_url: originalUrl,
        title: this.newTitle || null,
        password: this.newPassword || null,
      });
      if (this.detached) return;
      this.createdLink = created;
      this.newUrl = '';
      this.newTitle = '';
      this.newPassword = '';
      await this.loadLinks();
    } catch (err) {
      this.createError = err instanceof Error ? err.message : 'Failed to create link.';
    } finally {
      this.isSaving = false;
    }
  }

  shortUrl = shortUrl;

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
    if (!slug) return;
    this.copyError = '';
    try {
      await copyText(this.shortUrl(slug));
      if (this.detached) return;
      this.copiedSlug = slug;
      this.resetCopyState();
    } catch (error) {
      this.copyError = error instanceof Error ? error.message : 'Could not copy the link.';
    }
  }

  private resetCopyState() {
    if (this.copyTimeout) {
      window.clearTimeout(this.copyTimeout);
    }
    this.copyTimeout = window.setTimeout(() => {
      this.copiedSlug = null;
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
    if (this.isImporting) return;
    this.csvInput?.click();
  }

  async handleCsvChange(event: Event) {
    if (this.isImporting) return;
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
      const rows = parseCsv(text);
      const { payloads, skipped } = buildBulkPayload(rows);

      if (!payloads.length) {
        this.importError = 'No valid rows found in the CSV.';
        return;
      }

      const response = await this.api.bulkCreateLinks(payloads);
      const created = response.data ?? [];
      if (this.detached) return;
      await this.loadLinks();
      this.importStatus = `Imported ${created.length} ${created.length === 1 ? 'link' : 'links'}${skipped ? `, skipped ${skipped}` : ''}.`;
    } catch (err) {
      this.importError = err instanceof Error ? err.message : 'Failed to import CSV.';
    } finally {
      this.isImporting = false;
      input.value = '';
    }
  }

  async bulkAction(action: BulkAction) {
    if (this.isBulkUpdating || this.isLoading) return;
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

    this.isBulkUpdating = true;
    try {
      const payload = { action, ids, tag_id: this.bulkTagId || undefined };
      const response = await this.api.bulkActionLinks(payload);
      if (this.detached) return;
      const count = response.affected;
      this.bulkActionStatus = `${count} ${count === 1 ? 'link' : 'links'} ${action === 'delete' ? 'deleted' : 'updated'}.`;
      await this.loadLinks();
    } catch (err) {
      this.bulkActionError = err instanceof Error ? err.message : 'Bulk action failed.';
    } finally {
      this.isBulkUpdating = false;
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
    downloadCsv('slink-links.csv', [header, ...rows]);
  }

  openDetails(link: LinkDto, trigger?: HTMLElement) {
    this.detailsTrigger = trigger;
    this.activeLink = link;
    this.isDrawerOpen = true;
    this.detailsDialog?.showModal();
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
    this.copyError = '';
    if (link.slug) {
      this.generateQr(link.slug);
    }
  }

  closeDetails() {
    const linkId = this.activeLink?.id;
    this.detailsDialog?.close();
    this.isDrawerOpen = false;
    document.body.classList.remove('drawer-open');
    this.activeLink = null;
    this.qrDataUrl = '';
    if (!this.detached && linkId) {
      const trigger = this.detailsTrigger?.isConnected
        ? this.detailsTrigger
        : document.querySelector<HTMLElement>(`[data-link-details="${CSS.escape(linkId)}"]`);
      (trigger ?? this.searchInput)?.focus();
    }
    this.detailsTrigger = undefined;
  }

  onDialogClick(event: MouseEvent) {
    if (event.target === this.detailsDialog) this.closeDetails();
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
    if (!name || this.isCreatingTag) {
      return;
    }
    this.isCreatingTag = true;
    this.detailError = '';
    const linkId = this.activeLink?.id;
    try {
      const created = await this.api.createTag({ name, color: this.newTagColor || null });
      if (this.detached) return;
      this.tags = [created, ...this.tags];
      if (this.activeLink?.id === linkId) {
        this.editTagIds = [...this.editTagIds, created.id];
        this.newTagName = '';
        this.newTagColor = '#c24718';
      }
    } catch (err) {
      if (this.activeLink?.id === linkId) this.detailError = err instanceof Error ? err.message : 'Failed to create tag.';
    } finally {
      this.isCreatingTag = false;
    }
  }

  async saveDetails() {
    if (!this.activeLink || this.isSavingDetails || this.isCreatingTag) {
      return;
    }

    const link = this.activeLink;
    // Disabling the form must not leave keyboard focus on the inert background.
    this.detailsCloseButton?.focus();
    this.isSavingDetails = true;
    this.detailError = '';
    this.detailStatus = '';
    try {
      const originalUrl = normalizeUrl(this.editOriginalUrl);
      const payload: UpdateLinkPayload = {
        title: this.editTitle || null,
        original_url: originalUrl,
        notes: this.editNotes || null,
        expires_at: this.editExpiresAt === this.formatDateInput(link.expires_at ?? '')
          ? link.expires_at ?? null
          : this.editExpiresAt || null,
        max_clicks: parseClickLimit(String(this.editMaxClicks ?? '')),
        is_active: this.editIsActive,
        tags: this.editTagIds,
      };

      if (this.clearPassword) {
        payload.password = '';
      } else if (this.editPassword) {
        payload.password = this.editPassword;
      }

      const updated = await this.api.updateLink(link.id, payload);
      if (this.detached) return;
      if (this.activeLink?.id === link.id) {
        this.activeLink = { ...link, ...updated };
        this.editPassword = '';
        this.clearPassword = false;
        this.detailStatus = 'Changes saved.';
      }
      await this.loadLinks();
    } catch (err) {
      if (this.activeLink?.id === link.id) this.detailError = err instanceof Error ? err.message : 'Failed to save changes.';
    } finally {
      this.isSavingDetails = false;
    }
  }

  async generateQr(slug: string) {
    try {
      const qrDataUrl = await QRCode.toDataURL(this.shortUrl(slug), {
        width: 200,
        margin: 1,
      });
      if (this.activeLink?.slug === slug) this.qrDataUrl = qrDataUrl;
    } catch {
      if (this.activeLink?.slug === slug) this.qrDataUrl = '';
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

  private applyPage(response: LinkPageDto) {
    this.links = response.data;
    this.page = response.current_page;
    this.lastPage = response.last_page;
    this.pageFrom = response.from;
    this.pageTo = response.to;
    this.total = response.total;
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
}
