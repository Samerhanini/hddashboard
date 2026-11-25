'use client';

import type { PhaseRow, TaskRow } from './types';
import { useDataset } from './useDataset';

/** projectTasks: open tasks of the selected project. Shared by the Tasks and Schedule views (SWR de-duplicates). */
export function useProjectTasks(projectId: string | null) {
  return useDataset<TaskRow>(projectId ? `/api/projects/${projectId}/tasks` : null);
}

/** projectPhases: phases (milestones) of the selected project. */
export function useProjectPhases(projectId: string | null) {
  return useDataset<PhaseRow>(projectId ? `/api/projects/${projectId}/phases` : null);
}
