import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Second line of defence behind proxy.ts: every API route checks the session itself, so a
 * matcher mistake in proxy.ts can never expose data. Returns a 401 response when signed out.
 */
export async function requireSession(): Promise<NextResponse | null> {
  const session = await auth();
  if (session?.user?.email) return null;
  return NextResponse.json({ error: 'Your session has ended. Reload the page to sign in again.' }, { status: 401 });
}
