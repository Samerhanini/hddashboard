'use client';

import type { View } from '@/lib/types';
import { useDashboard } from './DashboardContext';

const svgProps = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
};

// Icons copied from reference/page.html.
const ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'overview', label: 'Overview', icon: <svg {...svgProps}><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5" /><circle cx="17" cy="9" r="2.3" /><path d="M15.5 14.2c2.4-.3 4.5 1.4 5 4.3" /></svg> },
  { view: 'agenda', label: 'Agenda', icon: <svg {...svgProps}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4" /></svg> },
  { view: 'schedule', label: 'Schedule', icon: <svg {...svgProps}><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v3M16 3v3M7 13h6M10 16.5h7" /></svg> },
  { view: 'finance', label: 'Finance', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.6-.9-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.3 0 3.2 6 1.8 6 5 0 1.4-1.3 2.4-3 2.4-1.4 0-2.6-.6-3.2-1.6M12 5.5v13" /></svg> },
  { view: 'resources', label: 'Resources', icon: <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg> },
  { view: 'tasks', label: 'Tasks', icon: <svg {...svgProps}><path d="M4 6.5l1.5 1.5L8 5.5M4 12.5l1.5 1.5L8 11.5M4 18.5l1.5 1.5L8 17.5M11 7h9M11 13h9M11 19h9" /></svg> },
  { view: 'meetings', label: 'Meetings', icon: <svg {...svgProps}><rect x="3" y="6" width="12" height="12" rx="2" /><path d="M15 10.5l6-3.5v10l-6-3.5" /></svg> },
];

/** The seven view buttons. */
export default function ViewNav() {
  const { view, selectView } = useDashboard();
  return (
    <nav className="pt-views" role="tablist" aria-label="Project view" id="project-views">
      {ITEMS.map((it) => {
        const on = it.view === view;
        return (
          <button key={it.view} type="button" role="tab" aria-selected={on}
            className={'pt-view' + (on ? ' pt-view-on' : '')} onClick={() => selectView(it.view)}>
            {it.icon}<span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
