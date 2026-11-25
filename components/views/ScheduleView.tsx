'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { COLORS } from '@/lib/rules';
import { useProjectPhases, useProjectTasks } from '@/lib/hooks';
import type { PhaseRow, TaskRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

type Phase = PhaseRow & { s: Date | null; e: Date | null };

const parseUtc = d3.utcParse('%Y-%m-%d');
/** ptStatusColor: Zoho's status colour when it's a #rrggbb value, otherwise a series colour. */
const statusColor = (r: PhaseRow, i: number) => (/^#[0-9a-fA-F]{6}$/.test(r.status_color || '') ? r.status_color : COLORS[i % COLORS.length]);

/** Schedule view: phaseTitle, phaseLegend, phaseGantt and phaseEmpty in the original. */
export default function ScheduleView() {
  const { project, projectId } = useDashboard();
  const ph = useProjectPhases(projectId);
  const ts = useProjectTasks(projectId);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // ptPhaseRows
  const rows: Phase[] | null = useMemo(() => {
    if (ph.status !== 'ok') return null;
    return ph.data.filter((r) => !r.project_id || r.project_id === projectId).map((r) => ({
      ...r,
      s: r.start_date ? parseUtc(String(r.start_date).slice(0, 10)) : null,
      e: r.end_date ? parseUtc(String(r.end_date).slice(0, 10)) : null,
    }));
  }, [ph.status, ph.data, projectId]);

  const tasks = useMemo(
    () => (ts.status === 'ok' ? ts.data.filter((t) => !t.project_id || t.project_id === projectId) : []),
    [ts.status, ts.data, projectId],
  );

  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    (rows || []).forEach((r) => { if (!seen.has(r.status)) seen.set(r.status, statusColor(r, seen.size)); });
    return [...seen.entries()];
  }, [rows]);

  let empty: string | null = null;
  if (ph.status === 'error') empty = 'Failed to load';
  else if (rows) {
    const undated = rows.filter((r) => !(r.s && r.e)).length;
    if (!rows.length) empty = 'This project has no phases in Zoho.';
    else if (undated) empty = undated + (undated === 1 ? ' phase has' : ' phases have') + ' no start or end date and isn’t shown.';
  }

  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="pt-card" id="project-phases">
      <h2 className="pt-h2">{project ? project.name + ' — phases' : 'Phases'}</h2>
      <div className="pt-legend">
        {rows && rows.length > 0 && (
          <>
            {legend.map(([name, c]) => <span key={name}><i style={{ background: c }} />{name || 'No status'}</span>)}
            <span><i style={{ background: 'var(--color-bad)', width: 2 }} />Today</span>
          </>
        )}
      </div>
      <Gantt loading={ph.status === 'loading'} rows={rows} tasks={tasks} expanded={expanded} onToggle={toggle} />
      {empty && <div className="pt-empty">{empty}</div>}
    </section>
  );
}

function tipLines(lines: [string, boolean?][]) {
  return lines.map(([t, muted]) => { const d = document.createElement('div'); d.textContent = t; if (muted) d.className = 'pt-tip-muted'; return d; });
}

type Entry =
  | { kind: 'phase'; r: Phase; n: number; h: number; y: number }
  | { kind: 'empty'; r: Phase; h: number; y: number }
  | { kind: 'task'; r: Phase; t: TaskRow; s: Date | null; e: Date | null; h: number; y: number };

/** phaseGantt: drawn imperatively with d3, as in the original. Click a phase to show its open tasks. */
function Gantt({ loading, rows, tasks, expanded, onToggle }: {
  loading: boolean; rows: Phase[] | null; tasks: TaskRow[]; expanded: Set<string>; onToggle: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    if (!rows) return;
    const dated = rows.filter((r): r is Phase & { s: Date; e: Date } => !!(r.s && r.e)).sort((a, b) => +a.s - +b.s || +a.e - +b.e);
    if (!dated.length) return;

    const colorBy = new Map<string, string>();
    rows.forEach((r) => { if (!colorBy.has(r.status)) colorBy.set(r.status, statusColor(r, colorBy.size)); });
    const byPhase = d3.group(tasks, (t) => t.milestone_id || '');
    const parseD = (v: string | null) => (v ? new Date(v) : null);
    const W = Math.max(width || el.clientWidth || 700, 560);
    const narrow = W < 700;
    const left = narrow ? 150 : 240, right = 16, top = 26, rowH = 28, taskH = 22, barH = 16;

    const entries: Entry[] = [];
    dated.forEach((r) => {
      const list = (byPhase.get(r.id) || []).slice().sort((a, b) => (Date.parse(a.due || '') || Infinity) - (Date.parse(b.due || '') || Infinity));
      entries.push({ kind: 'phase', r, n: list.length, h: rowH, y: 0 });
      if (expanded.has(r.id)) {
        if (!list.length) entries.push({ kind: 'empty', r, h: taskH, y: 0 });
        list.forEach((t) => entries.push({ kind: 'task', r, t, s: parseD(t.start), e: parseD(t.due), h: taskH, y: 0 }));
      }
    });
    let y = top; entries.forEach((en) => { en.y = y; y += en.h; });
    const H = y + 8;

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const lo = d3.min(dated, (r) => r.s)!, hi = d3.max(dated, (r) => r.e)!;
    const x = d3.scaleUtc()
      .domain([d3.utcMonth.floor(d3.min([lo, today])!), d3.utcMonth.ceil(d3.max([hi, today])!)])
      .range([left, W - right]);
    const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    const [d0, d1] = x.domain();
    const spanYears = (+d1 - +d0) / (365 * 864e5);
    const ticks = spanYears > 2.5 ? x.ticks(d3.utcYear.every(1)!) : x.ticks(d3.utcMonth.every(spanYears > 1.2 ? 3 : 1)!);
    const tf = spanYears > 2.5 ? d3.utcFormat('%Y') : d3.utcFormat('%b %Y');
    svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'pt-g-grid')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top - 6).attr('y2', H - 4);
    svg.append('g').selectAll('text').data(ticks.filter((d) => x(d) + 56 <= W - right)).join('text')
      .attr('x', (d) => x(d) + 3).attr('y', top - 10).text(tf);

    const tip = document.createElement('div'); tip.className = 'pt-tip'; tip.hidden = true;
    const fmt = d3.utcFormat('%b %-d, %Y');
    const fmtL = d3.timeFormat('%b %-d, %Y');
    const showTip = (ev: MouseEvent, lines: [string, boolean?][]) => {
      tip.replaceChildren(...tipLines(lines)); tip.hidden = false;
      const box = el.getBoundingClientRect();
      tip.style.left = Math.min(ev.clientX - box.left + el.scrollLeft + 12, el.scrollWidth - 250) + 'px';
      tip.style.top = (ev.clientY - box.top + 14) + 'px';
    };
    const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

    entries.forEach((en) => {
      const g = svg.append('g').attr('transform', `translate(0,${en.y})`);
      if (en.kind === 'phase') {
        const r = en.r, open = expanded.has(r.id);
        g.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', en.h).attr('fill', 'transparent')
          .style('cursor', 'pointer').on('click', () => onToggle(r.id));
        g.append('text').attr('class', 'pt-g-label').attr('x', 0).attr('y', en.h / 2 + 4).style('cursor', 'pointer')
          .text((open ? '▾ ' : '▸ ') + clip(r.phase, narrow ? 15 : 24) + (en.n ? ' (' + en.n + ')' : ''))
          .on('click', () => onToggle(r.id));
        g.append('rect').attr('x', x(r.s!)).attr('y', (en.h - barH) / 2).attr('height', barH).attr('rx', 3)
          .attr('width', Math.max(3, x(r.e!) - x(r.s!))).attr('fill', colorBy.get(r.status)!).attr('opacity', r.closed ? 0.45 : 1)
          .style('cursor', 'pointer')
          .on('mousemove', (ev: MouseEvent) => showTip(ev, [[r.phase], [fmt(r.s!) + ' – ' + fmt(r.e!), true], [r.status + (r.owner ? ' · ' + r.owner : ''), true], [en.n + ' open task' + (en.n === 1 ? '' : 's') + ' · click to ' + (open ? 'collapse' : 'expand'), true]]))
          .on('mouseleave', () => { tip.hidden = true; })
          .on('click', () => { tip.hidden = true; onToggle(r.id); });
      } else if (en.kind === 'empty') {
        g.append('text').attr('x', 18).attr('y', en.h / 2 + 4).text('No open tasks in this phase');
      } else {
        const t = en.t, nowMs = Date.now();
        const late = !!en.e && en.e.getTime() < nowMs;
        g.append('text').attr('x', 18).attr('y', en.h / 2 + 4).text(clip(t.task, narrow ? 20 : 34)).append('title').text(t.task);
        const color = colorBy.get(en.r.status)!;
        if (en.s && en.e && en.e > en.s) {
          g.append('rect').attr('x', x(en.s)).attr('y', (en.h - 8) / 2).attr('height', 8).attr('rx', 2)
            .attr('width', Math.max(3, x(en.e) - x(en.s))).attr('fill', late ? 'var(--color-bad)' : color).attr('opacity', 0.7);
        }
        if (en.e) g.append('circle').attr('cx', x(en.e)).attr('cy', en.h / 2).attr('r', 4).attr('fill', late ? 'var(--color-bad)' : color);
        else g.append('text').attr('x', left).attr('y', en.h / 2 + 4).text('no dates');
        g.append('rect').attr('x', left).attr('y', 0).attr('width', W - left).attr('height', en.h).attr('fill', 'transparent')
          .on('mousemove', (ev: MouseEvent) => showTip(ev, [[t.task], [(en.s ? fmtL(en.s) + ' – ' : '') + (en.e ? 'due ' + fmtL(en.e) : 'no due date'), true], [t.status + ' · ' + t.owners, true]]))
          .on('mouseleave', () => { tip.hidden = true; });
      }
    });
    const tx = x(today);
    svg.append('line').attr('class', 'pt-g-today').attr('x1', tx).attr('x2', tx).attr('y1', top - 6).attr('y2', H - 4);
    el.appendChild(tip);
  }, [rows, tasks, expanded, width, onToggle]);

  return (
    <div ref={ref} className={'pt-gantt' + (loading ? ' dash-skeleton' : '')} style={loading ? { minHeight: 160 } : undefined}
      role="img" aria-label="Gantt chart of the selected project’s phases" />
  );
}
