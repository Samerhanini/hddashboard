import { NextResponse } from 'next/server';
import type { ApiRows } from '../types';
import { requireSession } from './session';

/**
 * Check the session, run a loader and answer with JSON, cached briefly in the browser (5 minutes)
 * to spare the vendors' rate limits.
 */
export async function rowsResponse<T>(label: string, load: () => Promise<ApiRows<T>>, cacheControl = 'private, max-age=300'): Promise<NextResponse> {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    const data = await load();
    return NextResponse.json(data, { headers: { 'Cache-Control': cacheControl } });
  } catch (err) {
    console.error(`${label} failed`, err);
    return NextResponse.json({ error: `Could not load ${label}.` }, { status: 502 });
  }
}

export function badInput(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
