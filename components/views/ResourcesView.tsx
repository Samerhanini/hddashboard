'use client';

import { useMemo } from 'react';
import * as d3 from 'd3';
import { COLORS } from '@/lib/rules';
import { useProjectHours } from '@/lib/hooks';
import type { HoursByPersonRow, HoursRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

const fmtNum = d3.format(',');
const fmt1 = d3.format(',.1f');

/** hoursByPerson: exact hours per person, summed from that person's own time-log rows (one row per task they logged on). */
export function hoursByPerson(rows: HoursRow[]): HoursByPersonRow[] {
  const m = new Map<string, { person: string; hours: number; tasks: number; shared_tasks: number }>();
  rows.forEach((r) => {
    const e = m.get(r.person) || { person: r.person, hours: 0, tasks: 0, shared_tasks: 0 };
    e.hours += r.hours; e.tasks += 1; if (r.owners > 1) e.shared_tasks += 1;
    m.set(r.person, e);
  });
  const total = [...m.values()].reduce((s, e) => s + e.hours, 0);
  return [...m.values()]
    .map((e) => ({ person: e.person, hours: Math.round(e.hours * 10) / 10, share: total ? Math.round((e.hours / total) * 1000) / 10 : 0, tasks: e.tasks, shared_tasks: e.shared_tasks }))
    .sort((a, b) => b.hours - a.hours);
}

/** Hours by person card (hoursTitle + hoursBody). Moved here from the Finance tab, unchanged. */
export default function ResourcesView() {
  const { project, projectId } = useDashboard();
  const raw = useProjectHours(projectId);
  const rows = useMemo(() => (raw.status === 'ok' ? hoursByPerson(raw.data) : null), [raw.status, raw.data]);
  const exact = raw.exact === true;

  let body: React.ReactNode = null;
  if (raw.status === 'error') body = <div className="pt-empty">Failed to load</div>;
  else if (rows && !rows.length) body = <div className="pt-empty">No hours are logged on this project’s tasks in Zoho.</div>;
  else if (rows) {
    const total = d3.sum(rows, (r) => r.hours);
    const max = d3.max(rows, (r) => r.hours) || 0;
    body = (
      <>
        <div className="pt-table-wrap">
          <table className="pt-table pt-hours-table">
            <thead><tr><th>Person</th><th className="pt-num">Hours</th><th className="pt-num">Share</th><th className="pt-num">Tasks with hours</th><th className="pt-num">Of which shared</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.person}>
                  <td>{r.person}</td>
                  <td className="pt-num"><span className="pt-hbar" style={{ width: total ? (60 * r.hours) / max : 0, background: COLORS[0] }} />{fmt1(r.hours)}</td>
                  <td className="pt-num">{fmt1(r.share)}%</td>
                  <td className="pt-num">{fmtNum(r.tasks)}</td>
                  <td className="pt-num">{fmtNum(r.shared_tasks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pt-empty">
          {exact
            ? `${fmt1(total)} hours logged in total. From Zoho time logs (billable and non-billable): every entry counts under the person who logged it, on the task they logged it against — nothing is split between owners.`
            : `${fmt1(total)} hours logged in total. Hours on a task with several owners are divided equally between them, so per-person figures are estimates, not timesheet records.${raw.source === 'live' ? ' Exact time logs need the ZohoProjects.timesheets.READ scope on the dashboard’s Zoho Self Client.' : ''}`}
          {raw.truncated ? ' Only the first 2,000 tasks were read.' : ''}
        </div>
      </>
    );
  }

  return (
    <section className="pt-card" id="project-hours">
      <h2 className="pt-h2">{project ? project.name + ' — hours by person' : 'Hours by person'}</h2>
      <p className="pt-sub">{exact ? 'Exact timesheet records from Zoho Projects: each person’s own logged hours' : 'Estimate from Zoho Projects: hours logged on each task, split evenly between the task’s owners'}</p>
      <div className={raw.status === 'loading' ? 'dash-skeleton' : undefined} style={raw.status === 'loading' ? { minHeight: 100 } : undefined}>{body}</div>
    </section>
  );
}
