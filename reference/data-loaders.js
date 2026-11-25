/*
  Data loaders from the original dashboard (copied as-is).

  In the original, each dataset in datasets.json was fetched by Claude's runtime through an MCP connector,
  and then dash.loader(id, { fn }) turned the raw answer into rows. `answer` is the connector's JSON answer;
  `items` is its text content (QuickBooks answered with markdown tables); `call(tool, args)` made another call
  on the same connector; `args` are the dataset's args with filters filled in.

  For the website: move these into the server-side API routes. The row shapes they return
  (columns lists below) are what the UI code in ui.js expects, so keep those shapes.
  Note the connector answers are close to, but not always identical to, the vendors' raw REST answers:
   - Zoho Projects V3 REST returns { projects: [...] } / { tasks: [...], page_info } — matches.
   - QuickBooks REST Reports return structured JSON, not markdown; write a new parser for qbSales / qbAR
     that yields the same columns.
   - Google Drive REST has no contentSnippet; export each doc as text to get Summary / Next steps.
*/

function decode(s) {
  return String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---------- projects (Zoho Projects get_projects_list) ----------
dash.loader('projects', {
  description: 'Keeps one row per project with its group, status, owner, progress and task counts.',
  fn: ({ answer }) => {
    const dec = decode;
    if (answer && answer.status && answer.status !== 'success') throw new Error(JSON.stringify(answer).slice(0, 300));
    const root = answer && answer.data ? answer.data : answer;
    const list = (root && (root.result || root.projects)) || [];
    const rows = list.map((p) => ({
      id: String(p.id),
      name: dec(p.name),
      group: dec(p.project_group && p.project_group.name) || 'Ungrouped',
      status: (p.status && p.status.name) || '',
      owner: (p.owner && (p.owner.full_name || p.owner.name)) || '',
      percent_complete: Number(p.percent_complete || 0),
      open_tasks: Number((p.tasks && p.tasks.open_count) || 0),
      closed_tasks: Number((p.tasks && p.tasks.closed_count) || 0),
      start_date: p.start_date || null,
      end_date: p.end_date || null
    }));
    return { columns: ['id', 'name', 'group', 'status', 'owner', 'percent_complete', 'open_tasks', 'closed_tasks', 'start_date', 'end_date'], rows };
  }
});

// ---------- projectTasks (open tasks of the selected project) ----------
dash.loader('projectTasks', {
  description: 'Keeps one row per open task in the clicked project, with its task list, phase, owners, status, progress, start and due date.',
  fn: ({ answer }) => {
    const dec = decode;
    if (answer && answer.status && answer.status !== 'success') throw new Error(JSON.stringify(answer).slice(0, 300));
    const root = answer && answer.data ? answer.data : answer;
    const list = (root && root.tasks) || [];
    const rows = list.map((t) => {
      const owners = ((t.owners_and_work && t.owners_and_work.owners) || []).map((o) => o.name).filter((n) => n && n !== 'Unassigned User');
      return {
        id: String(t.id),
        project_id: String((t.project && t.project.id) || ''),
        task: dec(t.name),
        tasklist: dec(t.tasklist && t.tasklist.name),
        depth: Number(t.depth || 0),
        owners: owners.length ? owners.join(', ') : 'Unassigned',
        status: (t.status && t.status.name) || '',
        completion: Number(t.completion_percentage || 0),
        start: t.start_date || null,
        due: t.end_date || null,
        milestone_id: String((t.milestone && t.milestone.id) || '')
      };
    });
    const more = !!(root && root.page_info && root.page_info.has_next_page);
    return { columns: ['id', 'project_id', 'task', 'tasklist', 'depth', 'owners', 'status', 'completion', 'start', 'due', 'milestone_id'], rows, truncated: more };
  }
});

// ---------- qbSales (QuickBooks Sales by Customer; connector answered with a markdown table) ----------
dash.loader('qbSales', {
  description: 'Reads the Sales by Customer table QuickBooks returns into one row per customer or project with its total sales; subtotal rows are flagged.',
  fn: ({ answer, items }) => {
    const texts = [];
    const walk = (x) => { if (x == null) return; if (typeof x === 'string') { texts.push(x); return; } if (Array.isArray(x)) { x.forEach(walk); return; } if (typeof x === 'object') Object.values(x).forEach(walk); };
    walk(items && items.length ? items : answer);
    const text = texts.join('\n');
    if (/STATUS:\s*error/i.test(text) && !/\| *Customer/.test(text)) throw new Error(text.slice(0, 300));
    const num = (s) => { const t = String(s || '').replace(/[$,\s]/g, ''); if (!t) return 0; const neg = /^\(.*\)$/.test(t); const n = Number(t.replace(/[()]/g, '')); return isNaN(n) ? 0 : (neg ? -n : n); };
    const rows = [];
    let inTable = false;
    text.split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l.startsWith('|')) { inTable = false; return; }
      const cells = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (/^customer$/i.test(cells[0])) { inTable = true; return; }
      if (!inTable || /^-+:?$/.test(cells[0].replace(/:/g, '-')) || /^[-: ]+$/.test(cells.join(''))) return;
      rows.push({ customer: cells[0], is_total: /^total for /i.test(cells[0]), total_sales: num(cells[1]) });
    });
    if (!rows.length && /no customer sales/i.test(text)) return { columns: ['customer', 'is_total', 'total_sales'], rows: [] };
    if (!rows.length) throw new Error('QuickBooks returned no Sales by Customer table: ' + text.slice(0, 200));
    return { columns: ['customer', 'is_total', 'total_sales'], rows };
  }
});

// ---------- qbAR (QuickBooks A/R Aging Summary) ----------
dash.loader('qbAR', {
  description: 'Reads the A/R Aging Summary table QuickBooks returns into one row per customer or project with its open balance by aging bucket; subtotal rows are flagged.',
  fn: ({ answer, items }) => {
    const texts = [];
    const walk = (x) => { if (x == null) return; if (typeof x === 'string') { texts.push(x); return; } if (Array.isArray(x)) { x.forEach(walk); return; } if (typeof x === 'object') Object.values(x).forEach(walk); };
    walk(items && items.length ? items : answer);
    const text = texts.join('\n');
    const num = (s) => { const t = String(s || '').replace(/[$,\s]/g, ''); if (!t) return 0; const neg = /^\(.*\)$/.test(t); const n = Number(t.replace(/[()]/g, '')); return isNaN(n) ? 0 : (neg ? -n : n); };
    const cols = ['customer', 'is_total', 'current', 'd1_30', 'd31_60', 'd61_90', 'd91_plus', 'total'];
    const rows = [];
    let inTable = false;
    text.split(/\r?\n/).forEach((line) => {
      const l = line.trim();
      if (!l.startsWith('|')) { inTable = false; return; }
      const cells = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if (/^customer$/i.test(cells[0])) { inTable = true; return; }
      if (!inTable || /^[-: ]+$/.test(cells.join(''))) return;
      rows.push({ customer: cells[0], is_total: /^total for /i.test(cells[0]), current: num(cells[1]), d1_30: num(cells[2]), d31_60: num(cells[3]), d61_90: num(cells[4]), d91_plus: num(cells[5]), total: num(cells[6]) });
    });
    if (!rows.length && /no outstanding|no open|returned zero rows/i.test(text)) return { columns: cols, rows: [] };
    if (!rows.length) throw new Error('QuickBooks returned no A/R Aging table: ' + text.slice(0, 200));
    return { columns: cols, rows };
  }
});

// ---------- meetings (Google Drive "Notes by Gemini" docs) ----------
dash.loader('meetings', {
  description: 'Keeps one row per Gemini meeting-notes doc whose title names the project, with the meeting name, date, summary sentence, next steps and a link to the doc.',
  fn: ({ answer }) => {
    if (answer && answer.error) throw new Error(typeof answer.error === 'string' ? answer.error : JSON.stringify(answer.error));
    const files = (answer && answer.files) || [];
    const rows = files.map((f) => {
      const title = String(f.title || '');
      const meeting = title.replace(/\s*-\s*Notes by Gemini\s*$/i, '').replace(/\s*-\s*\d{4}\/\d{2}\/\d{2}.*$/, '').trim();
      const lines = String(f.contentSnippet || '').split(/\r?\n/).map((l) => l.trim());
      let summary = '';
      const si = lines.findIndex((l) => /^#+\s*summary$/i.test(l));
      const isMeta = (l) => !l || /^#/.test(l) || /^\[|^</.test(l) || /^(Quick notes|Please rate|Notes|Invited|Attachments|Meeting records)\b/i.test(l) || /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(l) || /^- /.test(l);
      if (si >= 0) summary = (lines.slice(si + 1).find((l) => l && !/^#/.test(l)) || '');
      else {
        const hi = lines.findIndex((l) => /^##\s/.test(l));
        summary = lines.slice(hi + 1).find((l) => !isMeta(l)) || '';
      }
      const ni = lines.findIndex((l) => /^#*\s*next steps$/i.test(l));
      const steps = ni >= 0 ? lines.slice(ni + 1).filter((l) => /^- /.test(l)).map((l) => l.replace(/^-\s*/, '').replace(/\\([\[\]])/g, '$1').replace(/\.\.\.$/, '…')) : [];
      return { id: String(f.id), meeting, date: f.createdTime || f.modifiedTime || null, summary: summary.replace(/\s+/g, ' '), next_steps: steps.join('\n'), url: f.viewUrl || ('https://docs.google.com/document/d/' + f.id + '/edit'), owner: f.owner || '' };
    });
    return { columns: ['id', 'meeting', 'date', 'summary', 'next_steps', 'url', 'owner'], rows, truncated: !!(answer && answer.nextPageToken) };
  }
});

// ---------- projectRoster (Google Sheet, Roster tab) ----------
// Keeps the sheet row number and a column-letter map (colmap) so the UI can write cells back.
dash.loader('projectRoster', {
  description: 'Turns the Roster tab of the Project Team Roster Google Sheet into one row per role, keeping each row’s sheet row number so a picked contact can be written back.',
  fn: ({ answer }) => {
    if (answer && answer.error) throw new Error(typeof answer.error === 'string' ? answer.error : JSON.stringify(answer.error));
    const values = (answer && (answer.values || (answer.content && answer.content.values))) || [];
    if (!values.length) return { columns: [], rows: [] };
    const head = values[0].map((h) => String(h || '').trim().toLowerCase());
    const col = (name) => head.indexOf(name);
    const pick = (r, name) => { const i = col(name); return i >= 0 && r[i] != null ? String(r[i]).trim() : ''; };
    const letter = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
    const fields = { row_id: 'row id', project: 'project', tier1: head.includes('tier 1') ? 'tier 1' : 'section', tier2: 'tier 2', role: 'role', level: 'level', firm: 'firm', contact: 'contact', contact_email: 'contact email', crm_id: 'crm contact id', phone: head.includes('phone') ? 'phone' : 'mobile' };
    const cm = { _n: head.length }; Object.entries(fields).forEach(([k, n]) => { const i = col(n); if (i >= 0) cm[k] = letter(i); });
    const colmap = JSON.stringify(cm);
    const rows = values.slice(1).map((r, i) => ({
      id: pick(r, 'row id') || String(i + 2),
      sheet_row: i + 2,
      project: pick(r, 'project'),
      tier1: pick(r, 'tier 1') || pick(r, 'section'),
      tier2: pick(r, 'tier 2'),
      role: pick(r, 'role'),
      firm: pick(r, 'firm'),
      level: pick(r, 'level'),
      contact: pick(r, 'contact'),
      contact_email: pick(r, 'contact email'),
      crm_id: pick(r, 'crm contact id').replace(/^'/, ''),
      phone: pick(r, 'phone') || pick(r, 'mobile'),
      colmap: colmap
    })).filter((r) => r.project || r.role);
    return { columns: ['id', 'sheet_row', 'project', 'tier1', 'tier2', 'role', 'firm', 'level', 'contact', 'contact_email', 'crm_id', 'phone', 'colmap'], rows };
  }
});

// ---------- crmContacts (Zoho CRM searchRecords on Contacts) ----------
dash.loader('crmContacts', {
  description: 'Keeps one row per Zoho CRM contact that matches the search, with name, company, title and email.',
  fn: ({ answer }) => {
    if (answer && answer.status && answer.status !== 'success' && !(answer.data)) throw new Error(JSON.stringify(answer).slice(0, 300));
    const root = answer && answer.data ? answer.data : answer;
    const list = (root && Array.isArray(root.data)) ? root.data : (Array.isArray(root) ? root : []);
    const rows = list.map((c) => ({
      id: String(c.id),
      name: c.Full_Name || [c.First_Name, c.Last_Name].filter(Boolean).join(' '),
      company: (c.Account_Name && c.Account_Name.name) || '',
      title: c.Title || '',
      email: c.Email || '',
      mobile: c.Mobile || c.Phone || ''
    }));
    return { columns: ['id', 'name', 'company', 'title', 'email', 'mobile'], rows, truncated: !!(root && root.info && root.info.more_records) };
  }
});

// ---------- projectHours (all tasks of the project, every page) ----------
dash.loader('projectHours', {
  description: 'Keeps one row per task owner on each task of the clicked project that has logged hours, with that owner’s even share of the task’s hours. Reads every page of tasks.',
  fn: async ({ answer, call, args }) => {
    const hrs = (s) => { if (!s) return 0; const m = String(s).match(/^(\d+):(\d+)$/); return m ? Number(m[1]) + Number(m[2]) / 60 : Number(s) || 0; };
    const rows = [];
    const take = (ans) => {
      if (ans && ans.status && ans.status !== 'success' && !ans.data) throw new Error(JSON.stringify(ans).slice(0, 300));
      const root = ans && ans.data ? ans.data : ans;
      ((root && root.tasks) || []).forEach((t) => {
        const total = hrs(t.log_hours && t.log_hours.total_hours);
        if (!total) return;
        const owners = ((t.owners_and_work && t.owners_and_work.owners) || []).filter((o) => o && o.name !== 'Unassigned User');
        const names = owners.length ? owners.map((o) => [o.first_name, o.last_name].filter(Boolean).join(' ') || o.name) : ['Unassigned'];
        names.forEach((n) => rows.push({ project_id: String((t.project && t.project.id) || ''), task_id: String(t.id), person: n, owners: names.length, task_hours: Math.round(total * 100) / 100, hours: Math.round(total / names.length * 100) / 100 }));
      });
      const pi = root && root.page_info;
      return !!(pi && pi.has_next_page);
    };
    let more = take(answer);
    let page = 1;
    while (more && page < 10) {
      page += 1;
      const q = Object.assign({}, args.query_params || {}, { page });
      more = take(await call('get_tasks_by_project', Object.assign({}, args, { query_params: q })));
    }
    return { columns: ['project_id', 'task_id', 'person', 'owners', 'task_hours', 'hours'], rows, truncated: more };
  }
});

// ---------- hoursByPerson (calculated from projectHours) ----------
dash.calc('hoursByPerson', {
  inputs: ['projectHours'],
  title: 'Hours by person (estimate)',
  description: 'Logged task hours per person on the selected project, with each shared task’s hours split evenly between its owners.',
  fn: (projectHours) => {
    const m = new Map();
    projectHours.forEach((r) => { const e = m.get(r.person) || { person: r.person, hours: 0, tasks: 0, shared_tasks: 0 }; e.hours += r.hours; e.tasks += 1; if (r.owners > 1) e.shared_tasks += 1; m.set(r.person, e); });
    const total = [...m.values()].reduce((s, e) => s + e.hours, 0);
    return [...m.values()].map((e) => ({ person: e.person, hours: Math.round(e.hours * 10) / 10, share: total ? Math.round(e.hours / total * 1000) / 10 : 0, tasks: e.tasks, shared_tasks: e.shared_tasks })).sort((a, b) => b.hours - a.hours);
  }
});

// ---------- agendaNotes (Google Sheet, Agenda tab) ----------
dash.loader('agendaNotes', {
  description: 'Turns the Agenda tab of the Project Team Roster Google Sheet into one row per project, week and agenda item, with its Last week, This week and Upcoming notes.',
  fn: ({ answer }) => {
    if (answer && answer.error) throw new Error(typeof answer.error === 'string' ? answer.error : JSON.stringify(answer.error));
    const values = (answer && (answer.values || (answer.content && answer.content.values))) || [];
    if (!values.length) return { columns: [], rows: [] };
    const head = values[0].map((x) => String(x || '').trim().toLowerCase());
    const g = (r, n) => { const i = head.indexOf(n); return i >= 0 && r[i] != null ? String(r[i]).trim() : ''; };
    const rows = values.slice(1).map((r, i) => ({ id: String(i + 2), project: g(r, 'project'), week: g(r, 'week'), section: g(r, 'section'), item: g(r, 'item'), last_week: g(r, 'last week'), this_week: g(r, 'this week'), upcoming: g(r, 'upcoming'), source: g(r, 'source') })).filter((r) => r.project && r.item);
    return { columns: ['id', 'project', 'week', 'section', 'item', 'last_week', 'this_week', 'upcoming', 'source'], rows };
  }
});

// ---------- projectPhases (Zoho milestones used by the project's tasks) ----------
dash.loader('projectPhases', {
  description: 'Finds the phases used by the clicked project’s tasks, then reads each phase’s owner, status, status color and start and end dates from Zoho Projects.',
  fn: async ({ answer, call, args }) => {
    const dec = decode;
    const ids = new Map();
    const take = (ans) => {
      if (ans && ans.status && ans.status !== 'success' && !ans.data) throw new Error(JSON.stringify(ans).slice(0, 300));
      const root = ans && ans.data ? ans.data : ans;
      ((root && root.tasks) || []).forEach((t) => { const m = t.milestone; if (m && m.id && m.name && m.name !== 'None') ids.set(String(m.id), dec(m.name)); });
      const pi = root && root.page_info;
      return !!(pi && pi.has_next_page);
    };
    let more = take(answer), page = 1;
    while (more && page < 10) { page += 1; more = take(await call('get_tasks_by_project', Object.assign({}, args, { query_params: Object.assign({}, args.query_params || {}, { page }) }))); }
    const pv = args.path_variables || {};
    const list = [...ids.keys()].slice(0, 60);
    const res = await Promise.all(list.map((id) => call('get_phase_details', { path_variables: { portal_id: pv.portal_id, project_id: pv.project_id, phase_id: id } }).catch(() => null)));
    const rows = [];
    res.forEach((r, i) => {
      const m = r && (r.data || r);
      if (!m || !m.id) return;
      rows.push({
        id: String(m.id),
        project_id: String((m.project && m.project.id) || pv.project_id || ''),
        phase: dec(m.name || ids.get(list[i])),
        owner: m.owner ? [m.owner.first_name, m.owner.last_name].filter(Boolean).join(' ') || m.owner.name || '' : '',
        status: (m.status && m.status.name) || '',
        status_color: (m.status && (m.status.color_hexcode || m.status.color)) || '',
        closed: !!(m.status && (m.status.is_closed_type || m.status.is_closed)),
        start_date: m.start_date || null,
        end_date: m.end_date || null
      });
    });
    return { columns: ['id', 'project_id', 'phase', 'owner', 'status', 'status_color', 'closed', 'start_date', 'end_date'], rows, truncated: more || ids.size > 60 };
  }
});
