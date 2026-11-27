'use client';

import { format } from 'd3';
import { afMatch, COLORS, deptProjects, homeDeptOf, projectBadge, qbMatch, shortName } from '@/lib/rules';
import { DEPT_COLORS, ROLES_MATRIX_URL } from '@/lib/types';
import { useAfLoans, useAfSpend, useQbAr, useQbSales } from '@/lib/hooks';
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
        // In OP, the badge shows the department the project came from (grey when it had none).
        const home = dept === 'OP' ? homeDeptOf(p.name) : null;
        const badgeBg = dept === 'OP' ? (home ? DEPT_COLORS[home] : '#5b7083') : COLORS[i % COLORS.length];
        return (
          <div className="pt-icon-wrap" key={p.id}>
            <button type="button" className={cls} aria-pressed={on}
              title={p.name + ' (' + p.status + ')' + (fin ? ' · has QuickBooks or AppFolio activity' : '')}
              onClick={() => selectProject(p.id)}>
              <span className="pt-icon-badge" style={{ background: badgeBg }}>{projectBadge(p.name, dept)}</span>
              <span className="pt-icon-text">
                <span className="pt-icon-name">{shortName(p.name)}</span>
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
        {dept === 'OP' && (
          <a className="pt-hidden-btn" href={ROLES_MATRIX_URL} target="_blank" rel="noreferrer">Project Roles Matrix ↗</a>
        )}
      </div>
      {dept === 'OP' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: '#666', margin: '2px 0 8px' }}>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2f6fbd', marginRight: 5 }} />HD - Active</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#d9822b', marginRight: 5 }} />Urban Core Builders</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#800020', marginRight: 5 }} />BS - Active</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#5b7083', marginRight: 5 }} />No department</span>
        </div>
      )}
      <div className={'pt-icons' + (projects.status === 'loading' ? ' dash-skeleton' : '')}>{body}</div>
    </section>
  );
}

/** In the Finance view, tiles with QuickBooks (UC) or AppFolio (HD) activity are highlighted green. */
function useDashboardWithFinance() {
  const ctx = useDashboard();
  const finOn = ctx.view === 'finance';
  // Only fetched while the Finance view is open, for the department that uses it.
  const qs = useQbSales(finOn && ctx.dept === 'UC'), qa = useQbAr(finOn && ctx.dept === 'UC');
  const as = useAfSpend(finOn && ctx.dept === 'HD'), al = useAfLoans(finOn && ctx.dept === 'HD');
  const qbOn = finOn && ctx.dept === 'UC' && qs.status === 'ok' && qa.status === 'ok';
  const afOn = finOn && ctx.dept === 'HD' && as.status === 'ok' && al.status === 'ok';
  const hasFinance = (p: ProjectRow) => {
    if (!finOn) return false;
    if (qbOn) { const s = qbMatch(qs.data, p), a = qbMatch(qa.data, p); if ((s && s.total_sales) || (a && a.total)) return true; }
    // ptAfHasActivity
    return afOn && (afMatch(as.data, p).some((r) => r.spent_to_date || r.spend_ytd) || afMatch(al.data, p).length > 0);
  };
  return { ...ctx, hasFinance };
}
