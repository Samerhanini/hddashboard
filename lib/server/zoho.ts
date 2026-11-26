import { hasEnv } from './env';

// Zoho OAuth (Self Client refresh-token flow) shared by Zoho Projects and Zoho CRM.
// Env: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_DC (com by default), ZOHO_PORTAL_ID.

export const zohoReady = () => hasEnv('ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN');

// Data centre -> domain suffix used by accounts.zoho.<x> and projectsapi.zoho.<x>.
const DC: Record<string, { accounts: string; projects: string }> = {
  com: { accounts: 'https://accounts.zoho.com', projects: 'https://projectsapi.zoho.com' },
  eu: { accounts: 'https://accounts.zoho.eu', projects: 'https://projectsapi.zoho.eu' },
  in: { accounts: 'https://accounts.zoho.in', projects: 'https://projectsapi.zoho.in' },
  'com.au': { accounts: 'https://accounts.zoho.com.au', projects: 'https://projectsapi.zoho.com.au' },
  jp: { accounts: 'https://accounts.zoho.jp', projects: 'https://projectsapi.zoho.jp' },
  ca: { accounts: 'https://accounts.zohocloud.ca', projects: 'https://projectsapi.zohocloud.ca' },
  sa: { accounts: 'https://accounts.zoho.sa', projects: 'https://projectsapi.zoho.sa' },
};
function dc() {
  const key = (process.env.ZOHO_DC || 'com').trim().toLowerCase();
  const d = DC[key];
  if (!d) throw new Error(`Unknown ZOHO_DC "${key}". Use one of: ${Object.keys(DC).join(', ')}.`);
  // Optional overrides, only needed to test against a stand-in Zoho server.
  return { accounts: process.env.ZOHO_ACCOUNTS_URL || d.accounts, projects: process.env.ZOHO_PROJECTS_URL || d.projects };
}

export function portalId(): string {
  const id = (process.env.ZOHO_PORTAL_ID || '854982967').trim();
  if (!/^[0-9]{1,25}$/.test(id)) throw new Error('ZOHO_PORTAL_ID must be digits only.');
  return id;
}

/** Zoho Projects V3 base URL for our portal. */
export const projectsBase = () => `${dc().projects}/api/v3/portal/${portalId()}`;

interface Token { value: string; expiresAt: number; apiDomain: string }
let token: Token | null = null;
let refreshing: Promise<Token> | null = null;

async function refresh(): Promise<Token> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID!.trim(),
    client_secret: process.env.ZOHO_CLIENT_SECRET!.trim(),
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!.trim(),
  });
  const res = await fetch(`${dc().accounts}/oauth/v2/token`, { method: 'POST', body, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; api_domain?: string; error?: string };
  // Never log the response itself: on success it contains the access token.
  if (!res.ok || !json.access_token) throw new Error(`Zoho token refresh failed (${res.status}${json.error ? ': ' + json.error : ''}).`);
  return {
    value: json.access_token,
    // Renew five minutes early.
    expiresAt: Date.now() + Math.max(60, (json.expires_in || 3600) - 300) * 1000,
    apiDomain: json.api_domain || 'https://www.zohoapis.com',
  };
}

async function getToken(force = false): Promise<Token> {
  if (!force && token && Date.now() < token.expiresAt) return token;
  refreshing ??= refresh().finally(() => { refreshing = null; });
  token = await refreshing;
  return token;
}

/** API domain for Zoho CRM etc., as reported by the token endpoint (e.g. https://www.zohoapis.com). */
export async function zohoApiDomain(): Promise<string> {
  return (await getToken()).apiDomain;
}

type Params = Record<string, string | number | undefined>;

/** GET a Zoho API URL as JSON, renewing the access token once if Zoho says it expired. 204 -> {}. */
export async function zohoGet<T = unknown>(url: string, params: Params = {}): Promise<T> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 2; attempt++) {
    const t = await getToken(attempt > 0);
    const res = await fetch(u, { headers: { Authorization: `Zoho-oauthtoken ${t.value}`, Accept: 'application/json' }, cache: 'no-store' });
    if (res.status === 401 && attempt === 0) continue;
    if (res.status === 204) return {} as T;
    const text = await res.text();
    if (!res.ok) throw new Error(`Zoho ${res.status} for ${u.pathname}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }
  throw new Error(`Zoho refused the request for ${u.pathname} after renewing the token.`);
}

/** Run async jobs with at most `limit` in flight (keeps us under Zoho's per-minute limits). */
export async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
