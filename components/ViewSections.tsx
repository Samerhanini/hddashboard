'use client';

import type { Dept, View } from '@/lib/types';
import { useDashboard } from './DashboardContext';
import AgendaView from './views/AgendaView';
import { AppFolioCard, HoursCard, QuickBooksCard } from './views/FinanceView';
import MeetingsView from './views/MeetingsView';
import OverviewView from './views/OverviewView';
import ScheduleView from './views/ScheduleView';
import TasksView from './views/TasksView';

interface SectionDef {
  id: string;
  view: View;
  /** data-only-depts in the original */
  only?: Dept[];
  /** data-hide-depts in the original */
  hide?: Dept[];
  Component: React.ComponentType;
}

// One entry per <section data-view-section> in reference/page.html, in the same order.
const SECTIONS: SectionDef[] = [
  { id: 'project-overview', view: 'overview', Component: OverviewView },
  { id: 'project-hours', view: 'finance', Component: HoursCard },
  { id: 'project-quickbooks', view: 'finance', hide: ['HD'], Component: QuickBooksCard },
  { id: 'project-appfolio', view: 'finance', only: ['HD'], Component: AppFolioCard },
  { id: 'project-phases', view: 'schedule', Component: ScheduleView },
  { id: 'project-meetings', view: 'meetings', Component: MeetingsView },
  { id: 'project-agenda', view: 'agenda', Component: AgendaView },
  { id: 'project-tasks', view: 'tasks', Component: TasksView },
];

/** ptApplyView: show only the sections of the current view, respecting the per-department limits. */
export default function ViewSections() {
  const { view, dept } = useDashboard();
  return (
    <>
      {SECTIONS.filter((s) => s.view === view && (!s.only || s.only.includes(dept)) && !(s.hide || []).includes(dept))
        .map(({ id, Component }) => <Component key={id} />)}
    </>
  );
}
