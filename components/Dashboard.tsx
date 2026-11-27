'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEPTS, VIEWS, type Dept, type ProjectRow, type View } from '@/lib/types';
import { bldgOf, clientMatches, deptProjects, firstProject } from '@/lib/rules';
import { useDataset } from '@/lib/useDataset';
import { DashboardContext, type DashboardState } from './DashboardContext';
import DeptTabs from './DeptTabs';
import ProjectBrowser from './ProjectBrowser';
import ViewNav from './ViewNav';
import ViewSections from './ViewSections';

// Per-browser settings, same keys as the original so the behaviour matches.
const HIDDEN_KEY = 'pt-hidden-projects';
const VIEW_KEY = 'pt-project-view';

function readHidden(): Set<string> {
  try { return new Set((JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]') as unknown[]).map(String)); } catch { return new Set(); }
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
  const [client, setClient] = useState<string | null>(null);

  // Browser-only state is read after mount so the server render and first client render agree.
  useEffect(() => {
    setHiddenSet(readHidden());
    // The local "completed" marking was removed (Nov 27, 2026): status is set in Zoho now.
    try { localStorage.removeItem('pt-completed-projects'); } catch { /* storage blocked */ }
    setView(readView());
    const h = deptFromHash();
    if (h) setDept(h);
    const onHash = () => { const d = deptFromHash(); if (d) { setDept(d); setProjectId(null); } };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const rows = projects.data;

  // ptKeepProjectInDept: keep the selected project inside the current department (and client filter).
  useEffect(() => {
    if (projects.status !== 'ok') return;
    const list = deptProjects(rows, dept, hidden, 'all').filter((p) => clientMatches(p, client));
    if (!list.length) { if (projectId !== null) setProjectId(null); return; }
    if (!projectId || !list.some((p) => p.id === projectId)) {
      const first = list.find((p) => !hidden.has(p.id)) || list[0];
      setProjectId(first.id);
    }
  }, [projects.status, rows, dept, hidden, projectId, client]);

  const project = useMemo(() => rows.find((p) => p.id === projectId) || null, [rows, projectId]);

  const selectDept = useCallback((d: Dept) => {
    setDept(d);
    setProjectId(firstProject(rows, d, hidden));
    setShowHidden(false);
    history.replaceState(null, '', '#' + d);
    window.scrollTo({ top: 0 });
  }, [rows, hidden]);

  const selectProject = useCallback((id: string) => {
    setProjectId(id);
  }, []);

  const selectView = useCallback((v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  }, []);

  // ptSetHidden: hiding the selected project moves the selection to the first visible one.
  const setHidden = useCallback((id: string, hide: boolean) => {
    const nextHidden = new Set(hidden);
    if (hide) nextHidden.add(id); else nextHidden.delete(id);
    setHiddenSet(nextHidden);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...nextHidden])); } catch { /* storage blocked */ }
    if (hide && id === projectId) {
      const vis = deptProjects(rows, dept, nextHidden, 'visible').filter((p) => clientMatches(p, client));
      if (vis.length) setProjectId(vis[0].id);
    }
  }, [rows, dept, projectId, hidden, client]);

  const state: DashboardState = {
    dept, view, projectId, project, projects, hidden, showHidden, client,
    bldg: project ? bldgOf(project.name) : null,
    selectDept, selectProject, selectView, setHidden, setClient,
    toggleShowHidden: () => { setShowHidden((s) => !s); },
  };

  return (
    <DashboardContext.Provider value={state}>
      <div className="pt-wrap">
        <ViewNav />
        <DeptTabs />
        {projects.source === 'sample' && (
          <p className="pt-notice">Showing sample data. Live Zoho projects appear once the Zoho credentials are set.</p>
        )}
        <ProjectBrowser />
        <ViewSections />
      </div>
    </DashboardContext.Provider>
  );
}
