import type { ApiRows, HoursRow, PhaseRow, ProjectRow, TaskRow } from '../types';
import { sampleProjects } from '../fixtures/projects';
import { sampleHours, sampleProjectData } from '../fixtures/tasks';
import { cached } from './cache';
import { hasNextPage, parseHours, parsePhase, parseProjects, parseTasks, phaseIdsOf } from './parse/zoho';
import { mapLimit, portalId, projectsBase, zohoGet, zohoReady } from './zoho';

// Zoho Projects loaders (datasets.json -> projects, projectTasks, projectHours, projectPhases).
// Sample rows while the Zoho credentials aren't set; live Zoho Projects V3 calls once they are.

const PER_PAGE = 200;
const MAX_PAGES = 10; // the original read at most 10 pages (2,000 tasks)
// "All open tasks" filter, as in datasets.json -> projectTasks.
const OPEN_FILTER = JSON.stringify({ criteria: [{ field_name: 'status', criteria_condition: 'is', value: ['${ALL_OPEN}'] }], pattern: '1' });

const byDue = (a: TaskRow, b: TaskRow) => (Date.parse(a.due || '') || Infinity) - (Date.parse(b.due || '') || Infinity);

export async function loadProjects(): Promise<ApiRows<ProjectRow>> {
  if (!zohoReady()) return { rows: sampleProjects, source: 'sample' };
  return cached(`zoho:${portalId()}:projects`, async () => {
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

/** Logged hours per task owner (all tasks), each owner getting an even share of a task's hours. */
export async function loadProjectHours(projectId: string): Promise<ApiRows<HoursRow>> {
  if (!zohoReady()) return { rows: sampleHours(projectId), source: 'sample' };
  const { pages, truncated } = await allTaskPages(projectId);
  return { rows: pages.flatMap(parseHours), truncated, source: 'live' };
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
