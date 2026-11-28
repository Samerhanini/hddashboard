import { createSign } from 'node:crypto';
import { hasEnv } from './env';

// Service-account auth for Google APIs other than Sheets (Drive, Docs).
// Same JSON key as the roster (GOOGLE_SERVICE_ACCOUNT_JSON); the key file
// itself is never logged. Kept separate from googleSheets.ts so the live
// roster auth is untouched.
//
// Scopes are requested per call. When GOOGLE_IMPERSONATE_USER is set (an
// email), the JWT carries a `sub` claim for domain-wide delegation — the
// service account then acts as that user. That needs the Workspace admin to
// authorize this service account's client ID for the requested scopes;
// without it, the account only sees files shared directly with it.

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export const googleReady = () => hasEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
/** Email the service account impersonates via domain-wide delegation, if configured. */
export const impersonateUser = () => (process.env.GOOGLE_IMPERSONATE_USER || '').trim() || null;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let keyCache: ServiceAccountKey | null = null;
function serviceAccountKey(): ServiceAccountKey {
  if (keyCache) return keyCache;
  let parsed: unknown;
  try {
    parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '');
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  const k = parsed as Partial<ServiceAccountKey>;
  if (typeof k.client_email !== 'string' || !k.client_email || typeof k.private_key !== 'string' || !k.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.');
  }
  keyCache = { client_email: k.client_email, private_key: k.private_key, token_uri: k.token_uri };
  return keyCache;
}

const b64url = (v: Buffer | string): string =>
  Buffer.from(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function createJwt(key: ServiceAccountKey, scope: string, sub: string | null, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims: Record<string, unknown> = {
    iss: key.client_email,
    scope,
    aud: key.token_uri || DEFAULT_TOKEN_URI,
    exp: iat + 3600,
    iat,
  };
  if (sub) claims.sub = sub;
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign('RSA-SHA256').update(input).end().sign(key.private_key);
  return `${input}.${b64url(sig)}`;
}

const tokenCache = new Map<string, { token: string; exp: number }>();

/** Access token for the given Google API scopes (space-joined in the JWT). */
export async function googleAccessToken(scopes: string[]): Promise<string> {
  const sub = impersonateUser();
  const scope = [...scopes].sort().join(' ');
  const cacheKey = scope + '|' + (sub || '');
  const hit = tokenCache.get(cacheKey);
  if (hit && Date.now() < hit.exp - 60_000) return hit.token;
  const key = serviceAccountKey();
  const tokenUri = key.token_uri || DEFAULT_TOKEN_URI;
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createJwt(key, scope, sub),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.access_token !== 'string') {
    throw new Error(`Google token exchange failed (${res.status}).`);
  }
  const ttl = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  tokenCache.set(cacheKey, { token: body.access_token, exp: Date.now() + ttl * 1000 });
  return body.access_token;
}
