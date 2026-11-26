// Parsers ported from reference/data-loaders.js (projects, projectTasks, projectHours, projectPhases, crmContacts).
// They accept the raw Zoho REST answer (or the connector's { data: ... } wrapper) and return the same row
// shapes the original produced, so the UI code works unchanged.

import type { CrmContactRow, HoursRow, PhaseRow, ProjectRow, TaskRow } from '../../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export function decode(s: unknown): string {
  return String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function rootOf(answer: Any): Any {
  if (answer && answer.status && answer.status !== 'success' && !answer.data) throw new Error(JSON.stringify(answer).slice(0, 300));
  return answer && answer.data ? answer.data : answer;
}
export const hasNextPage = (answer: Any): boolean => { const r = rootOf(answer); return !!(r && r.page_info && r.page_info.has_next_page); };

export function parseProjects(answer: Any): ProjectRow[] {
  const root = rootOf(answer);
  const list: Any[] = Array.isArray(root) ? root : (root && (root.result || root.projects)) || [];
  return list.map((p) => ({
    id: String(p.id),
    name: decode(p.name),
    group: decode(p.project_group && p.project_group.name) || 'Ungrouped',
    status: (p.status && p.status.name) || '',
    owner: (p.owner && (p.owner.full_name || p.owner.name)) || '',
    percent_complete: Number(p.percent_complete || 0),
    open_tasks: Number((p.tasks && p.tasks.open_count) || 0),
    closed_tasks: Number((p.tasks && p.tasks.closed_count) || 0),
    start_date: p.start_date || null,
    end_date: p.end_date || null,
  }));
}

export function parseTasks(answer: Any): TaskRow[] {
  const root = rootOf(answer);
  const list: Any[] = (root && root.tasks) || [];
  return list.map((t) => {
    const owners = ((t.owners_and_work && t.owners_and_work.owners) || []).map((o: Any) => o.name).filter((n: string) => n && n !== 'Unassigned User');
    return {
      id: String(t.id),
      project_id: String((t.project && t.project.id) || ''),
      task: decode(t.name),
      tasklist: decode(t.tasklist && t.tasklist.name),
      depth: Number(t.depth || 0),
      owners: owners.length ? owners.join(', ') : 'Unassigned',
      status: (t.status && t.status.name) || '',
      completion: Number(t.completion_percentage || 0),
      start: t.start_date || null,
      due: t.end_date || null,
      milestone_id: String((t.milestone && t.milestone.id) || ''),
    };
  });
}

/** "12:30" -> 12.5 hours. */
const hrs = (s: unknown) => { if (!s) return 0; const m = String(s).match(/^(\d+):(\d+)$/); return m ? Number(m[1]) + Number(m[2]) / 60 : Number(s) || 0; };

/** One row per owner of each task with logged hours, each owner getting an even share. */
export function parseHours(answer: Any): HoursRow[] {
  const root = rootOf(answer);
  const rows: HoursRow[] = [];
  ((root && root.tasks) || []).forEach((t: Any) => {
    const total = hrs(t.log_hours && t.log_hours.total_hours);
    if (!total) return;
    const owners = ((t.owners_and_work && t.owners_and_work.owners) || []).filter((o: Any) => o && o.name !== 'Unassigned User');
    const names: string[] = owners.length ? owners.map((o: Any) => [o.first_name, o.last_name].filter(Boolean).join(' ') || o.name) : ['Unassigned'];
    names.forEach((n) => rows.push({ project_id: String((t.project && t.project.id) || ''), task_id: String(t.id), person: n, owners: names.length, task_hours: Math.round(total * 100) / 100, hours: Math.round((total / names.length) * 100) / 100 }));
  });
  return rows;
}

/** Phase ids and names used by the tasks in an answer (milestone "None" is skipped). */
export function phaseIdsOf(answer: Any, into: Map<string, string>) {
  const root = rootOf(answer);
  ((root && root.tasks) || []).forEach((t: Any) => { const m = t.milestone; if (m && m.id && m.name && m.name !== 'None') into.set(String(m.id), decode(m.name)); });
}

export function parsePhase(answer: Any, fallbackName: string, projectId: string): PhaseRow | null {
  const m = answer && (answer.data || answer);
  if (!m || !m.id) return null;
  return {
    id: String(m.id),
    project_id: String((m.project && m.project.id) || projectId || ''),
    phase: decode(m.name || fallbackName),
    owner: m.owner ? [m.owner.first_name, m.owner.last_name].filter(Boolean).join(' ') || m.owner.name || '' : '',
    status: (m.status && m.status.name) || '',
    status_color: (m.status && (m.status.color_hexcode || m.status.color)) || '',
    closed: !!(m.status && (m.status.is_closed_type || m.status.is_closed)),
    start_date: m.start_date || null,
    end_date: m.end_date || null,
  };
}

export function parseCrmContacts(answer: Any): { rows: CrmContactRow[]; more: boolean } {
  if (answer && answer.status && answer.status !== 'success' && !answer.data) throw new Error(JSON.stringify(answer).slice(0, 300));
  const root = answer && answer.data && !Array.isArray(answer.data) ? answer.data : answer;
  const list: Any[] = root && Array.isArray(root.data) ? root.data : Array.isArray(root) ? root : [];
  const rows = list.map((c) => ({
    id: String(c.id),
    name: c.Full_Name || [c.First_Name, c.Last_Name].filter(Boolean).join(' '),
    company: (c.Account_Name && c.Account_Name.name) || '',
    title: c.Title || '',
    email: c.Email || '',
    mobile: c.Mobile || c.Phone || '',
  }));
  return { rows, more: !!(root && root.info && root.info.more_records) };
}
