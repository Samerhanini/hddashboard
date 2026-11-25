/*
  UI code from the original dashboard (copied from the live page; a few blocks that drew elements no longer
  on the page were left out). Uses d3 v7.

  The original ran inside Claude's dashboard runtime, which provided `dash`:
    dash.data(id)        -> { status: 'ok'|'loading'|'error'|..., data: rows, message, truncated }
    dash.params()        -> current filters, e.g. { dept: 'HD', project_id: '123', bldg: '609', crmq: 'smith' }
    dash.setParams(obj)  -> merge filters; any dataset whose args use {{name}} re-fetches, then everything redraws
    dash.draw(name, fn)  -> run fn(el) for every element with data-draw="name"; re-run whenever data/params change
    dash.onData(fn)      -> run fn whenever data or params change
    dash.refresh(id)     -> re-fetch one dataset
    dash.setLink(name)   -> set the URL hash (#HD / #UC / #BS)
    dash.colors          -> series colors array (see --series-* in styles.css)
  and window.claude.use('mcp').callTool(connector, tool, args) for the Google Sheets write-backs.

  In the website: replace `dash` with React state + data fetching (e.g. SWR / React Query) against your own
  /api routes, and replace callTool(...) with POSTs to server routes that use the Google Sheets API.
  Each dash.draw block below maps naturally to one React component.
*/

const fmtNum = d3.format(',');
const fmtDay = d3.timeFormat('%b %-d, %Y');
const fmtUsd = d3.format('$,.0f');

window.ptDept = () => String((dash.params() || {}).dept || 'HD').toUpperCase();
window.ptInDept = (name, dept) => String(name || '').toUpperCase().startsWith(dept);

function tipLines(lines) {
  return lines.map(([t, muted]) => { const d = document.createElement('div'); d.textContent = t; if (muted) d.className = 'pt-tip-muted'; return d; });
}

/* =====================================================================
   Departments, project selection, hidden projects, views
   Projects belong to a department by name prefix: HD..., UC..., BS...
   ===================================================================== */
function syncTabs() {
  const d = ptDept();
  document.querySelectorAll('.pt-tab').forEach((b) => {
    const on = b.getAttribute('data-dept') === d;
    b.classList.toggle('pt-tab-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  try { ptApplyView(); } catch (e) {}
}
const PT_DEPTS = ['HD', 'UC', 'BS'];

// Building key used to find meeting notes: "HD609BRO-..." -> "609"; "HD12Main-..." -> "12 Main"
function ptBldgOf(name) {
  const seg = String(name || '').slice(2).replace(/^[-\s]+/, '').split('-')[0];
  const m = seg.match(/^(\d+)([A-Za-z]*)/);
  let v;
  if (m && m[1].length >= 3) v = m[1];
  else if (m) v = m[1] + ' ' + (m[2].charAt(0).toUpperCase() + m[2].slice(1, 4).toLowerCase());
  else v = seg;
  v = String(v).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 30);
  return v.length >= 2 ? v : 'none';
}
function ptProjParams(id) {
  const s = dash.data('projects');
  const p = s.status === 'ok' ? s.data.find((r) => r.id === String(id)) : null;
  return p ? { project_id: String(id), bldg: ptBldgOf(p.name) } : { project_id: String(id) };
}

// Hidden projects are per-browser (localStorage)
const PT_HIDDEN_KEY = 'pt-hidden-projects';
let ptHidden = new Set();
try { ptHidden = new Set(JSON.parse(localStorage.getItem(PT_HIDDEN_KEY) || '[]').map(String)); } catch (e) { ptHidden = new Set(); }
let ptShowHidden = false;
function ptSaveHidden() { try { localStorage.setItem(PT_HIDDEN_KEY, JSON.stringify([...ptHidden])); } catch (e) {} }
function ptSetHidden(id, hide) {
  if (hide) ptHidden.add(id); else ptHidden.delete(id);
  ptSaveHidden();
  if (hide && String(dash.params().project_id || '') === id) {
    const vis = ptDeptProjects(ptDept(), 'visible');
    if (vis.length) dash.setParams(ptProjParams(vis[0].id));
  }
  dash.draw('projectIcons'); dash.draw('hiddenToggle');
}
// Projects of a department, excluding Completed/Cancelled, natural sort by name
function ptDeptProjects(dept, which) {
  const s = dash.data('projects');
  if (s.status !== 'ok') return [];
  const want = which || 'visible';
  return s.data.filter((p) => ptInDept(p.name, dept) && p.status !== 'Completed' && p.status !== 'Cancelled' && (want === 'all' || (want === 'hidden') === ptHidden.has(p.id)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
function ptFirstProject(dept) { const l = ptDeptProjects(dept, 'visible').length ? ptDeptProjects(dept, 'visible') : ptDeptProjects(dept, 'all'); return l.length ? l[0].id : null; }
function ptKeepProjectInDept() {
  const list = ptDeptProjects(ptDept(), 'all');
  if (!list.length) return;
  const cur = String(dash.params().project_id || '');
  const curP = list.find((p) => p.id === cur);
  if (!curP) { dash.setParams(ptProjParams(ptFirstProject(ptDept()) || list[0].id)); return; }
  const want = ptBldgOf(curP.name);
  if (String(dash.params().bldg || '') !== want) dash.setParams({ bldg: want });
}
dash.onData(ptKeepProjectInDept);
dash.onData(() => { if (!PT_DEPTS.includes(ptDept())) dash.setParams(Object.assign({ dept: 'HD' }, ptProjParams(ptFirstProject('HD') || dash.params().project_id))); });

// Views (Overview / Agenda / Schedule / Finance / Tasks / Meetings), remembered per browser. Default: schedule
const PT_VIEW_KEY = 'pt-project-view';
let ptView = 'schedule';
try { const v = localStorage.getItem(PT_VIEW_KEY); if (['overview', 'finance', 'schedule', 'meetings', 'agenda', 'tasks'].includes(v)) ptView = v; } catch (e) {}
function ptApplyView() {
  document.querySelectorAll('.pt-view').forEach((b) => {
    const on = b.getAttribute('data-view') === ptView;
    b.classList.toggle('pt-view-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  const dpt = ptDept();
  document.querySelectorAll('[data-view-section]').forEach((s) => {
    const only = (s.getAttribute('data-only-depts') || '').split(',').filter(Boolean);
    const hide = (s.getAttribute('data-hide-depts') || '').split(',').filter(Boolean);
    const off = s.getAttribute('data-view-section') !== ptView || (only.length && !only.includes(dpt)) || hide.includes(dpt);
    s.classList.toggle('pt-hide', !!off);
  });
}
document.querySelectorAll('.pt-view').forEach((b) => b.addEventListener('click', () => {
  ptView = b.getAttribute('data-view');
  try { localStorage.setItem(PT_VIEW_KEY, ptView); } catch (e) {}
  ptApplyView();
  if (ptView === 'schedule') dash.draw('phaseGantt');
  dash.draw('projectIcons');
}));
ptApplyView();

// Agenda: band color + "Copy agenda" button (plain-text agenda to clipboard)
document.querySelectorAll('.pt-ag-sec').forEach((s) => { s.style.setProperty('--pt-ag-c', dash.colors[0]); });
document.querySelectorAll('#pt-copy-agenda').forEach((btn) => btn.addEventListener('click', () => {
  const p = ptCurrentProject();
  const lines = [(p ? p.name + ' — ' : '') + 'Weekly project meeting agenda', ''];
  document.querySelectorAll('#agenda-outline .pt-ag-sec').forEach((sec) => {
    const band = sec.querySelector('.pt-ag-band th');
    lines.push(band ? band.textContent.replace(/\s+/g, ' ').trim() : '');
    sec.querySelectorAll('tr:not(.pt-ag-band)').forEach((tr) => {
      const c = [...tr.children].map((td) => td.textContent.trim());
      lines.push('   - ' + c[0] + (c.slice(1).some(Boolean) ? ' | Last week: ' + (c[1] || '—') + ' | This week: ' + (c[2] || '—') + ' | Upcoming: ' + (c[3] || '—') : ''));
    });
    lines.push('');
  });
  const txt = lines.join('\n');
  const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy agenda'; }, 1500); };
  try { navigator.clipboard.writeText(txt).then(done, () => { btn.textContent = 'Copy failed'; }); } catch (e) { btn.textContent = 'Copy failed'; }
}));

// Department from URL hash (#HD, #UC, #BS) and department tab clicks
function ptOpenFromHash() {
  const h = String(location.hash || '').replace('#', '').toUpperCase();
  if (PT_DEPTS.includes(h) && h !== ptDept()) { dash.setParams(Object.assign({ dept: h }, ptProjParams(ptFirstProject(h) || dash.params().project_id))); syncTabs(); }
}
ptOpenFromHash();
window.addEventListener('hashchange', ptOpenFromHash);
document.querySelectorAll('.pt-tab').forEach((b) => {
  b.addEventListener('click', () => {
    const d = b.getAttribute('data-dept');
    dash.setParams(Object.assign({ dept: d }, ptProjParams(ptFirstProject(d) || dash.params().project_id)));
    dash.setLink(d);
    syncTabs();
    window.scrollTo({ top: 0 });
  });
});
dash.onData(syncTabs);

dash.draw('deptBadge', (b) => {
  b.style.background = dash.colors[Number(b.getAttribute('data-dept-color')) % dash.colors.length];
  b.textContent = b.getAttribute('data-dept');
});

dash.draw('deptCount', (el) => {
  const s = dash.data('projects');
  if (s.status !== 'ok') { el.textContent = s.status === 'error' ? 'Failed to load' : '—'; return; }
  const d = el.getAttribute('data-dept');
  const act = s.data.filter((p) => ptInDept(p.name, d) && p.status === 'Active');
  const open = act.reduce((n, p) => n + p.open_tasks, 0);
  el.textContent = act.length + ' active · ' + fmtNum(open) + ' open tasks';
});

function ptBadge(name, dept) {
  let s = String(name || '').slice(dept.length).replace(/^[-\s]+/, '');
  s = s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  return s || dept;
}

// Project tiles. In the Finance view, tiles with QuickBooks (UC) or AppFolio (HD) activity are highlighted green.
dash.draw('projectIcons', (el) => {
  const s = dash.data('projects');
  el.classList.toggle('dash-skeleton', s.status === 'loading');
  el.replaceChildren();
  if (s.status === 'error') { const p = document.createElement('div'); p.className = 'pt-empty'; p.textContent = 'Failed to load'; el.appendChild(p); return; }
  if (s.status !== 'ok') return;
  const dept = ptDept();
  const list = ptDeptProjects(dept, ptShowHidden ? 'hidden' : 'visible');
  if (!list.length) { const p = document.createElement('div'); p.className = 'pt-empty'; p.textContent = ptShowHidden ? 'No hidden projects in ' + dept + '.' : 'No projects to show in ' + dept + '.'; el.appendChild(p); return; }
  const cur = String(dash.params().project_id || '');
  const qs = dash.data('qbSales'), qa = dash.data('qbAR');
  const finOn = ptView === 'finance';
  const qbOn = finOn && dept === 'UC' && qs.status === 'ok' && qa.status === 'ok';
  const hasFin = (p) => {
    if (!finOn) return false;
    if (qbOn) { const s = ptQbMatch(qs.data, p), a = ptQbMatch(qa.data, p); if ((s && s.total_sales) || (a && a.total)) return true; }
    return dept === 'HD' && ptAfHasActivity(p);
  };
  list.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const fin = hasFin(p);
    b.className = 'pt-icon' + (p.id === cur ? ' pt-icon-on' : '') + (p.status === 'Active' || fin ? '' : ' pt-icon-dim') + (fin ? ' pt-icon-fin' : '');
    b.setAttribute('aria-pressed', String(p.id === cur));
    b.title = p.name + ' (' + p.status + ')';
    if (fin) b.title += ' · has QuickBooks or AppFolio activity';
    const badge = document.createElement('span');
    badge.className = 'pt-icon-badge';
    badge.style.background = dash.colors[i % dash.colors.length];
    badge.textContent = ptBadge(p.name, dept);
    const txt = document.createElement('span');
    txt.className = 'pt-icon-text';
    const nm = document.createElement('span');
    nm.className = 'pt-icon-name';
    nm.textContent = p.name;
    const meta = document.createElement('span');
    meta.className = 'pt-icon-meta';
    const n = document.createElement('span');
    n.textContent = fmtNum(p.open_tasks);
    meta.append(n, document.createTextNode(' open' + (p.status === 'Active' ? '' : ' · ' + p.status)));
    txt.append(nm, meta);
    b.append(badge, txt);
    b.addEventListener('click', () => {
      dash.setParams(ptProjParams(p.id));
      const t = document.getElementById('project-tasks');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const wrap = document.createElement('div');
    wrap.className = 'pt-icon-wrap';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'pt-icon-x';
    x.textContent = '×';
    x.title = ptShowHidden ? 'Show this project again' : 'Hide this project';
    x.setAttribute('aria-label', (ptShowHidden ? 'Unhide ' : 'Hide ') + p.name);
    x.addEventListener('click', (ev) => { ev.stopPropagation(); ptSetHidden(p.id, !ptShowHidden); });
    wrap.append(b, x);
    el.appendChild(wrap);
  });
});

dash.draw('hiddenToggle', (btn) => {
  const n = ptDeptProjects(ptDept(), 'hidden').length;
  btn.textContent = ptShowHidden ? 'Back to projects' : 'Hidden' + (n ? ' (' + n + ')' : '');
  btn.setAttribute('aria-pressed', String(ptShowHidden));
  btn.onclick = () => { ptShowHidden = !ptShowHidden; dash.draw('projectIcons'); dash.draw('hiddenToggle'); };
});

function ptCurrentProject() {
  const s = dash.data('projects');
  if (s.status !== 'ok') return null;
  const cur = String(dash.params().project_id || '');
  return s.data.find((p) => p.id === cur) || null;
}

/* =====================================================================
   Tasks view
   ===================================================================== */
dash.draw('projectTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — open tasks' : 'Open tasks';
});

dash.draw('projectSub', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? [p.group, p.owner ? 'Owner: ' + p.owner : '', p.status, p.percent_complete + '% complete'].filter(Boolean).join(' · ') : '';
});

function ptProjectTaskRows() {
  const s = dash.data('projectTasks');
  if (s.status !== 'ok' || !Array.isArray(s.data)) return null;
  const cur = String(dash.params().project_id || '');
  return s.data.filter((t) => !t.project_id || t.project_id === cur).slice().sort((a, b) => {
    const da = a.due ? Date.parse(a.due) : Infinity, db = b.due ? Date.parse(b.due) : Infinity;
    return da - db;
  });
}

dash.draw('projectTaskRows', (tb) => {
  const rows = ptProjectTaskRows();
  tb.replaceChildren();
  if (!rows) return;
  const now = Date.now(), week = now + 7 * 864e5;
  rows.forEach((t) => {
    const tr = document.createElement('tr');
    const d = t.due ? new Date(t.due) : null;
    const tdName = document.createElement('td');
    tdName.textContent = t.task;
    if (t.depth > 0) tdName.className = 'pt-indent';
    const tdList = document.createElement('td'); tdList.textContent = t.tasklist;
    const tdOwn = document.createElement('td'); tdOwn.textContent = t.owners;
    const tdSt = document.createElement('td'); const pill = document.createElement('span'); pill.className = 'pt-pill'; pill.textContent = t.status; tdSt.appendChild(pill);
    const tdPct = document.createElement('td'); tdPct.className = 'pt-num'; tdPct.textContent = String(t.completion);
    const tdDue = document.createElement('td'); tdDue.className = 'pt-nowrap'; tdDue.textContent = d ? fmtDay(d) : '—';
    if (d && d.getTime() < now) tdDue.classList.add('pt-bad'); else if (d && d.getTime() < week) tdDue.classList.add('pt-warn');
    tr.append(tdName, tdList, tdOwn, tdSt, tdPct, tdDue);
    tb.appendChild(tr);
  });
});

dash.draw('projectTaskEmpty', (el) => {
  const s = dash.data('projectTasks');
  el.replaceChildren();
  const p = document.createElement('div');
  p.className = 'pt-empty';
  if (s.status === 'loading') { p.textContent = 'Loading tasks…'; el.appendChild(p); return; }
  if (s.status === 'error') { p.textContent = 'Failed to load'; el.appendChild(p); return; }
  const rows = ptProjectTaskRows();
  if (rows && !rows.length) { p.textContent = 'This project has no open tasks.'; el.appendChild(p); return; }
  if (s.status === 'ok' && s.truncated) { p.textContent = 'Showing the first 200 open tasks; this project has more.'; el.appendChild(p); }
});

/* =====================================================================
   Finance view: QuickBooks (UC only), AppFolio (HD only), hours by person
   ===================================================================== */
// Match a UC project to a QuickBooks customer: "UC153...-J04..." -> customer starting "153 " and containing "J04"
function ptQbMatch(rows, p) {
  if (!rows || !p) return null;
  const n = String(p.name || '').toUpperCase();
  const m1 = n.match(/^[A-Z]{2}(\d+)/);
  const m2 = n.match(/-(J\d+)/);
  if (!m1 || !m2) return null;
  const num = m1[1], job = m2[1];
  return rows.find((r) => !r.is_total && new RegExp('^' + num + '\\s').test(r.customer) && new RegExp('\\b' + job + '\\b', 'i').test(r.customer)) || null;
}

dash.draw('qbTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — QuickBooks' : 'QuickBooks';
});

dash.draw('qbBody', (el) => {
  el.replaceChildren();
  const msg = (t) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; el.appendChild(d); };
  const s = dash.data('qbSales'), a = dash.data('qbAR');
  el.classList.toggle('dash-skeleton', s.status === 'loading' || a.status === 'loading');
  if (s.status === 'loading' || a.status === 'loading') { el.style.minHeight = '80px'; return; }
  el.style.minHeight = '';
  if (s.status === 'error' || a.status === 'error') { msg('Failed to load'); return; }
  const p = ptCurrentProject();
  if (!p) return;
  if (ptDept() !== 'UC') { msg('QuickBooks is connected to UrbanCore Builders LLC, so figures appear for UC projects only.'); return; }
  const sale = ptQbMatch(s.data, p);
  const ar = ptQbMatch(a.data, p);
  if (!sale && !ar) { msg('No QuickBooks customer matches this project. QuickBooks names UC jobs like “153 Halsey J04”, matched by building number and job number.'); return; }
  const cust = (sale || ar).customer;
  const grid = document.createElement('div'); grid.className = 'pt-qb';
  const tile = (label, val, cls) => {
    const d = document.createElement('div');
    const l = document.createElement('div'); l.className = 'pt-qb-label'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'pt-qb-val' + (cls ? ' ' + cls : '');
    v.textContent = fmtUsd(val);
    d.append(l, v); grid.appendChild(d);
  };
  tile('Invoiced to date', sale ? sale.total_sales : 0);
  tile('Open balance (A/R)', ar ? ar.total : 0, ar && ar.total > 0 ? 'pt-warn' : '');
  tile('Over 90 days past due', ar ? ar.d91_plus : 0, ar && ar.d91_plus > 0 ? 'pt-bad' : '');
  el.appendChild(grid);
  const note = document.createElement('div'); note.className = 'pt-empty'; note.textContent = 'QuickBooks customer: ' + cust;
  if (ar && ar.total > 0) {
    const buckets = [['Current', ar.current], ['1–30 days', ar.d1_30], ['31–60 days', ar.d31_60], ['61–90 days', ar.d61_90], ['91+ days', ar.d91_plus]];
    const colors = ['var(--color-good, #3c8d5a)', dash.colors[0], dash.colors[1 % dash.colors.length], 'var(--color-warn)', 'var(--color-bad)'];
    const bar = document.createElement('div'); bar.className = 'pt-qb-aging';
    const leg = document.createElement('div'); leg.className = 'pt-qb-legend';
    buckets.forEach(([n, v], i) => {
      if (!v) return;
      const seg = document.createElement('span'); seg.style.width = (100 * v / ar.total) + '%'; seg.style.background = colors[i]; seg.title = n + ': ' + fmtUsd(v);
      bar.appendChild(seg);
      const lg = document.createElement('span'); const sw = document.createElement('i'); sw.style.background = colors[i];
      lg.append(sw, document.createTextNode(n + ' ' + fmtUsd(v)));
      leg.appendChild(lg);
    });
    el.append(bar, leg);
  }
  el.appendChild(note);
});

// Match an HD project to AppFolio properties: "HD609BRO-..." -> bldg_num 609, street_abbr BRO
function ptAfKey(name) {
  const seg = String(name || '').slice(2).replace(/^[-\s]+/, '').split('-')[0];
  const m = seg.match(/^(\d+)([A-Za-z]{3})/);
  return m ? { num: m[1], abbr: m[2].toUpperCase() } : null;
}
function ptAfMatch(rows, p) {
  const k = ptAfKey(p && p.name);
  if (!k || !rows) return [];
  return rows.filter((r) => String(r.bldg_num) === k.num && String(r.street_abbr).toUpperCase() === k.abbr);
}
function ptAfHasActivity(p) {
  const s = dash.data('appfolioSpend'), l = dash.data('appfolioLoans');
  if (s.status !== 'ok' || l.status !== 'ok') return false;
  return ptAfMatch(s.data, p).some((r) => r.spent_to_date || r.spend_ytd) || ptAfMatch(l.data, p).length > 0;
}

dash.draw('afTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — AppFolio' : 'AppFolio';
});

dash.draw('afBody', (el) => {
  el.replaceChildren();
  const msg = (t, parent) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; (parent || el).appendChild(d); };
  const s = dash.data('appfolioSpend'), l = dash.data('appfolioLoans');
  const loading = s.status === 'loading' || l.status === 'loading';
  el.classList.toggle('dash-skeleton', loading);
  if (loading) { el.style.minHeight = '120px'; return; }
  el.style.minHeight = '';
  if (s.status === 'error' || l.status === 'error') { msg('Failed to load'); return; }
  const p = ptCurrentProject();
  if (!p) return;
  const spend = ptAfMatch(s.data, p);
  const loans = ptAfMatch(l.data, p);
  if (!spend.length && !loans.length) { msg('No AppFolio property matches this project. Properties are matched by building number and street, e.g. HD609BRO → 609 Broad St.'); return; }
  const fmtD = d3.utcFormat('%b %-d, %Y');
  const parseD = d3.utcParse('%Y-%m-%d');
  const section = (title) => { const d = document.createElement('div'); d.className = 'pt-af-sec'; const h = document.createElement('h3'); h.className = 'pt-af-h3'; h.textContent = title; d.appendChild(h); el.appendChild(d); return d; };
  const table = (parent, key, cols, rows) => {
    const wrap = document.createElement('div'); wrap.className = 'pt-table-wrap';
    const t = document.createElement('table'); t.className = 'pt-table';
    const thead = document.createElement('thead'); const tr = document.createElement('tr');
    cols.forEach((c) => { const th = document.createElement('th'); th.textContent = c.label; if (c.num) th.className = 'pt-num'; tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    const tb = document.createElement('tbody');
    rows.forEach((r) => {
      const row = document.createElement('tr');
      cols.forEach((c) => { const td = document.createElement('td'); td.textContent = c.fmt(r[c.field], r); if (c.num) td.className = 'pt-num'; row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb); wrap.appendChild(t); parent.appendChild(wrap);
  };
  const usd = (v) => (v == null ? '—' : fmtUsd(v));
  const ls = section('Loan');
  if (!loans.length) msg('No active loans recorded in AppFolio for this property.', ls);
  else table(ls, 'loan_id', [
    { label: 'Lender', field: 'lender', fmt: (v) => v || '—' },
    { label: 'Property', field: 'street', fmt: (v) => v || '—' },
    { label: 'Balance', field: 'balance', num: true, fmt: usd },
    { label: 'Rate', field: 'interest_rate', num: true, fmt: (v) => (v == null ? '—' : v.toFixed(2) + '%') },
    { label: 'Monthly payment', field: 'monthly_payment', num: true, fmt: usd },
    { label: 'Matures', field: 'maturity_date', fmt: (v) => (v ? fmtD(parseD(String(v).slice(0, 10))) : '—') }
  ], loans.slice().sort((a, b) => (b.balance || 0) - (a.balance || 0)));
  const sd = section('Spent to date');
  if (!spend.length) msg('No bills recorded in AppFolio for this property.', sd);
  else table(sd, 'property_id', [
    { label: 'Property', field: 'street', fmt: (v, r) => (r.property || '') + (v ? ' · ' + v : '') },
    { label: 'Bills', field: 'bills_to_date', num: true, fmt: (v) => fmtNum(v || 0) },
    { label: 'Spent to date', field: 'spent_to_date', num: true, fmt: usd }
  ], spend);
  const sy = section('Spend year to date (' + new Date().getFullYear() + ')');
  if (!spend.length) msg('No bills recorded in AppFolio for this property.', sy);
  else table(sy, 'property_id', [
    { label: 'Property', field: 'street', fmt: (v, r) => (r.property || '') + (v ? ' · ' + v : '') },
    { label: 'Bills', field: 'bills_ytd', num: true, fmt: (v) => fmtNum(v || 0) },
    { label: 'Spend YTD', field: 'spend_ytd', num: true, fmt: usd }
  ], spend);
});

dash.draw('hoursTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — hours by person' : 'Hours by person';
});
dash.draw('hoursBody', (el) => {
  el.replaceChildren();
  const s = dash.data('hoursByPerson');
  const raw = dash.data('projectHours');
  el.classList.toggle('dash-skeleton', raw.status === 'loading');
  const note = (t) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; el.appendChild(d); };
  if (raw.status === 'loading') { el.style.minHeight = '100px'; return; }
  el.style.minHeight = '';
  if (raw.status === 'error') { note('Failed to load'); return; }
  if (s.status !== 'ok' || !Array.isArray(s.data)) return;
  if (!s.data.length) { note('No hours are logged on this project’s tasks in Zoho.'); return; }
  const total = d3.sum(s.data, (r) => r.hours);
  const wrap = document.createElement('div'); wrap.className = 'pt-table-wrap';
  const t = document.createElement('table'); t.className = 'pt-table pt-hours-table';
  const cols = [['person', 'Person', ''], ['hours', 'Hours', 'pt-num'], ['share', 'Share', 'pt-num'], ['tasks', 'Tasks with hours', 'pt-num'], ['shared_tasks', 'Of which shared', 'pt-num']];
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  cols.forEach(([f, l, c]) => { const th = document.createElement('th'); th.textContent = l; if (c) th.className = c; hr.appendChild(th); });
  thead.appendChild(hr); t.appendChild(thead);
  const tb = document.createElement('tbody');
  const fmt1 = d3.format(',.1f');
  s.data.forEach((r) => {
    const tr = document.createElement('tr');
    const vals = [r.person, fmt1(r.hours), fmt1(r.share) + '%', fmtNum(r.tasks), fmtNum(r.shared_tasks)];
    vals.forEach((v, i) => {
      const td = document.createElement('td'); if (cols[i][2]) td.className = cols[i][2];
      if (i === 1) {
        const bar = document.createElement('span'); bar.className = 'pt-hbar'; bar.style.width = (total ? 60 * r.hours / d3.max(s.data, (x) => x.hours) : 0) + 'px'; bar.style.background = dash.colors[0];
        td.append(bar, document.createTextNode(v));
      } else td.textContent = v;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb); wrap.appendChild(t); el.appendChild(wrap);
  const n = document.createElement('div'); n.className = 'pt-empty';
  n.textContent = fmt1(total) + ' hours logged in total. Hours on a task with several owners are divided equally between them, so per-person figures are estimates, not timesheet records.' + (raw.truncated ? ' Only the first 2,000 tasks were read.' : '');
  el.appendChild(n);
});

/* =====================================================================
   Meetings view (Gemini notes). Removed meetings are per-browser (localStorage).
   ===================================================================== */
dash.draw('meetTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — meetings' : 'Meetings';
});
dash.draw('meetSub', (el) => {
  const b = String(dash.params().bldg || '');
  el.textContent = ptDept() === 'HD' ? 'Gemini notes from Google Drive whose meeting title contains “' + b + '”, excluding other departments’ meetings, newest first' : 'Gemini notes whose title contains “' + b + '” and starts with ' + ptDept() + ', newest first';
});
// HD sees meetings with no department prefix or "HD"; other departments only see their own prefix
function ptMeetForDept(rows) {
  const dept = ptDept();
  return (rows || []).filter((m) => {
    const mm = String(m.meeting || '').toUpperCase().match(/^(HD|UC|BS|SK|SA)(?![A-Z])/);
    const code = mm ? mm[1] : '';
    return dept === 'HD' ? (code === '' || code === 'HD') : code === dept;
  });
}

const PT_MEET_KEY = 'pt-hidden-meetings';
let ptMeetHidden = new Set();
try { ptMeetHidden = new Set(JSON.parse(localStorage.getItem(PT_MEET_KEY) || '[]').map(String)); } catch (e) { ptMeetHidden = new Set(); }
let ptShowRemovedMeet = false;
function ptSetMeetHidden(id, hide) {
  if (hide) ptMeetHidden.add(id); else ptMeetHidden.delete(id);
  try { localStorage.setItem(PT_MEET_KEY, JSON.stringify([...ptMeetHidden])); } catch (e) {}
  dash.draw('meetList'); dash.draw('meetHiddenToggle');
}
dash.draw('meetHiddenToggle', (btn) => {
  const s = dash.data('meetings');
  const n = s.status === 'ok' ? ptMeetForDept(s.data).filter((m) => ptMeetHidden.has(m.id)).length : 0;
  btn.hidden = !n && !ptShowRemovedMeet;
  btn.textContent = ptShowRemovedMeet ? 'Back to meetings' : 'Removed (' + n + ')';
  btn.setAttribute('aria-pressed', String(ptShowRemovedMeet));
  btn.onclick = () => { ptShowRemovedMeet = !ptShowRemovedMeet; dash.draw('meetList'); dash.draw('meetHiddenToggle'); };
});

dash.draw('meetList', (el) => {
  const s = dash.data('meetings');
  el.classList.toggle('dash-skeleton', s.status === 'loading');
  el.replaceChildren();
  const msg = (t) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; el.appendChild(d); };
  if (s.status === 'loading') { el.style.minHeight = '120px'; return; }
  el.style.minHeight = '';
  if (s.status === 'error') { msg('Failed to load'); return; }
  if (s.status !== 'ok') return;
  const deptRows = ptMeetForDept(s.data);
  if (!deptRows.length) { msg('No ' + ptDept() + ' meeting notes found for this project.'); return; }
  const fmt = d3.timeFormat('%a, %b %-d, %Y');
  const shown = deptRows.filter((m) => ptMeetHidden.has(m.id) === ptShowRemovedMeet);
  if (!shown.length) { msg(ptShowRemovedMeet ? 'No removed meetings for this project.' : 'All meetings for this project have been removed.'); return; }
  shown.slice().sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)).forEach((m) => {
    const card = document.createElement('div'); card.className = 'pt-meet';
    const body = document.createElement('div'); body.className = 'pt-meet-body';
    const dt = m.date ? new Date(m.date) : null;
    const badge = document.createElement('div'); badge.className = 'pt-cal';
    if (dt) {
      const dn = dt.getDate();
      const sfx = (dn % 100 >= 11 && dn % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[dn % 10] || 'th');
      const mo = document.createElement('span'); mo.className = 'pt-cal-mo'; mo.textContent = d3.timeFormat('%b')(dt);
      const dy = document.createElement('span'); dy.className = 'pt-cal-day'; dy.textContent = dn + sfx;
      const yr = document.createElement('span'); yr.className = 'pt-cal-yr'; yr.textContent = String(dt.getFullYear());
      badge.append(mo, dy, yr);
      badge.title = fmt(dt);
    }
    card.append(badge, body);
    const head = document.createElement('div'); head.className = 'pt-meet-head';
    const t = document.createElement('a'); t.className = 'pt-meet-title'; t.textContent = m.meeting; t.target = '_blank'; t.rel = 'noopener';
    if (/^https?:\/\//.test(m.url || '')) t.href = m.url;
    const right = document.createElement('span'); right.className = 'pt-meet-right';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'pt-meet-x'; x.textContent = '×';
    x.title = ptShowRemovedMeet ? 'Restore this meeting' : 'Remove this meeting from the list';
    x.setAttribute('aria-label', (ptShowRemovedMeet ? 'Restore ' : 'Remove ') + m.meeting);
    x.addEventListener('click', () => ptSetMeetHidden(m.id, !ptShowRemovedMeet));
    right.append(x);
    head.append(t, right); body.appendChild(head);
    if (m.summary) { const p = document.createElement('p'); p.className = 'pt-meet-sum'; p.textContent = m.summary; body.appendChild(p); }
    const steps = m.next_steps ? m.next_steps.split('\n').filter(Boolean) : [];
    if (steps.length) {
      const det = document.createElement('details');
      const sm = document.createElement('summary'); sm.textContent = 'Next steps (' + steps.length + (/…$/.test(steps[steps.length - 1]) ? '+' : '') + ')';
      const ul = document.createElement('ul');
      steps.forEach((x) => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); });
      det.append(sm, ul); body.appendChild(det);
    }
    el.appendChild(card);
  });
  if (s.truncated) msg('Showing the 50 most recent meetings. Older notes are in Google Drive.');
});

/* =====================================================================
   Agenda view (notes from the Agenda tab, by ISO week)
   ===================================================================== */
function ptIsoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
// "2026-W48" key for this week (back = 0) or a previous week (back = 1, 2, ...)
function ptWeekKey(d, back) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - 7 * (back || 0)));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - new Date(Date.UTC(y, 0, 1))) / 864e5 + 1) / 7);
  return y + '-W' + String(w).padStart(2, '0');
}
dash.draw('agCell', (el) => {
  el.replaceChildren();
  const s = dash.data('agendaNotes');
  el.classList.toggle('dash-skeleton', s.status === 'loading');
  if (s.status !== 'ok' || !Array.isArray(s.data)) return;
  const p = ptCurrentProject();
  if (!p) return;
  const norm = (x) => String(x || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  const sec = norm(el.getAttribute('data-sec')), item = norm(el.getAttribute('data-item')), col = el.getAttribute('data-col');
  const find = (wk) => s.data.find((r) => r.project === p.name && r.week === wk && norm(r.item) === item && (!r.section || norm(r.section) === sec));
  const cur = find(ptWeekKey(new Date()));
  let v = '';
  if (col === 'this') v = cur ? cur.this_week : '';
  else if (col === 'up') v = cur ? cur.upcoming : '';
  else { v = cur && cur.last_week ? cur.last_week : ''; if (!v) { const prev = find(ptWeekKey(new Date(), 1)); v = prev ? prev.this_week : ''; } }
  el.textContent = v;
  if (v && cur && cur.source) el.title = 'From ' + cur.source;
});

dash.draw('agendaTitle', (el) => {
  const p = ptCurrentProject();
  el.replaceChildren(document.createTextNode('Week ' + ptIsoWeek(new Date()) + ' Agenda' + (p ? ': ' : '')));
  if (p) { const b = document.createElement('b'); b.textContent = p.name; el.appendChild(b); }
});

/* =====================================================================
   Schedule view (Gantt of phases; click a phase to expand its open tasks)
   ===================================================================== */
function ptPhaseRows() {
  const s = dash.data('projectPhases');
  if (s.status !== 'ok') return null;
  const cur = String(dash.params().project_id || '');
  const parse = d3.utcParse('%Y-%m-%d');
  return s.data.filter((r) => !r.project_id || r.project_id === cur).map((r) => ({
    ...r, s: r.start_date ? parse(String(r.start_date).slice(0, 10)) : null, e: r.end_date ? parse(String(r.end_date).slice(0, 10)) : null
  }));
}
const ptStatusColor = (r, i) => /^#[0-9a-fA-F]{6}$/.test(r.status_color || '') ? r.status_color : dash.colors[i % dash.colors.length];

dash.draw('phaseTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — phases' : 'Phases';
});

dash.draw('phaseLegend', (el) => {
  el.replaceChildren();
  const rows = ptPhaseRows();
  if (!rows || !rows.length) return;
  const seen = new Map();
  rows.forEach((r) => { if (!seen.has(r.status)) seen.set(r.status, ptStatusColor(r, seen.size)); });
  seen.forEach((c, name) => {
    const s = document.createElement('span');
    const sw = document.createElement('i'); sw.style.background = c;
    s.append(sw, document.createTextNode(name || 'No status'));
    el.appendChild(s);
  });
  const t = document.createElement('span');
  const tl = document.createElement('i'); tl.style.background = 'var(--color-bad)'; tl.style.width = '2px';
  t.append(tl, document.createTextNode('Today'));
  el.appendChild(t);
});

const ptExpanded = new Set();
dash.draw('phaseGantt', (el) => {
  const st = dash.data('projectPhases');
  el.classList.toggle('dash-skeleton', st.status === 'loading');
  el.replaceChildren();
  if (st.status !== 'ok') { if (st.status === 'loading') el.style.minHeight = '160px'; return; }
  el.style.minHeight = '';
  const all = ptPhaseRows() || [];
  const rows = all.filter((r) => r.s && r.e).sort((a, b) => a.s - b.s || a.e - b.e);
  if (!rows.length) return;
  const colorBy = new Map();
  all.forEach((r) => { if (!colorBy.has(r.status)) colorBy.set(r.status, ptStatusColor(r, colorBy.size)); });
  const ts = dash.data('projectTasks');
  const cur = String(dash.params().project_id || '');
  const tasks = ts.status === 'ok' && Array.isArray(ts.data) ? ts.data.filter((t) => !t.project_id || t.project_id === cur) : [];
  const byPhase = d3.group(tasks, (t) => t.milestone_id || '');
  const parseD = (v) => (v ? new Date(v) : null);
  const W = Math.max(el.clientWidth || 700, 560);
  const narrow = W < 700;
  const left = narrow ? 150 : 240, right = 16, top = 26, rowH = 28, taskH = 22, barH = 16;
  const entries = [];
  rows.forEach((r) => {
    const list = (byPhase.get(r.id) || []).slice().sort((a, b) => (Date.parse(a.due) || Infinity) - (Date.parse(b.due) || Infinity));
    entries.push({ kind: 'phase', r, n: list.length, h: rowH });
    if (ptExpanded.has(r.id)) {
      if (!list.length) entries.push({ kind: 'empty', r, h: taskH });
      list.forEach((t) => entries.push({ kind: 'task', r, t, s: parseD(t.start), e: parseD(t.due), h: taskH }));
    }
  });
  let y = top; entries.forEach((en) => { en.y = y; y += en.h; });
  const H = y + 8;
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const lo = d3.min(rows, (r) => r.s), hi = d3.max(rows, (r) => r.e);
  const x = d3.scaleUtc().domain([d3.utcMonth.floor(d3.min([lo, today])), d3.utcMonth.ceil(d3.max([hi, today]))]).range([left, W - right]);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const spanYears = (x.domain()[1] - x.domain()[0]) / (365 * 864e5);
  const ticks = spanYears > 2.5 ? x.ticks(d3.utcYear.every(1)) : x.ticks(d3.utcMonth.every(spanYears > 1.2 ? 3 : 1));
  const tf = spanYears > 2.5 ? d3.utcFormat('%Y') : d3.utcFormat('%b %Y');
  svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'pt-g-grid').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top - 6).attr('y2', H - 4);
  svg.append('g').selectAll('text').data(ticks.filter((d) => x(d) + 56 <= W - right)).join('text').attr('x', (d) => x(d) + 3).attr('y', top - 10).text(tf);
  const tip = document.createElement('div'); tip.className = 'pt-tip'; tip.hidden = true;
  const fmt = d3.utcFormat('%b %-d, %Y');
  const fmtL = d3.timeFormat('%b %-d, %Y');
  const showTip = (ev, lines) => {
    tip.replaceChildren(...tipLines(lines)); tip.hidden = false;
    const box = el.getBoundingClientRect();
    tip.style.left = Math.min(ev.clientX - box.left + el.scrollLeft + 12, el.scrollWidth - 250) + 'px';
    tip.style.top = (ev.clientY - box.top + 14) + 'px';
  };
  const clip = (s, max) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
  const toggle = (id) => { if (ptExpanded.has(id)) ptExpanded.delete(id); else ptExpanded.add(id); dash.draw('phaseGantt'); };
  entries.forEach((en) => {
    const g = svg.append('g').attr('transform', `translate(0,${en.y})`);
    if (en.kind === 'phase') {
      const r = en.r, open = ptExpanded.has(r.id);
      g.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', en.h).attr('fill', 'transparent').style('cursor', 'pointer').on('click', () => toggle(r.id));
      g.append('text').attr('class', 'pt-g-label').attr('x', 0).attr('y', en.h / 2 + 4).style('cursor', 'pointer')
        .text((open ? '▾ ' : '▸ ') + clip(r.phase, narrow ? 15 : 24) + (en.n ? ' (' + en.n + ')' : '')).on('click', () => toggle(r.id));
      g.append('rect').attr('x', x(r.s)).attr('y', (en.h - barH) / 2).attr('height', barH).attr('rx', 3)
        .attr('width', Math.max(3, x(r.e) - x(r.s))).attr('fill', colorBy.get(r.status)).attr('opacity', r.closed ? 0.45 : 1)
        .style('cursor', 'pointer')
        .on('mousemove', (ev) => showTip(ev, [[r.phase], [fmt(r.s) + ' – ' + fmt(r.e), true], [r.status + (r.owner ? ' · ' + r.owner : ''), true], [en.n + ' open task' + (en.n === 1 ? '' : 's') + ' · click to ' + (open ? 'collapse' : 'expand'), true]]))
        .on('mouseleave', () => { tip.hidden = true; })
        .on('click', () => { tip.hidden = true; toggle(r.id); });
    } else if (en.kind === 'empty') {
      g.append('text').attr('x', 18).attr('y', en.h / 2 + 4).text('No open tasks in this phase');
    } else {
      const t = en.t, now = Date.now();
      const late = en.e && en.e.getTime() < now;
      g.append('text').attr('x', 18).attr('y', en.h / 2 + 4).text(clip(t.task, narrow ? 20 : 34)).append('title').text(t.task);
      const color = colorBy.get(en.r.status);
      if (en.s && en.e && en.e > en.s) {
        g.append('rect').attr('x', x(en.s)).attr('y', (en.h - 8) / 2).attr('height', 8).attr('rx', 2).attr('width', Math.max(3, x(en.e) - x(en.s)))
          .attr('fill', late ? 'var(--color-bad)' : color).attr('opacity', 0.7);
      }
      if (en.e) {
        g.append('circle').attr('cx', x(en.e)).attr('cy', en.h / 2).attr('r', 4).attr('fill', late ? 'var(--color-bad)' : color);
      } else {
        g.append('text').attr('x', left).attr('y', en.h / 2 + 4).text('no dates');
      }
      g.append('rect').attr('x', left).attr('y', 0).attr('width', W - left).attr('height', en.h).attr('fill', 'transparent')
        .on('mousemove', (ev) => showTip(ev, [[t.task], [(en.s ? fmtL(en.s) + ' – ' : '') + (en.e ? 'due ' + fmtL(en.e) : 'no due date'), true], [t.status + ' · ' + t.owners, true]]))
        .on('mouseleave', () => { tip.hidden = true; });
    }
  });
  const tx = x(today);
  svg.append('line').attr('class', 'pt-g-today').attr('x1', tx).attr('x2', tx).attr('y1', top - 6).attr('y2', H - 4);
  el.appendChild(tip);
});

dash.draw('phaseEmpty', (el) => {
  const s = dash.data('projectPhases');
  el.replaceChildren();
  const p = document.createElement('div'); p.className = 'pt-empty';
  if (s.status === 'error') { p.textContent = 'Failed to load'; el.appendChild(p); return; }
  const rows = ptPhaseRows();
  if (!rows) return;
  const undated = rows.filter((r) => !(r.s && r.e)).length;
  if (!rows.length) p.textContent = 'This project has no phases in Zoho.';
  else if (undated) p.textContent = undated + (undated === 1 ? ' phase has' : ' phases have') + ' no start or end date and isn’t shown.';
  else return;
  el.appendChild(p);
});

/* =====================================================================
   Overview view: team roster by Tier 1 / Tier 2, with edit-in-place that writes to the Google Sheet
   ===================================================================== */
const ptAreaOpen = new Set(['T1:Development']);
dash.draw('ovTitle', (el) => {
  const p = ptCurrentProject();
  el.textContent = p ? p.name + ' — team roles and responsibilities' : 'Team roles and responsibilities';
});

// Default tiers (Tier 1 -> its Tier 2 groups). Extra tiers found in the sheet are appended.
const PT_TIERS = [
  ['Development', ['Sponsors', 'Development']],
  ['Legal', ['Acquisition Legal', 'Construction Legal', 'HTC Legal', 'LIHTC Legal', 'Land Use', 'Tax Abatement', 'Agency Legal']],
  ['Design', ['Architecture', 'MEP', 'Structural', 'Planning', 'Civil', 'Traffic', 'Elevator', 'Geotechnical', 'Energy']],
  ['Consultants', ['Environmental', 'Surveyor', 'Expeditor', 'Affordable Housing']],
  ['Construction', ['Construction Manager', 'General Contractor', 'Expeditor']],
  ['Property Management', ['Property Manager', 'Marketing', 'Social Media Marketing']]
];
dash.draw('ovBody', (el) => {
  el.replaceChildren();
  const rs = dash.data('projectRoster');
  el.classList.toggle('dash-skeleton', rs.status === 'loading');
  if (rs.status === 'loading') { el.style.minHeight = '160px'; return; }
  el.style.minHeight = '';
  const note = (t, parent) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; (parent || el).appendChild(d); };
  if (rs.status === 'error') { note('Failed to load the roster: ' + (rs.message || '')); return; }
  if (rs.status !== 'ok') return;
  const pcur = ptCurrentProject();
  if (!pcur) return;
  const roster = Array.isArray(rs.data) ? rs.data.filter((r) => r.project === pcur.name) : [];
  const norm = (s) => String(s || '').trim().toLowerCase();
  const tiers = PT_TIERS.map(([t1, t2s]) => [t1, t2s.slice()]);
  roster.forEach((r) => {
    let t = tiers.find(([a]) => norm(a) === norm(r.tier1));
    if (!t) { t = [r.tier1 || 'Other', []]; tiers.push(t); }
    if (!t[1].some((x) => norm(x) === norm(r.tier2))) t[1].push(r.tier2 || 'General');
  });
  const rosterTable = (rows) => {
    const wrap = document.createElement('div'); wrap.className = 'pt-table-wrap pt-roster';
    const t = document.createElement('table'); t.className = 'pt-table pt-roster-table';
    const cols = [['role', 'Role', '160px'], ['level', 'Level', '72px'], ['contact', 'Name', '150px'], ['firm', 'Company', '150px'], ['contact_email', 'Email', '190px'], ['phone', 'Phone', '120px']];
    const cg = document.createElement('colgroup');
    cols.forEach(([, , w]) => { const c = document.createElement('col'); c.style.width = w; cg.appendChild(c); });
    const cx = document.createElement('col'); cx.style.width = '26px'; cg.appendChild(cx);
    t.appendChild(cg);
    const thead = document.createElement('thead'); const hr = document.createElement('tr');
    cols.forEach(([, l]) => { const th = document.createElement('th'); th.textContent = l; hr.appendChild(th); });
    const thx = document.createElement('th'); thx.setAttribute('aria-label', 'Remove'); hr.appendChild(thx);
    thead.appendChild(hr); t.appendChild(thead);
    const tb = document.createElement('tbody');
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      cols.forEach(([f]) => {
        const td = document.createElement('td');
        // the small circle before Role / Level / Name opens an editor (Name opens the Zoho CRM contact picker)
        if (f === 'role' || f === 'level' || f === 'contact') {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-pick-dot';
          b.title = 'Change ' + f + ' for ' + (r.role || 'this row');
          b.setAttribute('aria-label', b.title);
          b.addEventListener('click', () => (f === 'contact' ? ptOpenPicker(r) : ptOpenEdit(r, f)));
          td.appendChild(b);
          td.classList.add('pt-dot-cell');
        }
        const span = document.createElement('span'); span.textContent = r[f] || '—'; if (!r[f]) span.className = 'pt-muted';
        td.appendChild(span);
        td.title = r[f] || '';
        tr.appendChild(td);
      });
      // × removes the row from the sheet (click twice to confirm)
      const tdx = document.createElement('td'); tdx.className = 'pt-x-cell';
      const x = document.createElement('button'); x.type = 'button'; x.className = 'pt-meet-x'; x.textContent = '×';
      x.title = 'Remove this line'; x.setAttribute('aria-label', 'Remove ' + (r.role || 'line'));
      x.addEventListener('click', () => {
        if (!x.classList.contains('pt-x-confirm')) { x.classList.add('pt-x-confirm'); x.textContent = 'Remove?'; x.title = 'Click again to remove this line from the roster sheet'; setTimeout(() => { if (x.isConnected && x.classList.contains('pt-x-confirm')) { x.classList.remove('pt-x-confirm'); x.textContent = '×'; } }, 4000); return; }
        ptRemoveRow(r);
      });
      tdx.appendChild(x); tr.appendChild(tdx);
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  };
  if (ptRosterMsg) note(ptRosterMsg);
  if (!roster.length) note('This project has no rows in the Project Team Roster sheet yet. Add rows with its project name to fill in the tiers below.');
  tiers.forEach(([t1, t2s], ti) => {
    const rows1 = roster.filter((r) => norm(r.tier1) === norm(t1));
    const tc = dash.colors[ti % dash.colors.length];
    const key = 'T1:' + t1;
    const det = document.createElement('details'); det.className = 'pt-area pt-tier1'; det.id = 'overview-' + t1.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    det.open = ptAreaOpen.has(key);
    det.addEventListener('toggle', () => { if (det.open) ptAreaOpen.add(key); else ptAreaOpen.delete(key); });
    det.style.borderColor = 'color-mix(in srgb, ' + tc + ' 45%, var(--color-border-line))';
    const sm = document.createElement('summary'); sm.className = 'pt-area-sum';
    sm.style.background = 'color-mix(in srgb, ' + tc + ' 16%, var(--color-panel))';
    sm.style.borderLeft = '4px solid ' + tc;
    const tt = document.createElement('span'); tt.className = 'pt-area-title'; tt.textContent = t1;
    const meta = document.createElement('span'); meta.className = 'pt-area-meta'; meta.textContent = rows1.length ? rows1.length + ' role' + (rows1.length === 1 ? '' : 's') : 'No roles listed';
    sm.append(tt, meta); det.appendChild(sm);
    const body = document.createElement('div'); body.className = 'pt-area-body';
    t2s.forEach((t2) => {
      const rows2 = rows1.filter((r) => norm(r.tier2) === norm(t2));
      const h = document.createElement('h3'); h.className = 'pt-af-h3 pt-tier2';
      h.style.background = 'color-mix(in srgb, ' + tc + ' 6%, var(--color-panel))';
      h.style.borderLeft = '2px solid color-mix(in srgb, ' + tc + ' 45%, transparent)';
      const ht = document.createElement('span'); ht.textContent = t2;
      const add = document.createElement('button'); add.type = 'button'; add.className = 'pt-add-line'; add.textContent = '+';
      add.title = 'Add a line under ' + t1 + ' › ' + t2; add.setAttribute('aria-label', add.title);
      add.addEventListener('click', () => ptAddRow(pcur.name, t1, t2, rs.data));
      h.append(ht, add);
      body.appendChild(h);
      if (rows2.length) body.appendChild(rosterTable(rows2));
      else note('No roles listed.', body);
    });
    det.appendChild(body);
    el.appendChild(det);
  });
});

/* ---------- Google Sheets write-backs (become server routes in the website) ---------- */
const PT_ROSTER_SHEET = '1h-64cziAfN6mlFV0nv_2m_DoNnB2BoUqiKVobIkWqQI';
const PT_ROSTER_SHEET_TAB_ID = 401964840;

// Prefix values that Sheets would treat as formulas/numbers with an apostrophe
function ptCellVal(v) { v = v == null ? '' : String(v); return /^[=+\-@0-9]/.test(v) ? "'" + v : v; }

// Write several fields of one roster row, using the row's column-letter map
async function ptWriteCells(mcp, row, values) {
  const cm = JSON.parse(row.colmap || '{}');
  const idx = (L) => L.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const cells = Object.entries(values).filter(([k]) => cm[k]).map(([k, v]) => [cm[k], idx(cm[k]), ptCellVal(v)]).sort((a, b) => a[1] - b[1]);
  if (!cells.length) throw { code: 'tool_error', message: 'The roster sheet is missing those columns.' };
  const contiguous = cells.every((c, i) => i === 0 || c[1] === cells[i - 1][1] + 1);
  if (contiguous) {
    await mcp.callTool('Google Sheets', 'update_values', { spreadsheetId: PT_ROSTER_SHEET, range: 'Roster!' + cells[0][0] + row.sheet_row + ':' + cells[cells.length - 1][0] + row.sheet_row, values: [cells.map((c) => c[2])] });
  } else {
    for (const c of cells) await mcp.callTool('Google Sheets', 'update_values', { spreadsheetId: PT_ROSTER_SHEET, range: 'Roster!' + c[0] + row.sheet_row, values: [[c[2]]] });
  }
}
let ptRosterMsg = '';
function ptRosterNote(t) { ptRosterMsg = t; dash.draw('ovBody'); }
async function ptMcp() { try { return window.claude && window.claude.use ? await window.claude.use('mcp') : null; } catch (e) { return null; } }
function ptErrText(err) {
  const code = err && err.code;
  const msgs = {
    needs_reauth: 'Google Sheets needs to be reconnected in claude.ai Settings → Connectors.',
    server_not_connected: 'Add Google Sheets in claude.ai Settings → Connectors to change the roster.',
    not_in_manifest: 'Changing the roster sheet isn’t allowed for this dashboard view. Edit the sheet directly instead.',
    blocked_by_policy: 'Your organization blocks writing to Google Sheets from here.',
    server_unavailable: 'Google Sheets didn’t answer. The change may or may not have gone through; check the sheet before trying again.'
  };
  return msgs[code] || ('Couldn’t change the roster: ' + ((err && err.message) || 'unknown error'));
}
// Delete a roster row. Safety check first: re-read columns A:B of that row and make sure Row ID + Project still match.
async function ptRemoveRow(row) {
  const mcp = await ptMcp();
  if (!mcp) { ptRosterNote('This view can’t change the roster sheet. Open the dashboard in claude.ai.'); return; }
  ptRosterNote('Removing ' + (row.role || 'line') + '…');
  try {
    const res = await mcp.callTool('Google Sheets', 'get_values', { spreadsheetId: PT_ROSTER_SHEET, range: 'Roster!A' + row.sheet_row + ':B' + row.sheet_row });
    const p = (res && (res.payload !== undefined ? res.payload : res)) || {};
    const vals = p.values || (p.content && p.content.values) || [];
    const got = vals[0] || [];
    if (String(got[0] || '') !== String(row.id) || String(got[1] || '') !== String(row.project)) {
      ptRosterNote('The sheet changed since this page loaded, so nothing was removed. The roster has been reloaded; try again.');
      dash.refresh('projectRoster');
      return;
    }
    await mcp.callTool('Google Sheets', 'update_spreadsheet', { spreadsheetId: PT_ROSTER_SHEET, requests: [{ deleteDimension: { range: { sheetId: PT_ROSTER_SHEET_TAB_ID, dimension: 'ROWS', startIndex: row.sheet_row - 1, endIndex: row.sheet_row } } }] });
    ptRosterNote('Removed ' + (row.role || 'the line') + '.');
    dash.refresh('projectRoster');
  } catch (err) { ptRosterNote(ptErrText(err)); }
}
// Append a "New role" row under a Tier 1 / Tier 2, with the next numeric Row ID
async function ptAddRow(project, tier1, tier2, allRows) {
  const mcp = await ptMcp();
  if (!mcp) { ptRosterNote('This view can’t change the roster sheet. Open the dashboard in claude.ai.'); return; }
  const any = (allRows || [])[0];
  const cm = any ? JSON.parse(any.colmap || '{}') : { _n: 11, row_id: 'A', project: 'B', tier1: 'C', tier2: 'D', role: 'E' };
  const idx = (L) => L.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const n = Math.max(cm._n || 0, ...['row_id', 'project', 'tier1', 'tier2', 'role'].filter((k) => cm[k]).map((k) => idx(cm[k]) + 1));
  const vals = new Array(n).fill('');
  const nextId = 1 + Math.max(0, ...(allRows || []).map((r) => parseInt(r.id, 10)).filter((v) => !isNaN(v)));
  const put = (k, v) => { if (cm[k]) vals[idx(cm[k])] = v; };
  put('row_id', String(nextId)); put('project', project); put('tier1', tier1); put('tier2', tier2); put('role', 'New role');
  ptRosterNote('Adding a line under ' + tier1 + ' › ' + tier2 + '…');
  try {
    await mcp.callTool('Google Sheets', 'append_values', { spreadsheetId: PT_ROSTER_SHEET, range: 'Roster!A1', values: [vals] });
    ptRosterNote('Added a “New role” line under ' + tier1 + ' › ' + tier2 + '. Use its circles to set the role, level and contact.');
    dash.refresh('projectRoster');
  } catch (err) { ptRosterNote(ptErrText(err)); }
}

/* ---------- Zoho CRM contact picker (sets Firm, Contact, Email, CRM ID, Phone on a roster row) ---------- */
let ptPickRow = null;
let ptPickMsg = '';
function ptPickStatus(t) { ptPickMsg = t; dash.draw('pickResults'); }
function ptOpenPicker(row) {
  ptPickRow = row;
  document.querySelectorAll('#pt-edit-panel').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('#pt-crm-picker').forEach((p) => { p.hidden = false; });
  document.querySelectorAll('.pt-pick-q').forEach((q) => { q.value = row.contact || ''; q.focus(); });
  dash.draw('pickTitle'); dash.draw('pickResults');
  const q = String(row.contact || '').trim();
  if (/^[\p{L}\p{M}\p{N} .@-]{2,40}$/u.test(q)) dash.setParams({ crmq: q });
}
function ptRunPickSearch() {
  let q = '';
  document.querySelectorAll('.pt-pick-q').forEach((el) => { q = String(el.value || '').trim(); });
  if (!/^[\p{L}\p{M}\p{N} .@-]{2,40}$/u.test(q)) { ptPickStatus('Type at least 2 letters (letters, numbers, spaces, . @ - only).'); return; }
  ptPickStatus('');
  dash.setParams({ crmq: q });
}
document.querySelectorAll('#pt-pick-go').forEach((b) => b.addEventListener('click', ptRunPickSearch));
document.querySelectorAll('.pt-pick-q').forEach((q) => q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ptRunPickSearch(); }));
document.querySelectorAll('#pt-pick-close').forEach((b) => b.addEventListener('click', () => {
  ptPickRow = null; ptPickMsg = '';
  document.querySelectorAll('#pt-crm-picker').forEach((p) => { p.hidden = true; });
}));

async function ptSaveContact(row, c) {
  ptPickStatus('Saving ' + c.name + ' to the roster…');
  const mcp = await ptMcp();
  if (!mcp) { ptPickStatus('This view can’t write to Google Sheets. Open the dashboard in claude.ai to save contacts.'); return; }
  try {
    await ptWriteCells(mcp, row, { firm: c.company || row.firm || '', level: row.level || '', contact: c.name, contact_email: c.email || '', crm_id: c.id, phone: c.mobile || '' });
    ptPickStatus('Saved ' + c.name + (c.company ? ' (' + c.company + ')' : '') + ' as ' + row.role + '.');
    dash.refresh('projectRoster');
    setTimeout(() => { document.querySelectorAll('#pt-crm-picker').forEach((p) => { p.hidden = true; }); ptPickRow = null; ptPickMsg = ''; }, 1200);
  } catch (err) {
    ptPickStatus(ptErrText(err));
  }
}

dash.draw('pickTitle', (el) => {
  el.textContent = ptPickRow ? 'Choose a contact for ' + ptPickRow.role + (ptPickRow.firm ? ' · ' + ptPickRow.firm : '') + (ptPickRow.level ? ' (' + ptPickRow.level + ')' : '') : '';
});

dash.draw('pickResults', (el) => {
  el.replaceChildren();
  const note = (t) => { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = t; el.appendChild(d); };
  if (ptPickMsg) note(ptPickMsg);
  const s = dash.data('crmContacts');
  el.classList.toggle('dash-skeleton', s.status === 'loading');
  if (s.status === 'loading') { el.style.minHeight = '60px'; return; }
  el.style.minHeight = '';
  if (s.status === 'error') { note('Zoho CRM search failed: ' + (s.message || 'unknown error')); return; }
  if (s.status !== 'ok') return;
  if (!s.data.length) { note('No Zoho CRM contacts match “' + (dash.params().crmq || '') + '”.'); return; }
  const ul = document.createElement('div'); ul.className = 'pt-pick-list';
  s.data.forEach((c) => {
    const r = document.createElement('div'); r.className = 'pt-pick-item';
    const info = document.createElement('div');
    const n = document.createElement('div'); n.className = 'pt-person-name'; n.textContent = c.name;
    const m = document.createElement('div'); m.className = 'pt-meet-sum'; m.textContent = [c.title, c.company, c.email, c.mobile].filter(Boolean).join(' · ');
    info.append(n, m);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pt-hidden-btn'; b.textContent = 'Use';
    b.disabled = !ptPickRow;
    b.addEventListener('click', () => { if (ptPickRow) ptSaveContact(ptPickRow, c); });
    r.append(info, b); ul.appendChild(r);
  });
  el.appendChild(ul);
  if (s.truncated) note('More contacts match; refine the search to narrow it down.');
});

/* ---------- Role / Level editor (free text with suggestions from existing values) ---------- */
let ptEdit = null;
let ptEditMsg = '';
function ptOpenEdit(row, field) {
  ptEdit = { row, field };
  ptEditMsg = '';
  document.querySelectorAll('#pt-crm-picker').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('#pt-edit-panel').forEach((p) => { p.hidden = false; });
  document.querySelectorAll('.pt-edit-q').forEach((q) => { q.value = row[field] || ''; q.focus(); q.select(); });
  dash.draw('editTitle'); dash.draw('editOptions'); dash.draw('editStatus');
}
function ptCloseEdit() { ptEdit = null; ptEditMsg = ''; document.querySelectorAll('#pt-edit-panel').forEach((p) => { p.hidden = true; }); }
async function ptSaveEdit() {
  if (!ptEdit) return;
  let v = '';
  document.querySelectorAll('.pt-edit-q').forEach((q) => { v = String(q.value || '').trim(); });
  const { row, field } = ptEdit;
  ptEditMsg = 'Saving…'; dash.draw('editStatus');
  const mcp = await ptMcp();
  if (!mcp) { ptEditMsg = 'This view can’t write to Google Sheets. Open the dashboard in claude.ai to save.'; dash.draw('editStatus'); return; }
  try {
    await ptWriteCells(mcp, row, { [field]: v });
    ptEditMsg = 'Saved.'; dash.draw('editStatus');
    dash.refresh('projectRoster');
    setTimeout(ptCloseEdit, 900);
  } catch (err) {
    ptEditMsg = ptErrText(err);
    dash.draw('editStatus');
  }
}
document.querySelectorAll('#pt-edit-save').forEach((b) => b.addEventListener('click', ptSaveEdit));
document.querySelectorAll('#pt-edit-close').forEach((b) => b.addEventListener('click', ptCloseEdit));
document.querySelectorAll('.pt-edit-q').forEach((q) => q.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ptSaveEdit(); if (ev.key === 'Escape') ptCloseEdit(); }));
dash.draw('editTitle', (el) => {
  el.textContent = ptEdit ? 'Change ' + (ptEdit.field === 'role' ? 'role' : 'level') + ' · ' + (ptEdit.row.tier1 || '') + ' › ' + (ptEdit.row.tier2 || '') + ' · ' + (ptEdit.row.role || '') : '';
});
dash.draw('editOptions', (el) => {
  el.replaceChildren();
  if (!ptEdit) return;
  const s = dash.data('projectRoster');
  const base = ptEdit.field === 'level' ? ['Lead', 'Support'] : [];
  const seen = new Set(base);
  if (s.status === 'ok' && Array.isArray(s.data)) s.data.forEach((r) => { const v = r[ptEdit.field]; if (v) seen.add(v); });
  [...seen].sort((a, b) => a.localeCompare(b)).forEach((v) => { const o = document.createElement('option'); o.value = v; el.appendChild(o); });
});
dash.draw('editStatus', (el) => {
  el.replaceChildren();
  if (ptEditMsg) { const d = document.createElement('div'); d.className = 'pt-empty'; d.textContent = ptEditMsg; el.appendChild(d); }
});
