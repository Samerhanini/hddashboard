import type { ApiRows, RosterRow } from '../types';
import { SAMPLE_ROSTER_HEADER, sampleRoster } from '../fixtures/people';
import { bust, cached } from './cache';
import {
  rosterSpreadsheetId,
  rosterTab,
  sheetsDeleteRow,
  sheetsReady,
  sheetsValuesAppend,
  sheetsValuesGet,
  sheetsValuesUpdate,
} from './googleSheets';
import { parseRosterValues } from './parse/sheets';

// Roster tab of the Project Team Roster sheet: read, edit cells, append a row, delete a row.
// Live Google Sheets calls (service account, see lib/server/googleSheets.ts) once
// GOOGLE_SERVICE_ACCOUNT_JSON is set; an in-memory sample roster until then
// (it resets when the dev server restarts).

/** Fields the page may write, keyed as in the projectRoster loader's colmap. */
export const WRITABLE_FIELDS = ['role', 'level', 'firm', 'contact', 'contact_email', 'crm_id', 'phone'] as const;
export type WritableField = (typeof WRITABLE_FIELDS)[number];

export class RosterConflict extends Error {}

let store: RosterRow[] | null = null;
const sample = () => (store ??= sampleRoster());

/** Rebuild sheet row numbers after a delete, as the sheet itself would. */
function renumber() { sample().forEach((r, i) => { r.sheet_row = i + 2; }); }

const CACHE_KEY = `sheets:${rosterSpreadsheetId()}:roster`;

/** Fresh read of the live Roster tab (bypasses the 5-minute cache; writes check against this). */
async function readLiveRows(): Promise<RosterRow[]> {
  const values = await sheetsValuesGet(`${rosterTab()}!A1:K1000`);
  return parseRosterValues(values);
}

export async function loadRoster(): Promise<ApiRows<RosterRow>> {
  if (!sheetsReady()) return { rows: sample().map((r) => ({ ...r })), source: 'sample' };
  return cached(CACHE_KEY, async () => ({ rows: await readLiveRows(), source: 'live' as const }));
}

/**
 * The row the page is changing must still be the one it saw: same Row ID and Project at that sheet row.
 * This is the original's safety check before deleting (ptRemoveRow), applied to edits too.
 */
function checkRow(rows: RosterRow[], sheetRow: number, id: string, project: string): RosterRow {
  const r = rows.find((x) => x.sheet_row === sheetRow);
  if (!r || r.id !== id || r.project !== project) throw new RosterConflict('The sheet changed since this page loaded.');
  return r;
}

/** ptCellVal: prefix values Sheets would treat as formulas or numbers with an apostrophe. */
export function cellVal(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /^[=+\-@0-9]/.test(s) ? "'" + s : s;
}

const colIndex = (letter: string): number =>
  letter.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

export async function writeCells(sheetRow: number, id: string, project: string, values: Partial<Record<WritableField, string>>) {
  if (!sheetsReady()) {
    const r = checkRow(sample(), sheetRow, id, project);
    // The sample store keeps plain values; the live sheet stores cellVal(v) so it isn't parsed as a formula.
    for (const [k, v] of Object.entries(values)) (r as unknown as Record<string, string>)[k] = String(v ?? '');
    return;
  }
  const row = checkRow(await readLiveRows(), sheetRow, id, project);
  const cm = JSON.parse(row.colmap || '{}') as Record<string, string>;
  const cells = Object.entries(values)
    .filter(([k]) => cm[k])
    .map(([k, v]) => [cm[k], colIndex(cm[k]), cellVal(v)] as [string, number, string])
    .sort((a, b) => a[1] - b[1]);
  if (!cells.length) throw new Error('The roster sheet is missing those columns.');
  // One update when the cells are contiguous, one per cell otherwise (as in the original ptWriteCells).
  const tab = rosterTab();
  const contiguous = cells.every((c, i) => i === 0 || c[1] === cells[i - 1][1] + 1);
  if (contiguous) {
    await sheetsValuesUpdate(`${tab}!${cells[0][0]}${sheetRow}:${cells[cells.length - 1][0]}${sheetRow}`, [cells.map((c) => c[2])]);
  } else {
    for (const c of cells) await sheetsValuesUpdate(`${tab}!${c[0]}${sheetRow}`, [[c[2]]]);
  }
  bust(CACHE_KEY);
}

/** ptAddRow: append a "New role" row under a Tier 1 / Tier 2 with the next numeric Row ID. */
export async function addRow(project: string, tier1: string, tier2: string) {
  if (!sheetsReady()) {
    const rows = sample();
    const nextId = 1 + Math.max(0, ...rows.map((r) => parseInt(r.id, 10)).filter((v) => !isNaN(v)));
    const colmap = rows[0]?.colmap || JSON.stringify({ _n: SAMPLE_ROSTER_HEADER.length });
    rows.push({ id: String(nextId), sheet_row: rows.length + 2, project, tier1, tier2, role: 'New role', level: '', firm: '', contact: '', contact_email: '', crm_id: '', phone: '', colmap });
    return;
  }
  const rows = await readLiveRows();
  const any = rows[0];
  const cm = (any ? JSON.parse(any.colmap || '{}') : { _n: 11, row_id: 'A', project: 'B', tier1: 'C', tier2: 'D', role: 'E' }) as Record<string, string | number>;
  const idx = (letter: string): number => colIndex(letter) - 1;
  const n = Math.max(
    typeof cm._n === 'number' ? cm._n : 0,
    ...['row_id', 'project', 'tier1', 'tier2', 'role']
      .filter((k) => typeof cm[k] === 'string')
      .map((k) => idx(cm[k] as string) + 1),
  );
  const vals: string[] = new Array(n).fill('');
  const nextId = 1 + Math.max(0, ...rows.map((r) => parseInt(r.id, 10)).filter((v) => !isNaN(v)));
  const put = (k: string, v: string) => {
    if (typeof cm[k] === 'string') vals[idx(cm[k] as string)] = v;
  };
  put('row_id', String(nextId));
  put('project', project);
  put('tier1', tier1);
  put('tier2', tier2);
  put('role', 'New role');
  await sheetsValuesAppend(`${rosterTab()}!A1`, [vals]);
  bust(CACHE_KEY);
}

/** ptRemoveRow: re-check Row ID + Project at that sheet row, then delete the row. */
export async function removeRow(sheetRow: number, id: string, project: string) {
  if (!sheetsReady()) {
    const r = checkRow(sample(), sheetRow, id, project);
    store = sample().filter((x) => x !== r);
    renumber();
    return;
  }
  // Same check as the original: read Row ID + Project at that sheet row first.
  const got = await sheetsValuesGet(`${rosterTab()}!A${sheetRow}:B${sheetRow}`);
  const first = got[0] || [];
  if (String(first[0] ?? '') !== String(id) || String(first[1] ?? '') !== String(project)) {
    throw new RosterConflict('The sheet changed since this page loaded.');
  }
  await sheetsDeleteRow(sheetRow);
  bust(CACHE_KEY);
}
