import type { ApiRows, HoursRow, PhaseRow, ProjectRow, TaskRow } from '../types';
import { sampleProjects } from '../fixtures/projects';
import { sampleHours, sampleProjectData } from '../fixtures/tasks';
import { hasEnv } from './env';

// Zoho Projects loaders (datasets.json -> projects, projectTasks, projectPhases).
// Each returns sample rows until the Zoho credentials are set. The live calls are added in stage 5.

const zohoReady = () => hasEnv('ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN');

export async function loadProjects(): Promise<ApiRows<ProjectRow>> {
  if (!zohoReady()) return { rows: sampleProjects, source: 'sample' };
  return { rows: sampleProjects, source: 'sample' }; // live loader: stage 5
}

/** Open tasks of one project, sorted by due date (first 200, like the original). */
export async function loadProjectTasks(projectId: string): Promise<ApiRows<TaskRow>> {
  const set = sampleProjectData(projectId);
  const rows = set ? set.tasks.slice().sort((a, b) => (Date.parse(a.due || '') || Infinity) - (Date.parse(b.due || '') || Infinity)) : [];
  return { rows: rows.slice(0, 200), truncated: rows.length > 200, source: 'sample' };
}

/** Logged hours per task owner (all tasks, all pages), each owner getting an even share of a task's hours. */
export async function loadProjectHours(projectId: string): Promise<ApiRows<HoursRow>> {
  return { rows: sampleHours(projectId), source: 'sample' };
}

/** Phases (milestones) used by the project's tasks, with owner, status, colour and dates. */
export async function loadProjectPhases(projectId: string): Promise<ApiRows<PhaseRow>> {
  const set = sampleProjectData(projectId);
  return { rows: set ? set.phases : [], source: 'sample' };
}
