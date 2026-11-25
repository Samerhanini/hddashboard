'use client';

import { format } from 'd3';
import { COLORS, deptProjects, projectBadge } from '@/lib/rules';
import type { ProjectRow } from '@/lib/types';
import { useDashboard } from './DashboardContext';

const fmtNum = format(',');

/** Project tiles with hide/unhide (projectIcons + hiddenToggle in the original). */
export default function ProjectBrowser() {
  const { dept, projects, projectId, hidden, showHidden, selectProject, setHidden, toggleShowHidden, hasFinance } = useDashboardWithFinance();
  const hiddenCount = projects.status === 'ok' ? deptProjects(projects.data, dept, hidden, 'hidden').length : 0;

  let body: React.ReactNode = null;
  if (projects.status === 'error') body = <div className="pt-empty">Failed to load</div>;
  else if (projects.status === 'ok') {
    const list = deptProjects(projects.data, dept, hidden, showHidden ? 'hidden' : 'visible');
    if (!list.length) {
      body = <div className="pt-empty">{showHidden ? `No hidden projects in ${dept}.` : `No projects to show in ${dept}.`}</div>;
    } else {
      body = list.map((p, i) => {
        const on = p.id === projectId;
        const fin = hasFinance(p);
        const cls = 'pt-icon' + (on ? ' pt-icon-on' : '') + (p.status === 'Active' || fin ? '' : ' pt-icon-dim') + (fin ? ' pt-icon-fin' : '');
        return (
          <div className="pt-icon-wrap" key={p.id}>
            <button type="button" className={cls} aria-pressed={on}
              title={p.name + ' (' + p.status + ')' + (fin ? ' · has QuickBooks or AppFolio activity' : '')}
              onClick={() => selectProject(p.id)}>
              <span className="pt-icon-badge" style={{ background: COLORS[i % COLORS.length] }}>{projectBadge(p.name, dept)}</span>
              <span className="pt-icon-text">
                <span className="pt-icon-name">{p.name}</span>
                <span className="pt-icon-meta"><span>{fmtNum(p.open_tasks)}</span>{' open' + (p.status === 'Active' ? '' : ' · ' + p.status)}</span>
              </span>
            </button>
            <button type="button" className="pt-icon-x"
              title={showHidden ? 'Show this project again' : 'Hide this project'}
              aria-label={(showHidden ? 'Unhide ' : 'Hide ') + p.name}
              onClick={(ev) => { ev.stopPropagation(); setHidden(p.id, !showHidden); }}>×</button>
          </div>
        );
      });
    }
  }

  return (
    <section id="project-browser">
      <div className="pt-proj-head">
        <h2 className="pt-h2">Projects</h2>
        <button type="button" className="pt-hidden-btn" aria-pressed={showHidden} onClick={toggleShowHidden}>
          {showHidden ? 'Back to projects' : 'Hidden' + (hiddenCount ? ' (' + hiddenCount + ')' : '')}
        </button>
      </div>
      <div className={'pt-icons' + (projects.status === 'loading' ? ' dash-skeleton' : '')}>{body}</div>
    </section>
  );
}

/**
 * In the Finance view, tiles with QuickBooks (UC) or AppFolio (HD) activity are highlighted green.
 * The QuickBooks and AppFolio data arrive with the Finance view (stage 3); until then nothing is highlighted.
 */
function useDashboardWithFinance() {
  const ctx = useDashboard();
  const hasFinance = (_p: ProjectRow) => false;
  return { ...ctx, hasFinance };
}
