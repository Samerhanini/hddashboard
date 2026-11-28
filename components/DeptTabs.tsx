'use client';

import { DEPTS, DEPT_COLORS, DEPT_NAMES } from '@/lib/types';
import { clientMatches, distinctClients, rowInDept } from '@/lib/rules';
import { useDashboard } from './DashboardContext';

/** Department tabs (deptBadge + deptCount in the original), with the client filter row above them. */
export default function DeptTabs() {
  const { dept, projects, selectDept, client, setClient } = useDashboard();
  const clients = distinctClients(projects.data);

  const countText = (d: string) => {
    if (projects.status === 'error') return 'Failed to load';
    if (projects.status !== 'ok') return '—';
    // Tiles show every project except Completed/Cancelled, so count those.
    const all = projects.data.filter((p) => rowInDept(p, d) && clientMatches(p, client) && p.status !== 'Completed' && p.status !== 'Cancelled');
    const act = all.filter((p) => p.status === 'Active');
    const held = all.filter((p) => p.status === 'On Hold');
    if (!act.length && held.length) return held.length + ' On Hold';
    if (held.length) return act.length + ' active · ' + held.length + ' On Hold';
    return act.length + ' active';
  };

  return (
    <header id="overview">
      {clients.length > 0 && (
        <div className="pt-clients-wrap">
          <div className="pt-side-label">Client{client ? ` · ${client}` : ''}<span className="pt-caret" aria-hidden="true" /></div>
          <div className="pt-tabs pt-clients" role="tablist" aria-label="Client">
          <button key="all" type="button" role="tab" aria-selected={client === null}
            className={'pt-tab pt-client' + (client === null ? ' pt-tab-on' : '')}
            title="All clients" onClick={() => setClient(null)}>
            All
          </button>
          {clients.map((c) => (
            <button key={c} type="button" role="tab" aria-selected={client === c}
              className={'pt-tab pt-client' + (client === c ? ' pt-tab-on' : '')}
              title={c} onClick={() => setClient(client === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>
        </div>
      )}
      <div className="pt-side-label">Departments</div>
      <div className="pt-tabs pt-depts" role="tablist" aria-label="Department">
        {DEPTS.map((d) => {
          const on = d === dept;
          return (
            <button key={d} type="button" role="tab" aria-selected={on}
              className={'pt-tab pt-dept' + (on ? ' pt-tab-on' : '')}
              onClick={() => selectDept(d)}>
              <span className="pt-icon-badge pt-dept-badge" style={{ background: DEPT_COLORS[d] }}>{d}</span>
              <span className={'pt-icon-text' + (d === 'OP' ? ' pt-op-text' : '')}>
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
