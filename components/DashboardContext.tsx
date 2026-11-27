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
  /** Client filter from the Project sheet's Client column (null = all clients). */
  client: string | null;
  selectDept: (d: Dept) => void;
  selectProject: (id: string) => void;
  selectView: (v: View) => void;
  setHidden: (id: string, hide: boolean) => void;
  setClient: (c: string | null) => void;
  toggleShowHidden: () => void;
}

export const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside <Dashboard>');
  return ctx;
}
