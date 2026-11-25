'use client';

import { useRef, useState } from 'react';
import template from '@/lib/agenda-template.json';
import { COLORS, isoWeek, weekKey } from '@/lib/rules';
import { useAgendaNotes } from '@/lib/hooks';
import type { AgendaNoteRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

interface Section { id: string; title: string; items: string[] }
const SECTIONS = (template as { sections: Section[] }).sections;

// Case-insensitive, curly quotes normalised (agCell in the original).
const norm = (x: string) => String(x || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/** The three note columns for one agenda item. "Last week" falls back to last week's "This week". */
function cellsFor(rows: AgendaNoteRow[], project: string, sec: string, item: string) {
  const s = norm(sec), it = norm(item);
  const find = (wk: string) => rows.find((r) => r.project === project && r.week === wk && norm(r.item) === it && (!r.section || norm(r.section) === s));
  const now = new Date();
  const cur = find(weekKey(now));
  let last = cur && cur.last_week ? cur.last_week : '';
  if (!last) { const prev = find(weekKey(now, 1)); last = prev ? prev.this_week : ''; }
  const title = cur && cur.source ? 'From ' + cur.source : undefined;
  return { last, this: cur ? cur.this_week : '', up: cur ? cur.upcoming : '', title };
}

export default function AgendaView() {
  const { project } = useDashboard();
  const s = useAgendaNotes();
  const tableRef = useRef<HTMLTableElement>(null);
  const [copyLabel, setCopyLabel] = useState('Copy agenda');
  const rows = s.status === 'ok' ? s.data : [];
  const loading = s.status === 'loading';

  // Copy a plain-text agenda to the clipboard, read from the table as shown.
  const copy = () => {
    const lines = [(project ? project.name + ' — ' : '') + 'Weekly project meeting agenda', ''];
    tableRef.current?.querySelectorAll('.pt-ag-sec').forEach((sec) => {
      const band = sec.querySelector('.pt-ag-band th');
      lines.push(band ? (band.textContent || '').replace(/\s+/g, ' ').trim() : '');
      sec.querySelectorAll('tr:not(.pt-ag-band)').forEach((tr) => {
        const c = [...tr.children].map((td) => (td.textContent || '').trim());
        lines.push('   - ' + c[0] + (c.slice(1).some(Boolean) ? ' | Last week: ' + (c[1] || '—') + ' | This week: ' + (c[2] || '—') + ' | Upcoming: ' + (c[3] || '—') : ''));
      });
      lines.push('');
    });
    const done = () => { setCopyLabel('Copied'); setTimeout(() => setCopyLabel('Copy agenda'), 1500); };
    try { navigator.clipboard.writeText(lines.join('\n')).then(done, () => setCopyLabel('Copy failed')); } catch { setCopyLabel('Copy failed'); }
  };

  return (
    <section className="pt-card" id="project-agenda">
      <div className="pt-proj-head">
        <h2 className="pt-h2">Week {isoWeek(new Date())} Agenda{project ? <>: <b>{project.name}</b></> : null}</h2>
        <button type="button" className="pt-hidden-btn" onClick={copy}>{copyLabel}</button>
      </div>
      {s.status === 'error' && <div className="pt-empty">Failed to load the agenda notes.</div>}
      <div className="pt-table-wrap">
        <table className="pt-ag-table" id="agenda-outline" ref={tableRef}>
          <colgroup><col style={{ width: '34%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /><col style={{ width: '22%' }} /></colgroup>
          <thead><tr><th scope="col">Item</th><th scope="col">Last week</th><th scope="col">This week</th><th scope="col">Upcoming</th></tr></thead>
          {SECTIONS.map((sec, si) => (
            <tbody key={sec.id} className="pt-ag-sec" id={sec.id} style={{ ['--pt-ag-c' as string]: COLORS[0] }}>
              <tr className="pt-ag-band"><th colSpan={4} scope="colgroup"><span className="pt-ag-num">{si + 1}.</span> {sec.title}</th></tr>
              {sec.items.map((item) => {
                const c = project && s.status === 'ok' ? cellsFor(rows, project.name, sec.title, item) : null;
                const cls = 'pt-ag-cell' + (loading ? ' dash-skeleton' : '');
                return (
                  <tr key={item}>
                    <td className="pt-ag-item">{item}</td>
                    <td className={cls} title={c && c.last ? c.title : undefined}>{c ? c.last : ''}</td>
                    <td className={cls} title={c && c.this ? c.title : undefined}>{c ? c.this : ''}</td>
                    <td className={cls} title={c && c.up ? c.title : undefined}>{c ? c.up : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
