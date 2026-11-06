import type { Sighting } from '@/core/ledger/types';

// The only way the app reaches the server, on the web now and from a phone app later.

export interface BankConnection {
  id: string;
  provider: string;
  institution: string;
  accounts: { id: string; name: string; mask?: string; type?: string }[];
  status: 'ok' | 'needs_login' | 'error';
  syncedAt: string | null;
}

export interface Connections {
  /** Which bank source this server has, or null when bank connections are off. */
  bank: 'plaid' | 'mock' | null;
  connections: BankConnection[];
  wallet: { connected: boolean; lastTap: string | null };
}

export interface SyncResult {
  id: string;
  institution: string;
  status: BankConnection['status'];
  changed: number;
  notReady: boolean;
}

export interface SightingsPage {
  sightings: Sighting[];
  removed: string[];
  next: number;
  more: boolean;
}

export class ApiProblem extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method: init?.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const data = await response.json().catch(() => null) as { error?: { code: string; message: string } } | null;
  if (!response.ok) throw new ApiProblem(response.status, data?.error?.code ?? 'unknown', data?.error?.message ?? 'Something went wrong. Try again.');
  return data as T;
}

export const api = {
  session: (googleAccessToken?: string) => call<{ household: string }>('/session', { body: googleAccessToken ? { googleAccessToken } : {} }),
  endSession: () => call<{ ok: true }>('/session', { method: 'DELETE' }),
  connections: () => call<Connections>('/connections', { method: 'GET' }),
  linkToken: (relink?: string) => call<{ linkToken: string; mode: 'plaid' | 'mock' }>('/bank/link-token', { body: relink ? { relink } : {} }),
  connectBank: (publicToken: string) => call<SyncResult & { connection: { id: string; institution: string } }>('/bank/connect', { body: { publicToken } }),
  sync: (force = false) => call<{ results: SyncResult[] }>(force ? '/sync?force' : '/sync', { body: {} }),
  sightings: (after: number) => call<SightingsPage>(`/sightings?after=${after}`, { method: 'GET' }),
  disconnect: (id: string) => call<{ ok: true }>(`/connections/${id}`, { method: 'DELETE' }),
  budget: () => call<{ version: number; data: unknown }>('/budget', { method: 'GET' }),
  saveBudget: (version: number, data: unknown) => call<{ version: number }>('/budget', { method: 'PUT', body: { version, data } }),
  checkout: (yearly: boolean) => call<{ url: string }>('/billing/checkout', { body: { yearly } }),
  walletToken: () => call<{ token: string; url: string; link: string }>('/wallet/token', { body: {} }),
};
