import { DEPT_NAMES, type Dept } from '../types';
import { cached } from './cache';
import { matrixTab, matrixValuesGet, sheetsReady } from './googleSheets';

// Per-project data from the "Project" tab of the Project Roles Matrix
// sheet: the "Client" column plus the "New Department" and "New Status"
// override columns. The sheet is the control surface — Samer edits it,
// the dashboard shows the project under the chosen department/status.
// Dashboard-only: nothing is ever written back to Zoho. A failed read
// fails OPEN (empty map) so the projects API never breaks because the
// sheet is unreachable; the hardcoded DEPT_OVERRIDES and the J26 rule in
// lib/rules.ts remain the baseline.

export interface ProjectOverride {
  dept?: Dept;
  status?: string;
  client?: string;
}

const CACHE_KEY = 'sheets:matrix:project-overrides';
const STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled'] as const;

const DEPT_BY_NAME: Record<string, Dept> = {
  ...Object.fromEntries(
    Object.entries(DEPT_NAMES).map(([code, name]) => [name.toLowerCase(), code as Dept]),
  ),
  // Old UC label — still accepted so any stale sheet value keeps working.
  'urban core builders': 'UC',
};

function parseDept(v: string): Dept | undefined {
  const key = v.trim().toLowerCase();
  if (!key) return undefined;
  return DEPT_BY_NAME[key];
}

function parseStatus(v: string): string | undefined {
  const key = v.trim().toLowerCase();
  if (!key) return undefined;
  return STATUSES.find((s) => s.toLowerCase() === key);
}

/** Overrides keyed by uppercased project name. Empty when the sheet can't be read. */
export async function loadProjectOverrides(): Promise<Map<string, ProjectOverride>> {
  if (!sheetsReady()) return new Map();
  return cached(CACHE_KEY, async () => {
    try {
      const values = await matrixValuesGet(`${matrixTab()}!A1:H200`);
      if (!values.length) return new Map<string, ProjectOverride>();
      const head = values[0].map((h) => String(h ?? '').trim().toLowerCase());
      const col = (name: string) => head.indexOf(name);
      const pick = (r: unknown[], name: string): string => {
        const i = col(name);
        return i >= 0 && r[i] != null ? String(r[i]).trim() : '';
      };
      const out = new Map<string, ProjectOverride>();
      for (const row of values.slice(1)) {
        const r = Array.isArray(row) ? row : [];
        const name = pick(r, 'project');
        if (!name) continue;
        const dept = parseDept(pick(r, 'new department'));
        const status = parseStatus(pick(r, 'new status'));
        const client = pick(r, 'client') || undefined;
        if (!dept && !status && !client) continue;
        out.set(name.toUpperCase(), { dept, status, client });
      }
      return out;
    } catch (err) {
      console.warn('[project-overrides] sheet read failed, ignoring overrides:', err instanceof Error ? err.message : String(err));
      return new Map<string, ProjectOverride>();
    }
  });
}
