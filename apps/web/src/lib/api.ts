import { CaseSummary, LedgerEvent, VerificationResult, Checkpoint, ApiKeyMeta, User } from '../types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem('dt_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('dt_token', token);
  } else {
    localStorage.removeItem('dt_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = body.error || {};
    throw new ApiError(
      err.code || 'UNKNOWN_ERROR',
      err.message || `Request failed with status ${response.status}`,
      response.status,
      err.details
    );
  }

  return body.data !== undefined ? body.data : body;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe(): Promise<User> {
    return request<User>('/auth/me');
  },

  logout(): void {
    setStoredToken(null);
  },

  // Cases
  async getCases(params: {
    page?: number;
    limit?: number;
    status?: string;
    caseType?: string;
    search?: string;
  } = {}): Promise<{ data: CaseSummary[]; pagination: { total: number; page: number; totalPages: number } }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.status) query.set('status', params.status);
    if (params.caseType) query.set('caseType', params.caseType);
    if (params.search) query.set('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    // Note: request returns body.data or whole body. In case.routes: res.json({ data: cases, pagination })
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}/cases${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new ApiError(body.error?.code || 'ERROR', body.error?.message || 'Error', res.status);
    }
    return { data: body.data, pagination: body.pagination };
  },

  async getCase(caseId: string): Promise<CaseSummary> {
    return request<CaseSummary>(`/cases/${encodeURIComponent(caseId)}`);
  },

  async getCaseEvents(caseId: string): Promise<LedgerEvent[]> {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/events?limit=100`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new ApiError(body.error?.code || 'ERROR', body.error?.message || 'Error', res.status);
    }
    return body.data;
  },

  // Verification
  async verifyCase(caseId: string): Promise<VerificationResult> {
    return request<VerificationResult>(`/cases/${encodeURIComponent(caseId)}/verify`, {
      method: 'POST',
    });
  },

  // Checkpoints
  async getCaseCheckpoints(caseId: string): Promise<Checkpoint[]> {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/checkpoints`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new ApiError(body.error?.code || 'ERROR', body.error?.message || 'Error', res.status);
    }
    return body.data;
  },

  // API Keys
  async getApiKeys(): Promise<ApiKeyMeta[]> {
    return request<ApiKeyMeta[]>('/auth/api-keys');
  },

  async createApiKey(sourceSystem: string): Promise<{ rawKey: string; apiKey: ApiKeyMeta }> {
    return request<{ rawKey: string; apiKey: ApiKeyMeta }>('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ sourceSystem }),
    });
  },

  async revokeApiKey(keyId: string): Promise<void> {
    await request(`/auth/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
    });
  },
};
