import { IHttpClient } from '@aurelia/fetch-client';

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

export class ApiService {
  static inject = [IHttpClient];
  private token: string | null = null;

  constructor(private http: IHttpClient) {
    this.http.configure((config) => {
      config
        .withBaseUrl('/api/v1/')
        .withInterceptor({
          request: (request) => {
            request.headers.set('Accept', 'application/json');
            if (this.token) {
              request.headers.set('Authorization', `Bearer ${this.token}`);
            }
            return request;
          },
        });
    });
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async listLinks(params?: LinkListParams): Promise<LinkDto[]> {
    const page = await this.listLinksPage(params);
    return page.data;
  }

  async listLinksPage(params?: LinkListParams): Promise<LinkPageDto> {
    const searchParams = new URLSearchParams();
    if (params?.search) {
      searchParams.set('search', params.search);
    }
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params?.tag) {
      searchParams.set('tag', params.tag);
    }
    if (params?.from) {
      searchParams.set('from', params.from);
    }
    if (params?.to) {
      searchParams.set('to', params.to);
    }
    if (params?.page) {
      searchParams.set('page', String(params.page));
    }
    if (params?.per_page) {
      searchParams.set('per_page', String(params.per_page));
    }
    const url = searchParams.toString() ? `links?${searchParams.toString()}` : 'links';
    const response = await this.http.fetch(url);
    await this.ensureOk(response);
    return response.json();
  }

  async getUserStats(): Promise<UserStatsDto> {
    const response = await this.http.fetch('user/stats');
    await this.ensureOk(response);
    return response.json();
  }

  async getLinkStats(linkId: string): Promise<LinkStatsDto> {
    const response = await this.http.fetch(`links/${linkId}/stats`);
    await this.ensureOk(response);
    return response.json();
  }

  async getAnalytics(params?: {
    query?: string | null;
    from?: string | null;
    to?: string | null;
    include_bots?: boolean;
  }): Promise<AnalyticsResponseDto> {
    const searchParams = new URLSearchParams();
    if (params?.query) {
      searchParams.set('query', params.query);
    }
    if (params?.from) {
      searchParams.set('from', params.from);
    }
    if (params?.to) {
      searchParams.set('to', params.to);
    }
    if (params?.include_bots) {
      searchParams.set('include_bots', 'true');
    }
    const url = searchParams.toString() ? `analytics?${searchParams.toString()}` : 'analytics';
    const response = await this.http.fetch(url);
    await this.ensureOk(response);
    return response.json();
  }

  async createLink(payload: { original_url: string; title?: string | null; password?: string | null }): Promise<LinkDto> {
    const response = await this.http.fetch('links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    await this.ensureOk(response);
    return response.json();
  }

  async updateLink(
    linkId: string,
    payload: {
      title?: string | null;
      original_url?: string | null;
      notes?: string | null;
      password?: string | null;
      expires_at?: string | null;
      max_clicks?: number | null;
      is_active?: boolean;
      tags?: string[];
    },
  ): Promise<LinkDto> {
    const response = await this.http.fetch(`links/${linkId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    await this.ensureOk(response);
    return response.json();
  }

  async bulkActionLinks(payload: { action: string; ids: string[]; tag_id?: string }): Promise<{ affected?: number }> {
    const response = await this.http.fetch('links/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    await this.ensureOk(response);
    return response.json();
  }

  async bulkCreateLinks(
    links: Array<{
      original_url: string;
      slug?: string | null;
      title?: string | null;
      expires_at?: string | null;
      max_clicks?: number | null;
    }>,
  ): Promise<{ data: LinkDto[] }> {
    const response = await this.http.fetch('links/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ links }),
    });
    await this.ensureOk(response);
    return response.json();
  }

  async getProfile() {
    const response = await this.http.fetch('user');
    await this.ensureOk(response);
    return response.json();
  }

  async listTags(): Promise<TagDto[]> {
    const response = await this.http.fetch('tags');
    await this.ensureOk(response);
    const payload = await response.json();
    return payload.data ?? payload;
  }

  async createTag(payload: { name: string; color?: string | null }): Promise<TagDto> {
    const response = await this.http.fetch('tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    await this.ensureOk(response);
    return response.json();
  }

  async getQueueHealth(): Promise<QueueHealthDto> {
    const response = await this.http.fetch('health/queue');
    await this.ensureOk(response);
    return response.json();
  }

  async listAuditLogs(params?: {
    action?: string;
    subject_type?: string;
    subject_id?: string;
    from?: string;
    to?: string;
    per_page?: number;
  }): Promise<AuditLogDto[]> {
    const searchParams = new URLSearchParams();
    if (params?.action) {
      searchParams.set('action', params.action);
    }
    if (params?.subject_type) {
      searchParams.set('subject_type', params.subject_type);
    }
    if (params?.subject_id) {
      searchParams.set('subject_id', params.subject_id);
    }
    if (params?.from) {
      searchParams.set('from', params.from);
    }
    if (params?.to) {
      searchParams.set('to', params.to);
    }
    if (params?.per_page) {
      searchParams.set('per_page', String(params.per_page));
    }
    const url = searchParams.toString() ? `audit-logs?${searchParams.toString()}` : 'audit-logs';
    const response = await this.http.fetch(url);
    await this.ensureOk(response);
    const payload = await response.json();
    return payload.data ?? payload;
  }

  private async ensureOk(response: Response) {
    if (!response.ok) {
      const body = await response.text();
      let message = body || `Request failed (${response.status})`;

      if (body) {
        try {
          const payload = JSON.parse(body) as {
            message?: string;
            errors?: Record<string, string[]>;
          };
          const validationMessage = payload.errors
            ? Object.values(payload.errors).flat().find(Boolean)
            : null;
          message = validationMessage || payload.message || message;
        } catch {
          // Keep the plain-text response.
        }
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
  }
}
