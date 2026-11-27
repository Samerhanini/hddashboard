'use client';

import { useMemo } from 'react';
import * as d3 from 'd3';
import { COLORS } from '@/lib/rules';
import { useProjectHours, useProjectRates } from '@/lib/hooks';
import type { HoursByPersonRow, HoursRow, ProjectRateRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

const fmtNum = d3.format(',');
const fmt1 = d3.format(',.1f');
const fmtMoney = d3.format('$,.2f');

/** Billable rate lookup for one logged-hours row: by the logger's email first, then by name. */
function rateFor(rates: ProjectRateRow[], r: HoursRow): number | undefined {
  const byEmail = new Map(rates.filter((x) => x.email).map((x) => [x.email.trim().toLowerCase(), x.rate_per_hour]));
  const byName = new Map(rates.map((x) => [x.person.trim().toLowerCase(), x.rate_per_hour]));
  const v = (r.email ? byEmail.get(r.email.trim().toLowerCase()) : undefined) ?? byName.get(r.person.trim().toLowerCase());
  return v && v > 0 ? v : undefined;
}

/**
 * hoursByPerson: exact hours per person, summed from that person's own time-log rows
 * (one row per task they logged on), with each person's billable rate per hour from
 * Zoho and their total cost (hours × billable rate) when the rate is known.
 */
export function hoursByPerson(rows: HoursRow[], rates: ProjectRateRow[] = []): HoursByPersonRow[] {
  const m = new Map<string, { person: string; hours: number; tasks: number; shared_tasks: number; rate?: number }>();
  rows.forEach((r) => {
    const e = m.get(r.person) || { person: r.person, hours: 0, tasks: 0, shared_tasks: 0, rate: rateFor(rates, r) };
    e.hours += r.hours; e.tasks += 1; if (r.owners > 1) e.shared_tasks += 1;
    if (e.rate == null) e.rate = rateFor(rates, r);
    m.set(r.person, e);
  });
  const total = [...m.values()].reduce((s, e) => s + e.hours, 0);
  return [...m.values()]
    .map((e) => ({
      person: e.person, hours: Math.round(e.hours * 10) / 10,
      share: total ? Math.round((e.hours / total) * 1000) / 10 : 0,
      tasks: e.tasks, shared_tasks: e.shared_tasks,
      rate_per_hour: e.rate, cost: e.rate != null ? Math.round(e.hours * e.rate * 100) / 100 : undefined,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/** Hours by person card (hoursTitle + hoursBody), with billable rates and costs from Zoho. */
export default function ResourcesView() {
  const { project, projectId } = useDashboard();
  const raw = useProjectHours(projectId);
  const rates = useProjectRates(projectId);
  const rows = useMemo(
    () => (raw.status === 'ok' ? hoursByPerson(raw.data, rates.status === 'ok' ? rates.data : []) : null),
    [raw.status, raw.data, rates.status, rates.data],
  );
  const exact = raw.exact === true;
  // Rates are unavailable when Zoho answered but the token lacks the users scope.
  const ratesAvailable = rates.status !== 'ok' || rates.available !== false;
  const noRate = rows ? rows.filter((r) => r.rate_per_hour == null).map((r) => r.person) : [];

  let body: React.ReactNode = null;
  if (raw.status === 'error') body = <div className="pt-empty">Failed to load</div>;
  else if (rows && !rows.length) body = <div className="pt-empty">No hours are logged on this project’s tasks in Zoho.</div>;
  else if (rows) {
    const total = d3.sum(rows, (r) => r.hours);
    const totalCost = d3.sum(rows, (r) => r.cost || 0);
    const hasCost = rows.some((r) => r.cost != null);
    const max = d3.max(rows, (r) => r.hours) || 0;
    body = (
      <>
        <div className="pt-table-wrap">
          <table className="pt-table pt-hours-table">
            <thead><tr><th>Person</th><th className="pt-num">Hours</th><th className="pt-num">Share</th><th className="pt-num">Tasks with hours</th><th className="pt-num">Of which shared</th><th className="pt-num">Cost per hour</th><th className="pt-num">Total cost</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.person}>
                  <td>{r.person}</td>
                  <td className="pt-num"><span className="pt-hbar" style={{ width: total ? (60 * r.hours) / max : 0, background: COLORS[0] }} />{fmt1(r.hours)}</td>
                  <td className="pt-num">{fmt1(r.share)}%</td>
                  <td className="pt-num">{fmtNum(r.tasks)}</td>
                  <td className="pt-num">{fmtNum(r.shared_tasks)}</td>
                  <td className="pt-num">{r.rate_per_hour != null ? fmtMoney(r.rate_per_hour) : '—'}</td>
                  <td className="pt-num">{r.cost != null ? fmtMoney(r.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td className="pt-num"><strong>{fmt1(total)}</strong></td>
                <td className="pt-num"><strong>100.0%</strong></td>
                <td className="pt-num"><strong>{fmtNum(d3.sum(rows, (r) => r.tasks))}</strong></td>
                <td className="pt-num"><strong>{fmtNum(d3.sum(rows, (r) => r.shared_tasks))}</strong></td>
                <td className="pt-num">—</td>
                <td className="pt-num"><strong>{hasCost ? fmtMoney(totalCost) : '—'}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="pt-empty">
          {exact
            ? `${fmt1(total)} hours logged in total${hasCost ? `, ${fmtMoney(totalCost)} at billable rates` : ''}. From Zoho time logs (billable and non-billable): every entry counts under the person who logged it, on the task they logged it against — nothing is split between owners. Cost per hour is each person's billable rate from Zoho Projects, and total cost is hours × that rate.`
            : `${fmt1(total)} hours logged in total${hasCost ? `, ${fmtMoney(totalCost)} at billable rates` : ''}. Hours on a task with several owners are divided equally between them, so per-person figures are estimates, not timesheet records.${raw.source === 'live' ? ' Exact time logs need the ZohoProjects.timesheets.READ scope on the dashboard’s Zoho Self Client.' : ''}`}
          {raw.truncated ? ' Only the first 2,000 tasks were read.' : ''}
          {!ratesAvailable ? ' Billable rates need the ZohoProjects.users.READ scope on the dashboard’s Zoho Self Client, so costs show as — until then.' : ''}
          {ratesAvailable && noRate.length ? ` No billable rate is set in Zoho for ${noRate.join(', ')} — their cost shows as —.` : ''}
          {rates.status === 'error' ? ` Billable rates couldn’t be loaded (${rates.message || 'unknown error'}), so costs show as —.` : ''}
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
