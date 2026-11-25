import type { ApiRows, RosterRow } from '../types';
import { SAMPLE_ROSTER_HEADER, sampleRoster } from '../fixtures/people';

// Roster tab of the Project Team Roster sheet: read, edit cells, append a row, delete a row.
// Until stage 6 connects the Google Sheets API, these work on an in-memory sample roster
// (it resets when the dev server restarts).

/** Fields the page may write, keyed as in the projectRoster loader's colmap. */
export const WRITABLE_FIELDS = ['role', 'level', 'firm', 'contact', 'contact_email', 'crm_id', 'phone'] as const;
export type WritableField = (typeof WRITABLE_FIELDS)[number];

export class RosterConflict extends Error {}

let store: RosterRow[] | null = null;
const sample = () => (store ??= sampleRoster());

/** Rebuild sheet row numbers after a delete, as the sheet itself would. */
function renumber() { sample().forEach((r, i) => { r.sheet_row = i + 2; }); }

export async function loadRoster(): Promise<ApiRows<RosterRow>> {
  return { rows: sample().map((r) => ({ ...r })), source: 'sample' };
}

/**
 * The row the page is changing must still be the one it saw: same Row ID and Project at that sheet row.
 * This is the original's safety check before deleting (ptRemoveRow), applied to edits too.
 */
function checkRow(sheetRow: number, id: string, project: string): RosterRow {
  const r = sample().find((x) => x.sheet_row === sheetRow);
  if (!r || r.id !== id || r.project !== project) throw new RosterConflict('The sheet changed since this page loaded.');
  return r;
}

/** ptCellVal: prefix values Sheets would treat as formulas or numbers with an apostrophe. */
export function cellVal(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /^[=+\-@0-9]/.test(s) ? "'" + s : s;
}

export async function writeCells(sheetRow: number, id: string, project: string, values: Partial<Record<WritableField, string>>) {
  const r = checkRow(sheetRow, id, project);
  // The sample store keeps plain values; the live sheet stores cellVal(v) so it isn't parsed as a formula.
  for (const [k, v] of Object.entries(values)) (r as unknown as Record<string, string>)[k] = String(v ?? '');
}

/** ptAddRow: append a "New role" row under a Tier 1 / Tier 2 with the next numeric Row ID. */
export async function addRow(project: string, tier1: string, tier2: string) {
  const rows = sample();
  const nextId = 1 + Math.max(0, ...rows.map((r) => parseInt(r.id, 10)).filter((v) => !isNaN(v)));
  const colmap = rows[0]?.colmap || JSON.stringify({ _n: SAMPLE_ROSTER_HEADER.length });
  rows.push({ id: String(nextId), sheet_row: rows.length + 2, project, tier1, tier2, role: 'New role', level: '', firm: '', contact: '', contact_email: '', crm_id: '', phone: '', colmap });
}

/** ptRemoveRow: re-check Row ID + Project at that sheet row, then delete the row. */
export async function removeRow(sheetRow: number, id: string, project: string) {
  const r = checkRow(sheetRow, id, project);
  store = sample().filter((x) => x !== r);
  renumber();
}
