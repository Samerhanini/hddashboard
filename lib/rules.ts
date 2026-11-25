// Matching and grouping rules ported from reference/ui.js. CLAUDE.md says to keep these exactly,
// so each function notes the original it comes from. Shared by the browser and the API routes.

import type { Dept, ProjectRow, QbArRow, QbSalesRow } from './types';

/** Series colours (dash.colors in the original; --series-* in globals.css). */
export const COLORS = ['#2f6fbd', '#d9822b', '#3d9970', '#a44a8f', '#c9a227', '#5b7083'];

/** ptInDept: a project belongs to a department by its name prefix (HD..., UC..., BS...). */
export function inDept(name: string, dept: string): boolean {
  return String(name || '').toUpperCase().startsWith(dept);
}

/** ptBldgOf: building key used to find meeting notes. "HD609BRO-..." -> "609"; "HD12Main-..." -> "12 Main". */
export function bldgOf(name: string): string {
  const seg = String(name || '').slice(2).replace(/^[-\s]+/, '').split('-')[0];
  const m = seg.match(/^(\d+)([A-Za-z]*)/);
  let v: string;
  if (m && m[1].length >= 3) v = m[1];
  else if (m) v = m[1] + ' ' + (m[2].charAt(0).toUpperCase() + m[2].slice(1, 4).toLowerCase());
  else v = seg;
  v = String(v).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 30);
  return v.length >= 2 ? v : 'none';
}

/** ptBadge: up to three letters/digits after the department prefix, for the tile badge. */
export function projectBadge(name: string, dept: string): string {
  let s = String(name || '').slice(dept.length).replace(/^[-\s]+/, '');
  s = s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  return s || dept;
}

export type Which = 'visible' | 'hidden' | 'all';

/** ptDeptProjects: projects of a department, excluding Completed/Cancelled, natural sort by name. */
export function deptProjects(projects: ProjectRow[], dept: Dept, hidden: Set<string>, which: Which = 'visible'): ProjectRow[] {
  return projects
    .filter((p) => inDept(p.name, dept) && p.status !== 'Completed' && p.status !== 'Cancelled' && (which === 'all' || (which === 'hidden') === hidden.has(p.id)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/** ptFirstProject: first visible project of a department, or the first one at all if every project is hidden. */
export function firstProject(projects: ProjectRow[], dept: Dept, hidden: Set<string>): string | null {
  const vis = deptProjects(projects, dept, hidden, 'visible');
  const list = vis.length ? vis : deptProjects(projects, dept, hidden, 'all');
  return list.length ? list[0].id : null;
}

/** ptQbMatch: "UC153...-J04..." -> the QuickBooks customer starting "153 " and containing "J04". */
export function qbMatch<T extends QbSalesRow | QbArRow>(rows: T[] | null | undefined, p: ProjectRow | null | undefined): T | null {
  if (!rows || !p) return null;
  const n = String(p.name || '').toUpperCase();
  const m1 = n.match(/^[A-Z]{2}(\d+)/);
  const m2 = n.match(/-(J\d+)/);
  if (!m1 || !m2) return null;
  const num = m1[1], job = m2[1];
  return rows.find((r) => !r.is_total && new RegExp('^' + num + '\\s').test(r.customer) && new RegExp('\\b' + job + '\\b', 'i').test(r.customer)) || null;
}

/** ptAfKey: "HD609BRO-..." -> { num: '609', abbr: 'BRO' }. */
export function afKey(name: string): { num: string; abbr: string } | null {
  const seg = String(name || '').slice(2).replace(/^[-\s]+/, '').split('-')[0];
  const m = seg.match(/^(\d+)([A-Za-z]{3})/);
  return m ? { num: m[1], abbr: m[2].toUpperCase() } : null;
}

/** ptAfMatch: AppFolio rows whose bldg_num and street_abbr match the project. */
export function afMatch<T extends { bldg_num: string | number; street_abbr: string }>(rows: T[] | null | undefined, p: ProjectRow | null | undefined): T[] {
  const k = afKey(p ? p.name : '');
  if (!k || !rows) return [];
  return rows.filter((r) => String(r.bldg_num) === k.num && String(r.street_abbr).toUpperCase() === k.abbr);
}

/** ptIsoWeek: ISO week number of a date. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7);
}

/** ptWeekKey: "2026-W48" for this week (back = 0) or a previous week (back = 1, 2, ...). */
export function weekKey(d: Date, back = 0): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 7 * back));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}
