import { IHttpClient } from '@aurelia/fetch-client';
import { AuthService } from './auth';

export interface LinkDto {
  id: string;
  title: string | null;
  notes?: string | null;
  slug: string;
  original_url: string;
  has_password?: boolean;
  clicks_count?: number;
  tags?: Array<{ id: string; name: string; color: string }>;
  is_active?: boolean;
  health_status?: string | null;
  http_status?: number | null;
  last_checked_at?: string | null;
  last_error?: string | null;
  expires_at?: string | null;
  max_clicks?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserStatsDto {
  links: number;
  clicks: number;
  tags: number;
}

export interface LinkStatsDto {
  total: number;
  by_country: Array<{ country: string; total: number }>;
  by_device: Array<{ device_type: string; total: number }>;
  by_browser: Array<{ browser: string; total: number }>;
  by_referrer: Array<{ referer: string; total: number }>;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
}

export interface QueueHealthDto {
  status: string;
  connection: string;
  pending: number | null;
  failed: number | null;
  checked_at: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AnalyticsScopeDto {
  query: string | null;
  mode: 'global' | 'filtered';
  matched_links: number;
}

export interface AnalyticsRangeDto {
  from: string;
  to: string;
  granularity: 'day' | 'hour';
  include_bots: boolean;
}

export interface AnalyticsSeriesPoint {
  label: string;
  total: number;
}

export interface AnalyticsResponseDto {
  scope: AnalyticsScopeDto;
  range: AnalyticsRangeDto;
  series: AnalyticsSeriesPoint[];
  stats: LinkStatsDto;
}

export interface LinkListParams {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  tag?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface LinkPageDto {
  data: LinkDto[];
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface BulkLinkPayload {
  original_url: string;
  title?: string | null;
  expires_at?: string | null;
  max_clicks?: number | null;
}

export interface CreateLinkPayload extends BulkLinkPayload {
  notes?: string | null;
  password?: string | null;
  is_active?: boolean;
  tags?: string[];
}

export type UpdateLinkPayload = Partial<CreateLinkPayload>;
export type BulkAction = 'activate' | 'deactivate' | 'delete' | 'tag' | 'untag';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export class ApiService {
  static inject = [IHttpClient, AuthService];

  constructor(private http: IHttpClient, auth: AuthService) {
    this.http.configure((config) => {
      config.withBaseUrl('/api/v1/').withInterceptor({
        request: (request) => {
          request.headers.set('Accept', 'application/json');
          const token = auth.getToken();
          if (token) request.headers.set('Authorization', `Bearer ${token}`);
          else request.headers.delete('Authorization');
          return request;
        },
      });
    });
  }

  async listLinks(params?: LinkListParams): Promise<LinkDto[]> {
    return (await this.listLinksPage(params)).data;
  }

  listLinksPage(params?: LinkListParams): Promise<LinkPageDto> {
    return this.request(this.queryPath('links', {
      ...params,
      status: params?.status === 'all' ? undefined : params?.status,
    }));
  }

  getUserStats(): Promise<UserStatsDto> {
    return this.request('user/stats');
  }

  getLinkStats(linkId: string): Promise<LinkStatsDto> {
    return this.request(`links/${linkId}/stats`);
  }

  getAnalytics(params?: {
    query?: string | null;
    from?: string | null;
    to?: string | null;
    include_bots?: boolean;
  }): Promise<AnalyticsResponseDto> {
    return this.request(this.queryPath('analytics', params));
  }

  createLink(payload: CreateLinkPayload): Promise<LinkDto> {
    return this.sendJson('links', 'POST', payload);
  }

  updateLink(linkId: string, payload: UpdateLinkPayload): Promise<LinkDto> {
    return this.sendJson(`links/${linkId}`, 'PATCH', payload);
  }

  bulkActionLinks(payload: { action: BulkAction; ids: string[]; tag_id?: string }): Promise<{ affected: number }> {
    return this.sendJson('links/actions', 'POST', payload);
  }

  bulkCreateLinks(links: BulkLinkPayload[]): Promise<{ data: LinkDto[] }> {
    return this.sendJson('links/bulk', 'POST', { links });
  }

  getProfile(): Promise<{ id: string; name: string; email: string }> {
    return this.request('user');
  }

  async listTags(): Promise<TagDto[]> {
    const payload = await this.request<{ data: TagDto[] } | TagDto[]>('tags');
    return Array.isArray(payload) ? payload : payload.data;
  }

  createTag(payload: { name: string; color?: string | null }): Promise<TagDto> {
    return this.sendJson('tags', 'POST', payload);
  }

  getQueueHealth(): Promise<QueueHealthDto> {
    return this.request('health/queue');
  }

  async listAuditLogs(params?: {
    action?: string;
    subject_type?: string;
    subject_id?: string;
    from?: string;
    to?: string;
    per_page?: number;
  }): Promise<AuditLogDto[]> {
    const payload = await this.request<{ data: AuditLogDto[] } | AuditLogDto[]>(this.queryPath('audit-logs', params));
    return Array.isArray(payload) ? payload : payload.data;
  }

  private queryPath(path: string, params?: QueryParams): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    }
    return query.size ? `${path}?${query}` : path;
  }

  private sendJson<T>(path: string, method: 'POST' | 'PATCH', payload: unknown): Promise<T> {
    return this.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await this.http.fetch(path, options);
    if (!response.ok) {
      const fallback = `Request failed (${response.status}). Please try again.`;
      let message = fallback;
      const body = await response.text();
      try {
        const payload = JSON.parse(body);
        const validation = payload?.errors && typeof payload.errors === 'object'
          ? Object.values(payload.errors).flat().find((value) => typeof value === 'string' && value)
          : null;
        message = typeof validation === 'string'
          ? validation
          : typeof payload?.message === 'string' ? payload.message : fallback;
      } catch {
        const isHtml = response.headers.get('Content-Type')?.includes('html') || body.trimStart().startsWith('<');
        if (!isHtml && body && body.length <= 500) message = body;
      }
      if (response.status === 401) {
        message = message.toLowerCase().includes('expired')
          ? 'This API token has expired. Add a new token in Settings.'
          : 'This API token is missing or invalid. Check it in Settings.';
      } else if (response.status === 403) {
        message = 'This API token does not have permission for that action.';
      }
      throw new ApiError(response.status, message);
    }
    return response.json() as Promise<T>;
  }
}
