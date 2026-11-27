// Parsers ported from reference/data-loaders.js (projects, projectTasks, projectHours, projectPhases, crmContacts).
// They accept the raw Zoho REST answer (or the connector's { data: ... } wrapper) and return the same row
// shapes the original produced, so the UI code works unchanged.

import type { CrmContactRow, HoursRow, PhaseRow, ProjectRateRow, ProjectRow, TaskRow } from '../../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export function decode(s: unknown): string {
  return String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function rootOf(answer: Any): Any {
  if (answer && answer.status && answer.status !== 'success' && !answer.data) throw new Error(JSON.stringify(answer).slice(0, 300));
  return answer && answer.data ? answer.data : answer;
}
/** More pages to read? Uses page_info when Zoho sends it; for a plain list, a full page means there may be more. */
export const hasNextPage = (answer: Any, perPage = 200): boolean => {
  const r = rootOf(answer);
  if (Array.isArray(r)) return r.length >= perPage;
  return !!(r && r.page_info && r.page_info.has_next_page);
};
/** Tasks of an answer: Zoho V3 may answer { tasks: [...] } or a plain list (as it does for projects). */
const tasksOf = (root: Any): Any[] => (Array.isArray(root) ? root : (root && root.tasks) || []);

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
  const list: Any[] = tasksOf(root);
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

/**
 * Exact hours from Zoho Projects Bulk Time Logs (V3):
 * GET /portal/{portal}/projects/{project}/timelogs?view_type=projectspan
 * Response: { time_logs: [{ date, log_details: [{ owner, module_detail,
 * log_hour: "HH:MM", billing_status, project }, ...] }], page_info }.
 * One row per (task, person who actually logged time), hours summed from
 * that person's own log entries — never split between task owners.
 */
export function parseTimelogs(answer: Any | Any[]): HoursRow[] {
  // Accept one page's answer, or several pages: aggregation is across all
  // pages, so a person with entries on two pages still gets one row.
  const answers: Any[] = Array.isArray(answer) ? answer : [answer];
  const groups: Any[] = answers.flatMap((a) => { const r = rootOf(a); return (r && r.time_logs) || []; });
  // Aggregate per (task, person) first, so several entries on one task by
  // the same person become a single row with the exact summed hours.
  const byTaskPerson = new Map<string, { project_id: string; task_id: string; task: string; person: string; email: string; hours: number; entries: number }>();
  const taskTotals = new Map<string, { hours: number; people: Set<string> }>();
  groups.forEach((g: Any) => {
    ((g && g.log_details) || []).forEach((d: Any) => {
      const h = hrs(d && d.log_hour);
      if (!h) return;
      const owner = (d && d.owner) || {};
      const person = [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.name || owner.email || 'Unassigned';
      const mod = (d && d.module_detail) || {};
      const type = mod.type || d.type || 'task';
      const taskId = String(mod.id || 'general');
      const taskName = decode(mod.name || (type === 'general' ? 'General log' : type === 'issue' || type === 'bug' ? 'Issue log' : ''));
      const projectId = String((d && d.project && d.project.id) || '');
      const key = taskId + '|' + person;
      const e = byTaskPerson.get(key) || { project_id: projectId, task_id: taskId, task: taskName, person, email: String(owner.email || ''), hours: 0, entries: 0 };
      e.hours += h; e.entries += 1;
      byTaskPerson.set(key, e);
      const t = taskTotals.get(taskId) || { hours: 0, people: new Set<string>() };
      t.hours += h; t.people.add(person);
      taskTotals.set(taskId, t);
    });
  });
  return [...byTaskPerson.values()].map((e) => {
    const t = taskTotals.get(e.task_id)!;
    return {
      project_id: e.project_id, task_id: e.task_id, task: e.task, person: e.person, email: e.email || undefined,
      owners: t.people.size, task_hours: Math.round(t.hours * 100) / 100,
      hours: Math.round(e.hours * 100) / 100, entries: e.entries,
    };
  });
}

/**
 * Fallback, kept only while the Zoho token lacks the timesheets scope:
 * one row per owner of each task with logged hours, each owner getting an
 * even share of the task's total. This is an ESTIMATE, not a timesheet
 * record — the task's owners are not necessarily the people who logged time.
 */
export function parseHours(answer: Any): HoursRow[] {
  const root = rootOf(answer);
  const rows: HoursRow[] = [];
  tasksOf(root).forEach((t: Any) => {
    const total = hrs(t.log_hours && t.log_hours.total_hours);
    if (!total) return;
    const owners = ((t.owners_and_work && t.owners_and_work.owners) || []).filter((o: Any) => o && o.name !== 'Unassigned User');
    const names: string[] = owners.length ? owners.map((o: Any) => [o.first_name, o.last_name].filter(Boolean).join(' ') || o.name) : ['Unassigned'];
    names.forEach((n) => rows.push({ project_id: String((t.project && t.project.id) || ''), task_id: String(t.id), person: n, owners: names.length, task_hours: Math.round(total * 100) / 100, hours: Math.round((total / names.length) * 100) / 100 }));
  });
  return rows;
}

/**
 * Billable rates of a project's users, from Zoho Projects V3
 * GET /portal/{portal}/projects/{project}/users (scope ZohoProjects.users.READ).
 * Each user carries `invoice` — the billable rate per hour set for that user
 * on this project — and `budget.rate_per_hour` (same billing rate).
 * `budget.cost_per_hour` is the internal staff cost and is deliberately NOT
 * read: the dashboard shows the billable number, never the staff cost.
 */
export function parseProjectUsers(answer: Any): ProjectRateRow[] {
  const root = rootOf(answer);
  const list: Any[] = Array.isArray(root) ? root : (root && root.users) || [];
  return list.map((u: Any) => ({
    person: decode(u.full_name || u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || ''),
    email: String(u.email || ''),
    rate_per_hour: Number(u.invoice ?? (u.budget && u.budget.rate_per_hour) ?? 0) || 0,
  })).filter((r) => r.person);
}

/** Phase ids and names used by the tasks in an answer (milestone "None" is skipped). */
export function phaseIdsOf(answer: Any, into: Map<string, string>) {
  const root = rootOf(answer);
  tasksOf(root).forEach((t: Any) => { const m = t.milestone; if (m && m.id && m.name && m.name !== 'None') into.set(String(m.id), decode(m.name)); });
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
