export interface CommandResponse {
  success: boolean;
  result: string | null;
  error: string | null;
  executionTimeMs: number;
  timestamp: number;
}

export interface StatsResponse {
  totalKeys: number;
  expiringKeys: number;
  commandsExecuted: number;
  commandsSucceeded: number;
  commandsFailed: number;
  uptimeSeconds: number;
  memoryEstimateBytes: number;
  startedAt: number;
}

export interface KeyEntry {
  key: string;
  value: string;
  type: string;
  ttl: number;
  createdAt: number | null;
  updatedAt: number | null;
  expiresAt: number | null;
}

export interface KeysResponse {
  keys: KeyEntry[];
  total: number;
}

export interface HistoryEntry {
  id: number;
  command: string;
  result: string | null;
  error: string | null;
  success: boolean;
  executionTimeMs: number;
  timestamp: number;
}

export interface HistoryResponse {
  history: HistoryEntry[];
}

export interface HealthResponse {
  status: string;
  engine: string;
  version: string;
  uptime: number;
  tcpPort: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  command: (command: string) =>
    apiFetch<CommandResponse>('/api/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  stats: () => apiFetch<StatsResponse>('/api/stats'),

  keys: (pattern?: string) =>
    apiFetch<KeysResponse>(`/api/keys${pattern && pattern !== '*' ? `?pattern=${encodeURIComponent(pattern)}` : ''}`),

  key: (key: string) =>
    apiFetch<KeyEntry & { ttl: number; type: string }>(`/api/key/${encodeURIComponent(key)}`),

  deleteKey: (key: string) =>
    apiFetch<{ deleted: number }>(`/api/key/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  history: () => apiFetch<HistoryResponse>('/api/history'),

  clearHistory: () => apiFetch<{ cleared: boolean }>('/api/history', { method: 'DELETE' }),

  health: () => apiFetch<HealthResponse>('/api/health'),

  compact: () => apiFetch<{ ok: boolean }>('/api/compact', { method: 'POST' }),
};
