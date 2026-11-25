'use client';

import type { Dept, View } from '@/lib/types';
import { isoWeek } from '@/lib/rules';
import { useDashboard } from './DashboardContext';

interface SectionDef {
  id: string;
  view: View;
  /** data-only-depts in the original */
  only?: Dept[];
  /** data-hide-depts in the original */
  hide?: Dept[];
  title: (name: string | null) => React.ReactNode;
  sub?: string;
  stage: string;
}

// One entry per <section data-view-section> in reference/page.html, in the same order.
const SECTIONS: SectionDef[] = [
  { id: 'project-overview', view: 'overview', title: (n) => (n ? n + ' — team roles and responsibilities' : 'Team roles and responsibilities'), sub: 'Team roster from the Project Team Roster Google Sheet', stage: 'stage 3' },
  { id: 'project-hours', view: 'finance', title: (n) => (n ? n + ' — hours by person' : 'Hours by person'), sub: 'Estimate from Zoho Projects: hours logged on each task, split evenly between the task’s owners', stage: 'stage 3' },
  { id: 'project-quickbooks', view: 'finance', hide: ['HD'], title: (n) => (n ? n + ' — QuickBooks' : 'QuickBooks'), sub: 'From QuickBooks Online · UrbanCore Builders LLC · all dates', stage: 'stage 3' },
  { id: 'project-appfolio', view: 'finance', only: ['HD'], title: (n) => (n ? n + ' — AppFolio' : 'AppFolio'), sub: 'From AppFolio · snapshot of November 17, 2026 · spend is bill amounts, paid and unpaid', stage: 'stage 3' },
  { id: 'project-phases', view: 'schedule', title: (n) => (n ? n + ' — phases' : 'Phases'), stage: 'stage 2' },
  { id: 'project-meetings', view: 'meetings', title: (n) => (n ? n + ' — meetings' : 'Meetings'), stage: 'stage 3' },
  { id: 'project-agenda', view: 'agenda', title: (n) => <>Week {isoWeek(new Date())} Agenda{n ? <>: <b>{n}</b></> : null}</>, stage: 'stage 3' },
  { id: 'project-tasks', view: 'tasks', title: (n) => (n ? n + ' — open tasks' : 'Open tasks'), stage: 'stage 2' },
];

/** ptApplyView: show only the sections of the current view, respecting the per-department limits. */
export default function ViewSections() {
  const { view, dept, project } = useDashboard();
  const name = project ? project.name : null;
  return (
    <>
      {SECTIONS.filter((s) => s.view === view && (!s.only || s.only.includes(dept)) && !(s.hide || []).includes(dept)).map((s) => (
        <section key={s.id} className="pt-card" id={s.id}>
          <h2 className="pt-h2">{s.title(name)}</h2>
          {s.sub && <p className="pt-sub">{s.sub}</p>}
          <div className="pt-empty">This view is built in {s.stage}.</div>
        </section>
      ))}
    </>
  );
}
