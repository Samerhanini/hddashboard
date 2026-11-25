// Made-up sample tasks and phases for the sample projects, shaped like the `projectTasks` and
// `projectPhases` loaders in reference/data-loaders.js. Generated from each project's dates and
// today's date so the views show a realistic mix of finished, current, overdue and upcoming work.

import type { PhaseRow, ProjectRow, TaskRow } from '../types';
import { sampleProjects } from './projects';

// Small seeded random generator so a project always gets the same sample data.
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const DAY = 864e5;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
// Zoho returns task dates as timestamps with an offset; mimic that (US Eastern).
const zohoTs = (t: number) => ymd(t) + 'T00:00:00-05:00';

const PHASES: Record<string, string[]> = {
  Development: ['Acquisition', 'Due Diligence', 'Entitlements', 'Schematic Design', 'Design Development', 'Financing', 'Construction Documents', 'Permitting'],
  Construction: ['Preconstruction', 'Procurement', 'Demolition', 'Rough-in', 'Finishes', 'Closeout'],
  Creative: ['Discovery', 'Concepts', 'Production', 'Launch'],
};
const TASKS = [
  'Review draft with sponsors', 'Collect consultant proposals', 'Update budget and schedule', 'Coordinate site visit',
  'Submit application package', 'Respond to agency comments', 'Issue RFI response', 'Prepare owner decision memo',
  'Order title and survey', 'Confirm insurance requirements', 'Finalize scope of work', 'Circulate meeting minutes',
  'Review shop drawings', 'Approve pay application', 'Schedule inspection', 'Send document set to lender',
];
const LISTS = ['General', 'Owner items', 'Consultants', 'Agency', 'Finance'];
const PEOPLE = ['Sample Person A', 'Sample Person B', 'Sample Person C', 'Sample Person D', 'Sample Person E'];
const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting on Others', 'Under Review'];
const PHASE_STATUS = {
  done: { name: 'Completed', color: '#3d9970', closed: true },
  active: { name: 'In Progress', color: '#2f6fbd', closed: false },
  late: { name: 'Delayed', color: '#c2412d', closed: false },
  next: { name: 'Not Started', color: '#8a8780', closed: false },
};

interface SampleSet { phases: PhaseRow[]; tasks: TaskRow[] }
const cache = new Map<string, { day: string; set: SampleSet }>();

function build(p: ProjectRow): SampleSet {
  const r = rng(p.id);
  const now = Date.now();
  // Projects named "...Leasing Website" have no phases, to show the empty state.
  const names = /website/i.test(p.name) ? [] : (PHASES[p.group] || PHASES.Development);
  const start = Date.parse(p.start_date || ymd(now - 120 * DAY));
  const end = Math.max(Date.parse(p.end_date || ymd(now + 300 * DAY)), start + 60 * DAY);
  const span = (end - start) / Math.max(names.length, 1);

  const phases: PhaseRow[] = names.map((name, i) => {
    const s = start + i * span - (i ? span * 0.15 * r() : 0);
    const e = start + (i + 1) * span + span * 0.1 * r();
    let st = e < now ? PHASE_STATUS.done : s <= now ? PHASE_STATUS.active : PHASE_STATUS.next;
    if (st === PHASE_STATUS.active && r() < 0.3) st = PHASE_STATUS.late;
    // One phase on the biggest HD project has no dates, to show the "isn't shown" note.
    const undated = p.id === '900000000000001' && i === names.length - 1;
    return {
      id: p.id + '0' + (i + 1), project_id: p.id, phase: name, owner: PEOPLE[Math.floor(r() * PEOPLE.length)],
      status: st.name, status_color: st.color, closed: st.closed,
      start_date: undated ? null : ymd(s), end_date: undated ? null : ymd(e),
    };
  });

  const tasks: TaskRow[] = [];
  const openPhases = phases.filter((ph) => !ph.closed);
  for (let i = 0; i < p.open_tasks; i++) {
    const ph = openPhases.length && r() < 0.85 ? openPhases[Math.floor(r() * openPhases.length)] : null;
    const base = ph && ph.start_date ? Math.max(Date.parse(ph.start_date), now - 45 * DAY) : now - 20 * DAY;
    const s = base + Math.floor(r() * 30) * DAY;
    const due = s + (3 + Math.floor(r() * 40)) * DAY - Math.floor(r() * 50) * DAY * (r() < 0.25 ? 1 : 0);
    const owners = r() < 0.1 ? 'Unassigned' : r() < 0.25 ? PEOPLE[i % 5] + ', ' + PEOPLE[(i + 2) % 5] : PEOPLE[Math.floor(r() * 5)];
    const noDates = r() < 0.07;
    tasks.push({
      id: p.id + '1' + String(i + 1).padStart(3, '0'), project_id: p.id,
      task: TASKS[Math.floor(r() * TASKS.length)] + (ph ? ' — ' + ph.phase.toLowerCase() : ''),
      tasklist: LISTS[Math.floor(r() * LISTS.length)], depth: r() < 0.2 ? 1 : 0, owners,
      status: OPEN_STATUSES[Math.floor(r() * OPEN_STATUSES.length)], completion: Math.floor(r() * 9) * 10,
      start: noDates ? null : zohoTs(Math.min(s, due - DAY)), due: noDates ? null : zohoTs(due),
      milestone_id: ph ? ph.id : '',
    });
  }
  return { phases, tasks };
}

/** Sample phases and open tasks for one sample project, or null if the id isn't a sample project. */
export function sampleProjectData(projectId: string): SampleSet | null {
  const p = sampleProjects.find((x) => x.id === projectId);
  if (!p) return null;
  const day = ymd(Date.now());
  const hit = cache.get(projectId);
  if (hit && hit.day === day) return hit.set;
  const set = build(p);
  cache.set(projectId, { day, set });
  return set;
}
