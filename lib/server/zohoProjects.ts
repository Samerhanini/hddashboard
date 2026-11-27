import type { ApiRows, HoursRow, PhaseRow, ProjectRateRow, ProjectRow, TaskRow } from '../types';
import { sampleProjects } from '../fixtures/projects';
import { sampleHours, sampleProjectData } from '../fixtures/tasks';
import { cached } from './cache';
import { hasNextPage, parseHours, parsePhase, parseProjects, parseProjectUsers, parseTasks, parseTimelogs, phaseIdsOf } from './parse/zoho';
import { mapLimit, portalId, projectsBase, projectsRestBase, zohoGet, zohoReady } from './zoho';

// Zoho Projects loaders (datasets.json -> projects, projectTasks, projectHours, projectPhases).
// Sample rows while the Zoho credentials aren't set; live Zoho Projects V3 calls once they are.

const PER_PAGE = 200;
const MAX_PAGES = 10; // the original read at most 10 pages (2,000 tasks)
// "All open tasks" filter, as in datasets.json -> projectTasks.
const OPEN_FILTER = JSON.stringify({ criteria: [{ field_name: 'status', criteria_condition: 'is', value: ['${ALL_OPEN}'] }], pattern: '1' });

const byDue = (a: TaskRow, b: TaskRow) => (Date.parse(a.due || '') || Infinity) - (Date.parse(b.due || '') || Infinity);

import { loadProjectOverrides } from './projectOverrides';

export async function loadProjects(): Promise<ApiRows<ProjectRow>> {
  if (!zohoReady()) return { rows: sampleProjects, source: 'sample' };
  const out = await cached(`zoho:${portalId()}:projects`, async () => {
    const rows: ProjectRow[] = [];
    let page = 1, more = true;
    while (more && page <= 5) {
      const ans = await zohoGet(`${projectsBase()}/projects`, { per_page: PER_PAGE, page });
      rows.push(...parseProjects(ans));
      more = hasNextPage(ans);
      page += 1;
    }
    return { rows, truncated: more, source: 'live' as const };
  });
  // Sheet overrides (Project tab "New Department" / "New Status") layer on
  // top of the Zoho rows; a failed sheet read just means no overrides.
  const overrides = await loadProjectOverrides();
  if (!overrides.size) return out;
  return {
    ...out,
    rows: out.rows.map((p) => {
      const o = overrides.get(p.name.toUpperCase());
      if (!o) return p;
      return { ...p, dept: o.dept ?? p.dept, status: o.status ?? p.status };
    }),
  };
}

/** Open tasks of one project, soonest due first (first 200, like the original). */
export async function loadProjectTasks(projectId: string): Promise<ApiRows<TaskRow>> {
  if (!zohoReady()) {
    const set = sampleProjectData(projectId);
    const rows = set ? set.tasks.slice().sort(byDue) : [];
    return { rows: rows.slice(0, 200), truncated: rows.length > 200, source: 'sample' };
  }
  return cached(`zoho:${portalId()}:tasks:${projectId}`, async () => {
    const ans = await zohoGet(`${projectsBase()}/projects/${projectId}/tasks`, { filter: OPEN_FILTER, per_page: PER_PAGE, sort_by: 'ASC(end_date)' });
    return { rows: parseTasks(ans), truncated: hasNextPage(ans), source: 'live' as const };
  });
}

/** Every task of a project (all statuses, every page up to 2,000), shared by the hours and phases loaders. */
function allTaskPages(projectId: string): Promise<{ pages: unknown[]; truncated: boolean }> {
  return cached(`zoho:${portalId()}:alltasks:${projectId}`, async () => {
    const pages: unknown[] = [];
    let page = 1, more = true;
    while (more && page <= MAX_PAGES) {
      const ans = await zohoGet(`${projectsBase()}/projects/${projectId}/tasks`, { per_page: PER_PAGE, page });
      pages.push(ans);
      more = hasNextPage(ans);
      page += 1;
    }
    return { pages, truncated: more };
  });
}

/**
 * Diagnostic for the hours card: how many tasks Zoho returned per page, which statuses and depths they
 * have, and the raw logged-hours fields of a few tasks. Contains project data only, never credentials.
 */
export async function debugProjectHours(projectId: string) {
  const { pages, truncated } = await allTaskPages(projectId);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const tasksOf = (a: any): any[] => { const r = a && a.data ? a.data : a; return Array.isArray(r) ? r : (r && r.tasks) || []; };
  const all = pages.flatMap(tasksOf);
  const count = (f: (t: any) => string) => all.reduce((m: Record<string, number>, t) => { const k = f(t); m[k] = (m[k] || 0) + 1; return m; }, {});
  const withHours = all.filter((t) => t.log_hours && Object.values(t.log_hours).some((v) => v && v !== '0' && v !== '0:00' && v !== '00:00'));
  const pick = (t: any) => ({ id: t.id, name: t.name, status: t.status && t.status.name, depth: t.depth, owners: ((t.owners_and_work && t.owners_and_work.owners) || []).map((o: any) => o.name), log_hours: t.log_hours, other_hour_fields: Object.fromEntries(Object.entries(t).filter(([k]) => /hour|log|work|duration/i.test(k) && k !== 'log_hours' && k !== 'owners_and_work')) });
  return {
    pages_read: pages.length,
    tasks_per_page: pages.map((p) => tasksOf(p).length),
    more_pages_not_read: truncated,
    total_tasks: all.length,
    tasks_by_status: count((t) => (t.status && t.status.name) || '(none)'),
    tasks_by_depth: count((t) => String(t.depth ?? '(none)')),
    tasks_with_logged_hours: withHours.length,
    field_names_on_a_task: all[0] ? Object.keys(all[0]).sort() : [],
    examples_with_hours: withHours.slice(0, 5).map(pick),
    example_without_hours: all.find((t) => !withHours.includes(t)) ? pick(all.find((t) => !withHours.includes(t))) : null,
    first_page_info: (() => { const p: any = pages[0]; const r = p && p.data ? p.data : p; return r && !Array.isArray(r) ? r.page_info || null : '(plain list, no page_info)'; })(),
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Diagnostic for switching the hours card to real time logs (who logged each hour). Tries the likely
 * Zoho time-log endpoints and shows each raw answer, trimmed. Needs the ZohoProjects.timesheets.READ scope.
 */
export async function debugTimelogs(projectId: string) {
  const d = new Date();
  const mmddyyyy = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  const attempts: { name: string; url: string; params: Record<string, string | number> }[] = [
    { name: 'v3 timelogs (task, projectspan)', url: `${projectsBase()}/projects/${projectId}/timelogs`, params: { module: JSON.stringify({ type: 'task' }), view_type: 'projectspan', page: 1, per_page: 50 } },
    { name: 'v3 timelogs (task)', url: `${projectsBase()}/projects/${projectId}/timelogs`, params: { module: JSON.stringify({ type: 'task' }), page: 1, per_page: 50 } },
    { name: 'v2 logs (month)', url: `${projectsRestBase()}/projects/${projectId}/logs/`, params: { users_list: 'all', view_type: 'month', date: mmddyyyy, bill_status: 'All', component_type: 'task' } },
    { name: 'v2 logs (custom range)', url: `${projectsRestBase()}/projects/${projectId}/logs/`, params: { users_list: 'all', view_type: 'custom_date', custom_date: JSON.stringify({ start_date: '01-01-2015', end_date: mmddyyyy }), bill_status: 'All', component_type: 'task' } },
  ];
  const results = [];
  for (const a of attempts) {
    try {
      const ans = await zohoGet(a.url, a.params);
      results.push({ attempt: a.name, ok: true, answer_start: JSON.stringify(ans).slice(0, 2500) });
    } catch (err) {
      results.push({ attempt: a.name, ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 500) });
    }
  }
  return results;
}

const TIMELOG_MAX_PAGES = 50; // 50 pages x 200 date-groups, far above any one project

/** One full read of the V3 Bulk Time Logs endpoint with the given extra params. */
async function readTimelogs(projectId: string, extra: Record<string, string | number>): Promise<ApiRows<HoursRow>> {
  const pages: unknown[] = [];
  let page = 1, more = true;
  while (more && page <= TIMELOG_MAX_PAGES) {
    const ans = await zohoGet(`${projectsBase()}/projects/${projectId}/timelogs`, { view_type: 'projectspan', per_page: PER_PAGE, page, ...extra });
    pages.push(ans);
    more = hasNextPage(ans);
    page += 1;
  }
  return { rows: parseTimelogs(pages), truncated: more, source: 'live' as const, exact: true };
}

/**
 * Logged hours per person on a project, exact.
 *
 * Primary source: Zoho Projects Bulk Time Logs (V3, scope
 * ZohoProjects.timesheets.READ) with view_type=projectspan, so every log
 * entry in the project's life is read and summed under the person who
 * actually logged it, per task. Billable and non-billable entries both count.
 * Zoho's docs list `module` as required, so the first attempt passes
 * module={type:'task'} (the same call the ?debug=timelogs probe makes);
 * if Zoho rejects that, the call is retried without a module filter.
 *
 * Fallbacks, in order, so the Finance tab never goes blank while the new
 * scope is being added to the Self Client:
 *  1. If Zoho rejects the timelogs call for lack of scope/permission (403),
 *     fall back to the old estimate — each task's total hours split evenly
 *     between its owners — and mark it exact: false so the UI says so.
 *  2. If Zoho insists on a per-task module filter (400), re-read the logs
 *     task by task, but only for tasks that actually have logged hours.
 */
export async function loadProjectHours(projectId: string): Promise<ApiRows<HoursRow>> {
  if (!zohoReady()) return { rows: sampleHours(projectId), source: 'sample', exact: false };
  try {
    return await cached(`zoho:${portalId()}:timelogs:${projectId}`, async () => {
      try {
        return await readTimelogs(projectId, { module: JSON.stringify({ type: 'task' }) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/403|insufficient|scope|permission|not authorized|unauthorised/i.test(msg)) throw err;
        return readTimelogs(projectId, {});
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/403|insufficient|scope|permission|not authorized|unauthorised/i.test(msg)) {
      const { pages, truncated } = await allTaskPages(projectId);
      return { rows: pages.flatMap(parseHours), truncated, source: 'live', exact: false };
    }
    if (/400|module/i.test(msg)) {
      const { pages } = await allTaskPages(projectId);
      const withHours = pages.flatMap(parseHours);
      const taskIds = [...new Set(withHours.map((r) => r.task_id))].slice(0, 100);
      const answers = await mapLimit(taskIds, 5, (taskId) =>
        zohoGet(`${projectsBase()}/projects/${projectId}/timelogs`, {
          view_type: 'projectspan', per_page: PER_PAGE, page: 1,
          module: JSON.stringify({ id: taskId, type: 'task' }),
        }).catch(() => null));
      const rows = parseTimelogs(answers.filter((a): a is unknown => !!a));
      return { rows, truncated: taskIds.length >= 100, source: 'live', exact: true };
    }
    throw err;
  }
}

/**
 * Billable rate per hour for each user on a project, from Zoho Projects V3
 * GET /portal/{portal}/projects/{project}/users (scope ZohoProjects.users.READ).
 * The rate shown is the BILLABLE rate (`invoice` / `budget.rate_per_hour`);
 * the internal staff cost (`budget.cost_per_hour`) is never read or shown.
 * If the token lacks the users scope (403), the route still answers with
 * available: false and no rows, so the Resources tab shows hours without
 * costs instead of failing.
 */
export async function loadProjectRates(projectId: string): Promise<ApiRows<ProjectRateRow>> {
  if (!zohoReady()) return { rows: [], source: 'sample' };
  return cached(`zoho:${portalId()}:rates:${projectId}`, async () => {
    try {
      const rows: ProjectRateRow[] = [];
      let page = 1, more = true;
      while (more && page <= 5) {
        const ans = await zohoGet(`${projectsBase()}/projects/${projectId}/users`, { per_page: PER_PAGE, page });
        rows.push(...parseProjectUsers(ans));
        more = hasNextPage(ans);
        page += 1;
      }
      return { rows, truncated: more, source: 'live' as const, available: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/403|insufficient|scope|permission|not authorized|unauthorised/i.test(msg)) {
        return { rows: [], source: 'live' as const, available: false };
      }
      throw err;
    }
  });
}

/** Phases used by the project's tasks, then each phase's owner, status, colour and dates. */
export async function loadProjectPhases(projectId: string): Promise<ApiRows<PhaseRow>> {
  if (!zohoReady()) {
    const set = sampleProjectData(projectId);
    return { rows: set ? set.phases : [], source: 'sample' };
  }
  return cached(`zoho:${portalId()}:phases:${projectId}`, async () => {
    const { pages, truncated } = await allTaskPages(projectId);
    const ids = new Map<string, string>();
    pages.forEach((p) => phaseIdsOf(p, ids));
    const list = [...ids.keys()].slice(0, 60);
    // A phase that can't be read is skipped, as in the original.
    const answers = await mapLimit(list, 5, (id) => zohoGet(`${projectsBase()}/projects/${projectId}/phases/${id}`).catch(() => null));
    const rows = answers.map((a, i) => (a ? parsePhase(a, ids.get(list[i]) || '', projectId) : null)).filter((r): r is PhaseRow => !!r);
    return { rows, truncated: truncated || ids.size > 60, source: 'live' as const };
  });
}
