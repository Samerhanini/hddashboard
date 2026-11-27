'use client';

import { createContext, useContext } from 'react';
import type { Dept, ProjectRow, View } from '@/lib/types';
import type { DatasetState } from '@/lib/useDataset';

/** Shared page state. Replaces dash.params() / dash.setParams() from the original. */
export interface DashboardState {
  dept: Dept;
  view: View;
  projectId: string | null;
  /** Building key of the current project (ptBldgOf), used by the Meetings view. */
  bldg: string | null;
  project: ProjectRow | null;
  projects: DatasetState<ProjectRow>;
  hidden: Set<string>;
  showHidden: boolean;
  /** Projects marked completed in this browser (like hidden, local only). */
  completed: Set<string>;
  showCompleted: boolean;
  selectDept: (d: Dept) => void;
  selectProject: (id: string) => void;
  selectView: (v: View) => void;
  setHidden: (id: string, hide: boolean) => void;
  setCompleted: (id: string, done: boolean) => void;
  /** Bring a project back to the active list (clears its hidden and completed marks). */
  setActive: (id: string) => void;
  toggleShowHidden: () => void;
  toggleShowCompleted: () => void;
}

export const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <Dashboard>');
  return ctx;
}
