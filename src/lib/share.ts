import type { FinancialProfile, CustomFund, PathfinderResult } from './types';
import { DEFAULT_PROFILE } from './defaults';

const PARAM = 's';
const VERSION = 1;

export interface ShareState {
  v: number;
  profile: FinancialProfile;
  customFunds: CustomFund[];
  event?: string;
  result?: PathfinderResult;
}

function toBase64Url(str: string): string {
  if (typeof window === 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64url');
  }
  // btoa needs latin1; encode to bytes first
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  if (typeof window === 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf-8');
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShareState(state: Omit<ShareState, 'v'>): string {
  const payload: ShareState = { v: VERSION, ...state };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeShareState(encoded: string): ShareState | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed = JSON.parse(json) as ShareState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== VERSION) return null;
    if (!parsed.profile || typeof parsed.profile !== 'object') return null;
    return {
      v: VERSION,
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      customFunds: Array.isArray(parsed.customFunds) ? parsed.customFunds : [],
      event: typeof parsed.event === 'string' ? parsed.event : undefined,
      result: parsed.result,
    };
  } catch {
    return null;
  }
}

export function readShareStateFromUrl(): ShareState | null {
  if (typeof window === 'undefined') return null;
  // Older links carried the state in the query string
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get(PARAM)
    ?? new URLSearchParams(window.location.search).get(PARAM);
  if (!encoded) return null;
  return decodeShareState(encoded);
}

export function writeShareStateToUrl(state: Omit<ShareState, 'v'>): string {
  const encoded = encodeShareState(state);
  if (typeof window === 'undefined') return encoded;
  // The hash never reaches a server, so someone's numbers stay out of request logs
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  url.hash = `${PARAM}=${encoded}`;
  window.history.replaceState({}, '', url.toString());
  return url.toString();
}

export function clearShareStateFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  url.hash = '';
  window.history.replaceState({}, '', url.toString());
}
