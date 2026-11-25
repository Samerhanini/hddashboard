'use client';

import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { useMeetings } from '@/lib/hooks';
import type { Dept, MeetingRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

// Removed meetings are remembered per browser, same key as the original.
const MEET_KEY = 'pt-hidden-meetings';

/** ptMeetForDept: HD sees meetings with no department prefix or "HD"; other departments only their own prefix. */
export function meetForDept(rows: MeetingRow[], dept: Dept): MeetingRow[] {
  return (rows || []).filter((m) => {
    const mm = String(m.meeting || '').toUpperCase().match(/^(HD|UC|BS|SK|SA)(?![A-Z])/);
    const code = mm ? mm[1] : '';
    return dept === 'HD' ? code === '' || code === 'HD' : code === dept;
  });
}

const fmtLong = d3.timeFormat('%a, %b %-d, %Y');
const fmtMo = d3.timeFormat('%b');

export default function MeetingsView() {
  const { project, dept, bldg } = useDashboard();
  const s = useMeetings(bldg);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [showRemoved, setShowRemoved] = useState(false);

  useEffect(() => {
    try { setRemoved(new Set((JSON.parse(localStorage.getItem(MEET_KEY) || '[]') as unknown[]).map(String))); } catch { /* storage blocked */ }
  }, []);

  const setMeetHidden = (id: string, hide: boolean) => setRemoved((prev) => {
    const next = new Set(prev);
    if (hide) next.add(id); else next.delete(id);
    try { localStorage.setItem(MEET_KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
    return next;
  });

  const deptRows = s.status === 'ok' ? meetForDept(s.data, dept) : [];
  const removedCount = deptRows.filter((m) => removed.has(m.id)).length;

  let list: React.ReactNode = null;
  const msg = (t: string) => <div className="pt-empty">{t}</div>;
  if (s.status === 'error') list = msg('Failed to load');
  else if (s.status === 'ok') {
    const shown = deptRows.filter((m) => removed.has(m.id) === showRemoved);
    if (!deptRows.length) list = msg('No ' + dept + ' meeting notes found for this project.');
    else if (!shown.length) list = msg(showRemoved ? 'No removed meetings for this project.' : 'All meetings for this project have been removed.');
    else {
      list = (
        <>
          {shown.slice().sort((a, b) => Date.parse(b.date || '0') - Date.parse(a.date || '0')).map((m) => <MeetingCard key={m.id} m={m} removedMode={showRemoved} onToggle={() => setMeetHidden(m.id, !showRemoved)} />)}
          {s.truncated && msg('Showing the 50 most recent meetings. Older notes are in Google Drive.')}
        </>
      );
    }
  }

  const sub = dept === 'HD'
    ? 'Gemini notes from Google Drive whose meeting title contains “' + (bldg || '') + '”, excluding other departments’ meetings, newest first'
    : 'Gemini notes whose title contains “' + (bldg || '') + '” and starts with ' + dept + ', newest first';

  return (
    <section className="pt-card" id="project-meetings">
      <div className="pt-proj-head">
        <h2 className="pt-h2">{project ? project.name + ' — meetings' : 'Meetings'}</h2>
        <button type="button" className="pt-hidden-btn" hidden={!removedCount && !showRemoved} aria-pressed={showRemoved} onClick={() => setShowRemoved((v) => !v)}>
          {showRemoved ? 'Back to meetings' : 'Removed (' + removedCount + ')'}
        </button>
      </div>
      <p className="pt-sub">{sub}</p>
      <div className={'pt-meet-list' + (s.status === 'loading' ? ' dash-skeleton' : '')} style={s.status === 'loading' ? { minHeight: 120 } : undefined}>{list}</div>
    </section>
  );
}

function MeetingCard({ m, removedMode, onToggle }: { m: MeetingRow; removedMode: boolean; onToggle: () => void }) {
  const dt = m.date ? new Date(m.date) : null;
  const steps = m.next_steps ? m.next_steps.split('\n').filter(Boolean) : [];
  let day = '';
  if (dt) {
    const dn = dt.getDate();
    const sfx = dn % 100 >= 11 && dn % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[dn % 10] || 'th';
    day = dn + sfx;
  }
  return (
    <div className="pt-meet">
      <div className="pt-cal" title={dt ? fmtLong(dt) : undefined}>
        {dt && <><span className="pt-cal-mo">{fmtMo(dt)}</span><span className="pt-cal-day">{day}</span><span className="pt-cal-yr">{dt.getFullYear()}</span></>}
      </div>
      <div className="pt-meet-body">
        <div className="pt-meet-head">
          <a className="pt-meet-title" target="_blank" rel="noopener" href={/^https?:\/\//.test(m.url || '') ? m.url : undefined}>{m.meeting}</a>
          <span className="pt-meet-right">
            <button type="button" className="pt-meet-x" onClick={onToggle}
              title={removedMode ? 'Restore this meeting' : 'Remove this meeting from the list'}
              aria-label={(removedMode ? 'Restore ' : 'Remove ') + m.meeting}>×</button>
          </span>
        </div>
        {m.summary && <p className="pt-meet-sum">{m.summary}</p>}
        {steps.length > 0 && (
          <details>
            <summary>Next steps ({steps.length}{/…$/.test(steps[steps.length - 1]) ? '+' : ''})</summary>
            <ul>{steps.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}
