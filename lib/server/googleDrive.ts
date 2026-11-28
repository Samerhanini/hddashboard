import type { ApiRows, MeetingRow } from '../types';
import { cached } from './cache';
import { googleAccessToken, googleReady } from './googleAuth';

// Live Gemini meeting notes from Google Drive (stage 5).
//
// Reads docs titled "... - Notes by Gemini" that the dashboard service
// account can see (the "Google Meet" folder in Samer's Drive is shared
// with it as a viewer). Notes owned by other people are only visible if
// they are shared with the service account — or, with domain-wide
// delegation (GOOGLE_IMPERSONATE_USER), everything Samer can see.
// A note the account cannot open is skipped and counted in the server
// log, never silently replaced with sample data.

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DOCS_API = 'https://docs.googleapis.com/v1/documents';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly'];
const MAX_FILES = 300;
const MAX_ROWS = 50;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  owners?: { displayName?: string; emailAddress?: string }[];
  webViewLink?: string;
  shortcutDetails?: { targetId?: string; targetMimeType?: string };
  modifiedTime?: string;
}

interface DocParagraph {
  paragraph?: {
    paragraphStyle?: { namedStyleType?: string };
    bullet?: unknown;
    elements?: { textRun?: { content?: string } }[];
  };
}

const paraText = (p: DocParagraph): string =>
  (p.paragraph?.elements || []).map((e) => e.textRun?.content || '').join('').replace(/\n/g, ' ').trim();
const paraStyle = (p: DocParagraph): string => p.paragraph?.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
const isBullet = (p: DocParagraph): boolean => !!p.paragraph?.bullet;

const SKIP_TEXT = [/^please rate the new quick notes tab/i, /^want to see more\?/i, /^you should review gemini's notes/i];

/** Meeting name and date from a "Title - 2026/11/25 10:57 EST - Notes by Gemini" title. */
function parseTitle(name: string, modifiedTime?: string): { meeting: string; date: string | null } {
  const m = name.match(/^(.*?)\s+-\s+(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?:\s+([A-Za-z]+(?:[+-]\d{2}:\d{2})?))?\s+-\s+Notes by Gemini\s*$/);
  if (m) {
    const [, title, y, mo, d, h, mi, tz] = m;
    let offset = '-05:00';
    if (tz) {
      const g = tz.match(/^GMT([+-]\d{2}):(\d{2})$/);
      if (g) offset = `${g[1]}:${g[2]}`;
      else if (/^EDT$/i.test(tz)) offset = '-04:00';
      else if (/^EST$/i.test(tz)) offset = '-05:00';
    }
    const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:00${offset}`);
    return { meeting: title.trim(), date: isNaN(dt.getTime()) ? modifiedTime || null : dt.toISOString() };
  }
  const meeting = name.replace(/\s+-\s+Notes by Gemini\s*$/, '').trim();
  return { meeting, date: modifiedTime || null };
}

/** Summary + next steps from a Gemini notes doc body. */
function parseDoc(paragraphs: DocParagraph[]): { summary: string; nextSteps: string } {
  let summary = '';
  let nextSteps: string[] = [];
  let afterTitle = false;
  let inNextSteps = false;
  let person = '';
  for (const p of paragraphs) {
    const text = paraText(p);
    if (!text || SKIP_TEXT.some((re) => re.test(text))) continue;
    const style = paraStyle(p);
    if (style === 'HEADING_1' || style === 'HEADING_2') { afterTitle = true; continue; }
    if (style === 'SUBTITLE' && /^next steps$/i.test(text)) { inNextSteps = true; person = ''; continue; }
    if (inNextSteps) {
      if (style === 'SUBTITLE') { person = text; continue; }
      if (isBullet(p)) {
        nextSteps.push(person && !/^unassigned$/i.test(person) ? `${person}: ${text}` : text);
      }
      continue;
    }
    if (afterTitle && !summary && style === 'NORMAL_TEXT') summary = text;
  }
  return { summary, nextSteps: nextSteps.join('\n') };
}

async function driveGet(path: string): Promise<Record<string, unknown>> {
  const token = await googleAccessToken(SCOPES);
  const res = await fetch(`${DRIVE_API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.error as { message?: string } | undefined)?.message || `Google Drive request failed (${res.status}).`;
    throw new Error(msg);
  }
  return body;
}

async function docsGet(docId: string): Promise<DocParagraph[]> {
  const token = await googleAccessToken(SCOPES);
  const res = await fetch(`${DOCS_API}/${encodeURIComponent(docId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not open meeting note ${docId} (${res.status}).`);
  const body = (await res.json().catch(() => ({}))) as { body?: { content?: DocParagraph[] } };
  return body.body?.content || [];
}

/** All "Notes by Gemini" files the service account can see, newest first. */
async function listNoteFiles(): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  const q = encodeURIComponent(`name contains 'Notes by Gemini' and trashed = false`);
  do {
    const page = await driveGet(
      `/files?q=${q}&fields=files(id,name,mimeType,owners,webViewLink,shortcutDetails,modifiedTime),nextPageToken&orderBy=modifiedTime desc&pageSize=100` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''),
    );
    const files = (page.files as DriveFile[] | undefined) || [];
    out.push(...files);
    pageToken = typeof page.nextPageToken === 'string' ? page.nextPageToken : undefined;
  } while (pageToken && out.length < MAX_FILES);
  return out.slice(0, MAX_FILES);
}

/** Gemini notes whose title contains the building key, newest first (50 max, like the original). */
export async function loadLiveMeetings(bldg: string): Promise<ApiRows<MeetingRow>> {
  if (!googleReady()) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set; the dashboard service account must be connected to load live meeting notes.');
  }
  const b = bldg.toLowerCase();
  return cached(`meetings:${b}`, async () => {
    const files = await listNoteFiles();
    // A doc and its shortcut both appear; keep the real doc entry (its
    // owner and link are the note's own). A shortcut with no doc entry is
    // a note owned by someone else — use its target id.
    const byId = new Map<string, DriveFile>();
    for (const f of files) {
      if (f.mimeType !== 'application/vnd.google-apps.shortcut' && !byId.has(f.id)) byId.set(f.id, f);
    }
    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.shortcut') {
        const target = f.shortcutDetails?.targetId;
        if (target && !byId.has(target)) byId.set(target, { ...f, id: target });
      }
    }
    const candidates = [...byId.values()].filter((f) => f.name.toLowerCase().includes(b));
    const rows: MeetingRow[] = [];
    let skipped = 0;
    for (const f of candidates) {
      if (rows.length >= MAX_ROWS) break;
      let paragraphs: DocParagraph[];
      try {
        paragraphs = await docsGet(f.id);
      } catch (err) {
        skipped += 1;
        console.warn(`Meetings: skipping unreadable note "${f.name}"`, err instanceof Error ? err.message : err);
        continue;
      }
      const { meeting, date } = parseTitle(f.name, f.modifiedTime);
      const { summary, nextSteps } = parseDoc(paragraphs);
      const owner = f.owners?.[0]?.displayName || f.owners?.[0]?.emailAddress || '';
      rows.push({
        id: f.id,
        meeting,
        date,
        summary,
        next_steps: nextSteps,
        url: f.webViewLink && f.mimeType !== 'application/vnd.google-apps.shortcut'
          ? f.webViewLink
          : `https://docs.google.com/document/d/${f.id}/edit`,
        owner,
      });
    }
    if (skipped) console.warn(`Meetings: ${skipped} note(s) for "${bldg}" could not be opened by the dashboard account.`);
    rows.sort((a, c) => Date.parse(c.date || '') - Date.parse(a.date || ''));
    return { rows: rows.slice(0, MAX_ROWS), truncated: candidates.length > MAX_ROWS, source: 'live' as const };
  });
}
