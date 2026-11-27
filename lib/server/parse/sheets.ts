import type { RosterRow } from '../../types';

// Roster tab parser, mirroring reference/data-loaders.js -> projectRoster:
// the header row names the columns (the live sheet has Firm before Level),
// so the column-letter map is built from the header, not assumed positions.

const letter = (i: number): string => {
  let s = '';
  i += 1;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

export function parseRosterValues(values: unknown[][]): RosterRow[] {
  if (!values.length) return [];
  const head = values[0].map((h) => String(h ?? '').trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const pick = (r: unknown[], name: string): string => {
    const i = col(name);
    return i >= 0 && r[i] != null ? String(r[i]).trim() : '';
  };
  const fields: Record<string, string> = {
    row_id: 'row id',
    project: 'project',
    tier1: head.includes('tier 1') ? 'tier 1' : 'section',
    tier2: 'tier 2',
    role: 'role',
    level: 'level',
    firm: 'firm',
    contact: 'contact',
    contact_email: 'contact email',
    crm_id: 'crm contact id',
    phone: head.includes('phone') ? 'phone' : 'mobile',
  };
  const cm: Record<string, string | number> = { _n: head.length };
  for (const [k, n] of Object.entries(fields)) {
    const i = col(n);
    if (i >= 0) cm[k] = letter(i);
  }
  const colmap = JSON.stringify(cm);
  return values
    .slice(1)
    .map((r, i) => {
      const row = Array.isArray(r) ? r : [];
      return {
        id: pick(row, 'row id') || String(i + 2),
        sheet_row: i + 2,
        project: pick(row, 'project'),
        tier1: pick(row, fields.tier1),
        tier2: pick(row, 'tier 2'),
        role: pick(row, 'role'),
        firm: pick(row, 'firm'),
        level: pick(row, 'level'),
        contact: pick(row, 'contact'),
        contact_email: pick(row, 'contact email'),
        crm_id: pick(row, 'crm contact id').replace(/^'/, ''),
        phone: pick(row, fields.phone),
        colmap,
      };
    })
    .filter((r) => r.project || r.role);
}
