import type { AgendaNoteRow, ApiRows } from '../types';
import { sampleAgendaNotes } from '../fixtures/people';
import { cached } from './cache';
import { matrixAgendaTab, matrixValuesGet, sheetsReady } from './googleSheets';

// Agenda notes from the "Agenda" tab of the Project Roles Matrix sheet:
// one row per agenda item per week. Columns (header-driven, case-insensitive):
// Project, Week ("2026-W48"), Section, Item, Last week, This week, Upcoming, Source.
// The Agenda view matches rows by project name, ISO week, section and item
// text; "Last week" falls back to the previous week's "This week" when empty.
// Live once GOOGLE_SERVICE_ACCOUNT_JSON is set; sample rows until then.
// A failed read throws (the route answers 502) instead of silently
// showing an empty agenda — same rule as the meetings loader.

const CACHE_KEY = 'sheets:matrix:agenda-notes';

export async function loadAgendaNotes(): Promise<ApiRows<AgendaNoteRow>> {
  if (!sheetsReady()) return { rows: sampleAgendaNotes(), source: 'sample' };
  return cached(CACHE_KEY, async () => {
    const values = await matrixValuesGet(`${matrixAgendaTab()}!A1:H500`);
    if (!values.length) return { rows: [], source: 'live' as const };
    const head = values[0].map((h) => String(h ?? '').trim().toLowerCase());
    const col = (name: string) => head.indexOf(name);
    const pick = (r: unknown[], name: string): string => {
      const i = col(name);
      return i >= 0 && r[i] != null ? String(r[i]).trim() : '';
    };
    const rows: AgendaNoteRow[] = [];
    for (const [n, row] of values.slice(1).entries()) {
      const r = Array.isArray(row) ? row : [];
      const project = pick(r, 'project');
      const item = pick(r, 'item');
      if (!project || !item) continue;
      rows.push({
        id: String(n + 2),
        project,
        week: pick(r, 'week'),
        section: pick(r, 'section'),
        item,
        last_week: pick(r, 'last week'),
        this_week: pick(r, 'this week'),
        upcoming: pick(r, 'upcoming'),
        source: pick(r, 'source'),
      });
    }
    return { rows, source: 'live' as const };
  });
}
