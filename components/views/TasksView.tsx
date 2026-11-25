'use client';

import { timeFormat } from 'd3';
import { useProjectTasks } from '@/lib/hooks';
import { useDashboard } from '../DashboardContext';

const fmtDay = timeFormat('%b %-d, %Y');

/** Tasks view: projectTitle, projectSub, projectTaskRows and projectTaskEmpty in the original. */
export default function TasksView() {
  const { project, projectId } = useDashboard();
  const s = useProjectTasks(projectId);

  // ptProjectTaskRows: this project's tasks, soonest due first, undated last.
  const rows = s.status === 'ok'
    ? s.data.filter((t) => !t.project_id || t.project_id === projectId).slice().sort((a, b) => {
      const da = a.due ? Date.parse(a.due) : Infinity, db = b.due ? Date.parse(b.due) : Infinity;
      return da - db;
    })
    : null;

  const now = Date.now(), week = now + 7 * 864e5;
  const sub = project ? [project.group, project.owner ? 'Owner: ' + project.owner : '', project.status, project.percent_complete + '% complete'].filter(Boolean).join(' · ') : '';

  let empty: string | null = null;
  if (s.status === 'loading') empty = 'Loading tasks…';
  else if (s.status === 'error') empty = 'Failed to load';
  else if (rows && !rows.length) empty = 'This project has no open tasks.';
  else if (s.status === 'ok' && s.truncated) empty = 'Showing the first 200 open tasks; this project has more.';

  return (
    <section className="pt-card" id="project-tasks">
      <h2 className="pt-h2">{project ? project.name + ' — open tasks' : 'Open tasks'}</h2>
      <p className="pt-sub">{sub}</p>
      <div className="pt-table-wrap">
        <table className="pt-table">
          <thead><tr><th>Task</th><th>Task list</th><th>Owner</th><th>Status</th><th className="pt-num">% done</th><th>Due</th></tr></thead>
          <tbody>
            {(rows || []).map((t) => {
              const d = t.due ? new Date(t.due) : null;
              const dueCls = 'pt-nowrap' + (d && d.getTime() < now ? ' pt-bad' : d && d.getTime() < week ? ' pt-warn' : '');
              return (
                <tr key={t.id}>
                  <td className={t.depth > 0 ? 'pt-indent' : undefined}>{t.task}</td>
                  <td>{t.tasklist}</td>
                  <td>{t.owners}</td>
                  <td><span className="pt-pill">{t.status}</span></td>
                  <td className="pt-num">{t.completion}</td>
                  <td className={dueCls}>{d ? fmtDay(d) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {empty && <div className="pt-empty">{empty}</div>}
    </section>
  );
}
