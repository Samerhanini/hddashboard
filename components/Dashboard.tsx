'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPTS, VIEWS, type Dept, type ProjectRow, type View } from '@/lib/types';
import { bldgOf, deptProjects, firstProject } from '@/lib/rules';
import { useDataset } from '@/lib/useDataset';
import { DashboardContext, type DashboardState } from './DashboardContext';
import DeptTabs from './DeptTabs';
import ProjectBrowser from './ProjectBrowser';
import ViewNav from './ViewNav';
import ViewSections from './ViewSections';

// Per-browser settings, same keys as the original so the behaviour matches.
const HIDDEN_KEY = 'pt-hidden-projects';
const COMPLETED_KEY = 'pt-completed-projects';
const VIEW_KEY = 'pt-project-view';

function readHidden(): Set<string> {
  try { return new Set((JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]') as unknown[]).map(String)); } catch { return new Set(); }
}
function readCompleted(): Set<string> {
  try { return new Set((JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]') as unknown[]).map(String)); } catch { return new Set(); }
}
function readView(): View {
  try { const v = localStorage.getItem(VIEW_KEY); if (v && (VIEWS as string[]).includes(v)) return v as View; } catch { /* storage blocked */ }
  return 'schedule';
}
function deptFromHash(): Dept | null {
  const h = String(location.hash || '').replace('#', '').toUpperCase();
  return (DEPTS as string[]).includes(h) ? (h as Dept) : null;
}

export default function Dashboard() {
  const projects = useDataset<ProjectRow>('/api/projects');
  const [dept, setDept] = useState<Dept>('HD');
  const [view, setView] = useState<View>('schedule');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hidden, setHiddenSet] = useState<Set<string>>(() => new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [completed, setCompletedSet] = useState<Set<string>>(() => new Set());
  const [showCompleted, setShowCompleted] = useState(false);

  // Browser-only state is read after mount so the server render and first client render agree.
  useEffect(() => {
    setHiddenSet(readHidden());
    setCompletedSet(readCompleted());
    setView(readView());
    const h = deptFromHash();
    if (h) setDept(h);
    const onHash = () => { const d = deptFromHash(); if (d) { setDept(d); setProjectId(null); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const rows = projects.data;

  // ptKeepProjectInDept: keep the selected project inside the current department.
  useEffect(() => {
    if (projects.status !== 'ok') return;
    const list = deptProjects(rows, dept, hidden, 'all', completed);
    if (!list.length) { if (projectId !== null) setProjectId(null); return; }
    if (!projectId || !list.some((p) => p.id === projectId)) setProjectId(firstProject(rows, dept, hidden, completed) || list[0].id);
  }, [projects.status, rows, dept, hidden, completed, projectId]);

  const project = useMemo(() => rows.find((p) => p.id === projectId) || null, [rows, projectId]);

  const selectDept = useCallback((d: Dept) => {
    setDept(d);
    setProjectId(firstProject(rows, d, hidden, completed));
    setShowHidden(false);
    setShowCompleted(false);
    history.replaceState(null, '', '#' + d);
    window.scrollTo({ top: 0 });
  }, [rows, hidden, completed]);

  const selectProject = useCallback((id: string) => {
    setProjectId(id);
    document.getElementById('project-views')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const selectView = useCallback((v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  }, []);

  // ptSetHidden: hiding the selected project moves the selection to the first visible one.
  // Hidden and completed are mutually exclusive: hiding a project un-marks it completed.
  const setHidden = useCallback((id: string, hide: boolean) => {
    const nextHidden = new Set(hidden);
    if (hide) nextHidden.add(id); else nextHidden.delete(id);
    const nextCompleted = new Set(completed);
    if (hide) nextCompleted.delete(id);
    setHiddenSet(nextHidden);
    setCompletedSet(nextCompleted);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...nextHidden])); } catch { /* storage blocked */ }
    try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...nextCompleted])); } catch { /* storage blocked */ }
    if (hide && id === projectId) {
      const vis = deptProjects(rows, dept, nextHidden, 'visible', nextCompleted);
      if (vis.length) setProjectId(vis[0].id);
    }
  }, [rows, dept, projectId, hidden, completed]);

  // Completing the selected project moves the selection to the first visible one.
  // Completing a project un-hides it; un-completing returns it to the visible list.
  const setCompleted = useCallback((id: string, done: boolean) => {
    const nextCompleted = new Set(completed);
    if (done) nextCompleted.add(id); else nextCompleted.delete(id);
    const nextHidden = new Set(hidden);
    if (done) nextHidden.delete(id);
    setCompletedSet(nextCompleted);
    setHiddenSet(nextHidden);
    try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...nextCompleted])); } catch { /* storage blocked */ }
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...nextHidden])); } catch { /* storage blocked */ }
    if (done && id === projectId) {
      const vis = deptProjects(rows, dept, nextHidden, 'visible', nextCompleted);
      if (vis.length) setProjectId(vis[0].id);
    }
  }, [rows, dept, projectId, hidden, completed]);

  // "a": make a project active again — clears both its hidden and completed marks.
  const setActive = useCallback((id: string) => {
    const nextHidden = new Set(hidden);
    nextHidden.delete(id);
    const nextCompleted = new Set(completed);
    nextCompleted.delete(id);
    setHiddenSet(nextHidden);
    setCompletedSet(nextCompleted);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...nextHidden])); } catch { /* storage blocked */ }
    try { localStorage.setItem(COMPLETED_KEY, JSON.stringify([...nextCompleted])); } catch { /* storage blocked */ }
  }, [hidden, completed]);

  const state: DashboardState = {
    dept, view, projectId, project, projects, hidden, showHidden, completed, showCompleted,
    bldg: project ? bldgOf(project.name) : null,
    selectDept, selectProject, selectView, setHidden, setCompleted, setActive,
    toggleShowHidden: () => { setShowHidden((s) => !s); setShowCompleted(false); },
    toggleShowCompleted: () => { setShowCompleted((s) => !s); setShowHidden(false); },
  };

  return (
    <DashboardContext.Provider value={state}>
      <div className="pt-wrap">
        <DeptTabs />
        {projects.source === 'sample' && (
          <p className="pt-notice">Showing sample data. Live Zoho projects appear once the Zoho credentials are set.</p>
        )}
        <ProjectBrowser />
        <ViewNav />
        <ViewSections />
      </div>
    </DashboardContext.Provider>
  );
}
