import { createSign } from 'node:crypto';
import { hasEnv } from './env';

// Google Sheets API with a service account, using only Node's built-in crypto
// and fetch (no extra dependency). The JSON key lives in
// GOOGLE_SERVICE_ACCOUNT_JSON (see .env.example); the sheet must be shared
// with the service account's client_email. Nothing secret is ever logged.

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DEFAULT_SPREADSHEET_ID = '1h-64cziAfN6mlFV0nv_2m_DoNnB2BoUqiKVobIkWqQI';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export const sheetsReady = () => hasEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
export const rosterSpreadsheetId = () => (process.env.ROSTER_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID).trim();
export const rosterTab = () => (process.env.ROSTER_SHEET_TAB || 'Roster').trim();
export const rosterTabId = () => {
  const n = parseInt(process.env.ROSTER_SHEET_TAB_ID || '401964840', 10);
  return isNaN(n) ? 401964840 : n;
};

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

/** Signed JWT for the service account (what google.auth.JWT does). Exported for tests. */
export function createServiceAccountJwt(key: ServiceAccountKey, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: key.client_email,
    scope: SHEETS_SCOPE,
    aud: key.token_uri || DEFAULT_TOKEN_URI,
    exp: iat + 3600,
    iat,
  };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign('RSA-SHA256').update(input).end().sign(key.private_key);
  return `${input}.${b64url(sig)}`;
}

let tokenCache: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  const key = serviceAccountKey();
  const tokenUri = key.token_uri || DEFAULT_TOKEN_URI;
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: createServiceAccountJwt(key),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof body.access_token !== 'string') {
    throw new Error(`Google token exchange failed (${res.status}).`);
  }
  const ttl = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  tokenCache = { token: body.access_token, exp: Date.now() + ttl * 1000 };
  return tokenCache.token;
}

async function sheetsFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const res = await fetch(`${SHEETS_API}/${rosterSpreadsheetId()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.error as { message?: string } | undefined)?.message || `Google Sheets request failed (${res.status}).`;
    throw new Error(msg);
  }
  return body;
}

/** Values of a range as rows of cell strings (missing cells are ''). */
export async function sheetsValuesGet(range: string): Promise<unknown[][]> {
  const body = await sheetsFetch(`/values/${encodeURIComponent(range)}`);
  const values = body.values;
  if (!Array.isArray(values)) return [];
  return values.map((r) => (Array.isArray(r) ? r : []));
}

/** Write values with USER_ENTERED, so a leading apostrophe from cellVal() stays a text marker. */
export async function sheetsValuesUpdate(range: string, values: unknown[][]): Promise<void> {
  await sheetsFetch(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
}

export async function sheetsValuesAppend(range: string, values: unknown[][]): Promise<void> {
  await sheetsFetch(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  });
}

/** Delete one sheet row (1-based, header is row 1) via deleteDimension. */
export async function sheetsDeleteRow(sheetRow: number): Promise<void> {
  await sheetsFetch(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId: rosterTabId(), dimension: 'ROWS', startIndex: sheetRow - 1, endIndex: sheetRow },
          },
        },
      ],
    }),
  });
}
