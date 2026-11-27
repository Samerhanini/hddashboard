'use client';

import { format } from 'd3';
import { DEPTS, DEPT_COLORS, DEPT_NAMES } from '@/lib/types';
import { inDept } from '@/lib/rules';
import { useDashboard } from './DashboardContext';

const fmtNum = format(',');

/** Department tabs (deptBadge + deptCount in the original). */
export default function DeptTabs() {
  const { dept, projects, selectDept } = useDashboard();

  const countText = (d: string) => {
    if (projects.status === 'error') return 'Failed to load';
    if (projects.status !== 'ok') return '—';
    // Tiles show every project except Completed/Cancelled, so count those.
    const all = projects.data.filter((p) => inDept(p.name, d) && p.status !== 'Completed' && p.status !== 'Cancelled');
    const act = all.filter((p) => p.status === 'Active');
    const held = all.filter((p) => p.status === 'On Hold');
    const open = all.reduce((n, p) => n + p.open_tasks, 0);
    if (!act.length && held.length) return held.length + ' On Hold · ' + fmtNum(open) + ' open tasks';
    if (held.length) return act.length + ' active · ' + held.length + ' On Hold · ' + fmtNum(open) + ' open tasks';
    return act.length + ' active · ' + fmtNum(open) + ' open tasks';
  };

  return (
    <header id="overview">
      <div className="pt-tabs pt-depts" role="tablist" aria-label="Department">
        {DEPTS.map((d) => {
          const on = d === dept;
          return (
            <button key={d} type="button" role="tab" aria-selected={on}
              className={'pt-tab pt-dept' + (on ? ' pt-tab-on' : '')}
              onClick={() => selectDept(d)}>
              <span className="pt-icon-badge pt-dept-badge" style={{ background: DEPT_COLORS[d] }}>{d}</span>
              <span className="pt-icon-text">
                <span className="pt-icon-name">{DEPT_NAMES[d]}</span>
                <span className="pt-icon-meta">{countText(d)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
