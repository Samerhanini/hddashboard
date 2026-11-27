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
    const act = projects.data.filter((p) => inDept(p.name, d) && p.status === 'Active');
    const open = act.reduce((n, p) => n + p.open_tasks, 0);
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
