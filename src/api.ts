import type { ClientSummary, DashboardResponse } from './types';

const API_BASE = (import.meta.env.VITE_AI_HUB_API_BASE || '').replace(/\/+$/, '');
const TOKEN_KEY = 'clientPanelToken';

export function storedToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(siteId: string, password: string): Promise<ClientSummary> {
  const response = await request<{ token: string; client: ClientSummary }>('/v1/client-panel/login', {
    method: 'POST',
    body: JSON.stringify({ site_id: siteId, password }),
  });
  localStorage.setItem(TOKEN_KEY, response.token);
  return response.client;
}

export async function dashboard(range: string): Promise<DashboardResponse> {
  return request<DashboardResponse>(`/v1/client-panel/dashboard?range=${encodeURIComponent(range)}`);
}

export async function updateSessionLimit(sessionTokenLimit: number): Promise<ClientSummary> {
  const response = await request<{ client: ClientSummary }>('/v1/client-panel/token-policy', {
    method: 'PATCH',
    body: JSON.stringify({ session_token_limit: sessionTokenLimit }),
  });
  return response.client;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  const token = storedToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    return body.detail || `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}
