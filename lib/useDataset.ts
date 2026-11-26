'use client';

import useSWR from 'swr';
import type { ApiRows } from './types';

/** Mirrors dash.data(id) from the original: { status, data, message, truncated }. */
export interface DatasetState<T> {
  status: 'idle' | 'loading' | 'ok' | 'error';
  data: T[];
  message?: string;
  truncated?: boolean;
  source?: ApiRows<T>['source'];
  asOf?: string;
  /** Hours only: true when rows are exact time-log records, false when estimated. */
  exact?: boolean;
  refresh: () => void;
}

async function fetcher<T>(url: string): Promise<ApiRows<T>> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (res.status === 401) {
    // Session ended (e.g. signed out in another tab): go to sign-in and come back here afterwards.
    window.location.href = '/signin?callbackUrl=' + encodeURIComponent(window.location.pathname + window.location.hash);
    throw new Error('Signed out');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
  return body as ApiRows<T>;
}

/** Fetch one dataset from our own /api route. Pass null to skip (e.g. no project selected yet). */
export function useDataset<T>(url: string | null): DatasetState<T> {
  const { data, error, mutate } = useSWR<ApiRows<T>>(url, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: false,
  });
  const refresh = () => { void mutate(); };
  if (!url) return { status: 'idle', data: [], refresh };
  if (error) return { status: 'error', data: [], message: error instanceof Error ? error.message : String(error), refresh };
  if (!data) return { status: 'loading', data: [], refresh };
  return { status: 'ok', data: data.rows, truncated: data.truncated, source: data.source, asOf: data.asOf, exact: data.exact, refresh };
}
