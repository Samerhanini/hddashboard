'use client';

import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/lib/rules';
import { useCrmContacts, useRoster } from '@/lib/hooks';
import type { CrmContactRow, RosterRow } from '@/lib/types';
import { RULES } from '@/lib/validate';
import { useDashboard } from '../DashboardContext';

// Default tiers (Tier 1 -> its Tier 2 groups). Extra tiers found in the sheet are appended.
const PT_TIERS: [string, string[]][] = [
  ['Development', ['Sponsors', 'Development']],
  ['Legal', ['Acquisition Legal', 'Construction Legal', 'HTC Legal', 'LIHTC Legal', 'Land Use', 'Tax Abatement', 'Agency Legal']],
  ['Design', ['Architecture', 'MEP', 'Structural', 'Planning', 'Civil', 'Traffic', 'Elevator', 'Geotechnical', 'Energy']],
  ['Consultants', ['Environmental', 'Surveyor', 'Expeditor', 'Affordable Housing']],
  ['Construction', ['Construction Manager', 'General Contractor', 'Expeditor']],
  ['Property Management', ['Property Manager', 'Marketing', 'Social Media Marketing']],
];
const norm = (s: string) => String(s || '').trim().toLowerCase();

// Which Tier 1 groups are open; kept across project and view switches, like the original.
const areaOpen = new Set(['T1:Development']);

type RowRef = Pick<RosterRow, 'sheet_row' | 'id' | 'project'>;
const ref = (r: RosterRow): RowRef => ({ sheet_row: r.sheet_row, id: r.id, project: r.project });

/** Call /api/roster. Returns null on success, or a message to show. `conflict` means the roster should be reloaded. */
async function rosterCall(method: 'PATCH' | 'POST' | 'DELETE', body: object): Promise<{ message: string; conflict: boolean } | null> {
  try {
    const res = await fetch('/api/roster', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const b = await res.json().catch(() => ({}));
    return { message: b.message || b.error || 'Couldn’t change the roster.', conflict: res.status === 409 };
  } catch {
    return { message: 'The website didn’t answer. The change may or may not have gone through; check the sheet before trying again.', conflict: false };
  }
}

export default function OverviewView() {
  const { project } = useDashboard();
  const rs = useRoster();
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState<{ row: RosterRow; field: 'role' | 'level' } | null>(null);
  const [pickRow, setPickRow] = useState<RosterRow | null>(null);
  const [, force] = useState(0);

  // A note about the last change belongs to the project it was made on.
  useEffect(() => { setNote(''); setEdit(null); setPickRow(null); }, [project?.id]);

  const removeRow = async (r: RosterRow) => {
    setNote('Removing ' + (r.role || 'line') + '…');
    const err = await rosterCall('DELETE', ref(r));
    if (!err) setNote('Removed ' + (r.role || 'the line') + '.');
    else setNote(err.message);
    rs.refresh();
  };
  const addRow = async (t1: string, t2: string) => {
    if (!project) return;
    setNote('Adding a line under ' + t1 + ' › ' + t2 + '…');
    const err = await rosterCall('POST', { project: project.name, tier1: t1, tier2: t2 });
    setNote(err ? err.message : 'Added a “New role” line under ' + t1 + ' › ' + t2 + '. Use its circles to set the role, level and contact.');
    rs.refresh();
  };

  let body: React.ReactNode = null;
  if (rs.status === 'error') body = <div className="pt-empty">Failed to load the roster: {rs.message || ''}</div>;
  else if (rs.status === 'ok' && project) {
    const roster = rs.data.filter((r) => r.project === project.name);
    const tiers: [string, string[]][] = PT_TIERS.map(([t1, t2s]) => [t1, t2s.slice()]);
    roster.forEach((r) => {
      let t = tiers.find(([a]) => norm(a) === norm(r.tier1));
      if (!t) { t = [r.tier1 || 'Other', []]; tiers.push(t); }
      if (!t[1].some((x) => norm(x) === norm(r.tier2))) t[1].push(r.tier2 || 'General');
    });
    body = (
      <>
        {note && <div className="pt-empty">{note}</div>}
        {!roster.length && <div className="pt-empty">This project has no rows in the Project Team Roster sheet yet. Add rows with its project name to fill in the tiers below.</div>}
        {tiers.map(([t1, t2s], ti) => {
          const rows1 = roster.filter((r) => norm(r.tier1) === norm(t1));
          const tc = COLORS[ti % COLORS.length];
          const key = 'T1:' + t1;
          return (
            <details key={t1} className="pt-area pt-tier1" id={'overview-' + t1.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
              open={areaOpen.has(key)}
              onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) areaOpen.add(key); else areaOpen.delete(key); force((n) => n + 1); }}
              style={{ borderColor: `color-mix(in srgb, ${tc} 45%, var(--color-border-line))` }}>
              <summary className="pt-area-sum" style={{ background: `color-mix(in srgb, ${tc} 16%, var(--color-panel))`, borderLeft: '4px solid ' + tc }}>
                <span className="pt-area-title">{t1}</span>
                <span className="pt-area-meta">{rows1.length ? rows1.length + ' role' + (rows1.length === 1 ? '' : 's') : 'No roles listed'}</span>
              </summary>
              <div className="pt-area-body">
                {t2s.map((t2) => {
                  const rows2 = rows1.filter((r) => norm(r.tier2) === norm(t2));
                  const addTitle = 'Add a line under ' + t1 + ' › ' + t2;
                  return (
                    <div key={t2}>
                      <h3 className="pt-af-h3 pt-tier2" style={{ background: `color-mix(in srgb, ${tc} 6%, var(--color-panel))`, borderLeft: `2px solid color-mix(in srgb, ${tc} 45%, transparent)` }}>
                        <span>{t2}</span>
                        <button type="button" className="pt-add-line" title={addTitle} aria-label={addTitle} onClick={() => addRow(t1, t2)}>+</button>
                      </h3>
                      {rows2.length ? (
                        <RosterTable rows={rows2}
                          onEdit={(r, f) => { setPickRow(null); setEdit({ row: r, field: f }); }}
                          onPick={(r) => { setEdit(null); setPickRow(r); }}
                          onRemove={removeRow} />
                      ) : <div className="pt-empty">No roles listed.</div>}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </>
    );
  }

  const printList = () => {
    const root = document.getElementById('project-overview');
    const details = root ? Array.from(root.querySelectorAll('details')) : [];
    const closed = details.filter((d) => !d.open);
    closed.forEach((d) => { d.open = true; });
    const restore = () => { closed.forEach((d) => { d.open = false; }); window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  return (
    <section className="pt-card" id="project-overview">
      <div className="pt-overview-head">
        <div>
          <h2 className="pt-h2">{project ? project.name + ' — team roles and responsibilities' : 'Team roles and responsibilities'}</h2>
          <p className="pt-sub">Team roster from the Project Team Roster Google Sheet{rs.source === 'sample' ? ' · sample data' : rs.source === 'live' ? ' · live' : ''}</p>
        </div>
        <button type="button" className="pt-print-btn" onClick={printList}>Print contact list</button>
      </div>
      <div className={rs.status === 'loading' ? 'dash-skeleton' : undefined} style={rs.status === 'loading' ? { minHeight: 160 } : undefined}>{body}</div>
      {edit && <EditPanel key={edit.row.id + edit.field} edit={edit} allRows={rs.data} onClose={() => setEdit(null)} onSaved={rs.refresh} />}
      {pickRow && <ContactPicker key={pickRow.id} row={pickRow} onClose={() => setPickRow(null)} onSaved={rs.refresh} />}
    </section>
  );
}

const COLS: [keyof RosterRow, string, string][] = [['role', 'Role', '180px'], ['level', 'Level', '80px'], ['contact', 'Name', '180px'], ['firm', 'Company', '180px'], ['contact_email', 'Email', '230px'], ['phone', 'Phone', '140px']];

function RosterTable({ rows, onEdit, onPick, onRemove }: {
  rows: RosterRow[]; onEdit: (r: RosterRow, f: 'role' | 'level') => void; onPick: (r: RosterRow) => void; onRemove: (r: RosterRow) => void;
}) {
  return (
    <div className="pt-table-wrap pt-roster">
      <table className="pt-table pt-roster-table">
        <colgroup>{COLS.map(([f, , w]) => <col key={f} style={{ width: w }} />)}<col style={{ width: 30 }} /></colgroup>
        <thead><tr>{COLS.map(([, l]) => <th key={l}>{l}</th>)}<th aria-label="Remove" /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {COLS.map(([f]) => {
                const v = String(r[f] || '');
                const editable = f === 'role' || f === 'level' || f === 'contact';
                // The small circle before Role / Level / Name opens an editor (Name opens the Zoho CRM contact picker).
                const dotTitle = 'Change ' + f + ' for ' + (r.role || 'this row');
                return (
                  <td key={f} title={v} className={editable ? 'pt-dot-cell' : undefined}>
                    {editable && <button type="button" className="pt-pick-dot" title={dotTitle} aria-label={dotTitle}
                      onClick={() => (f === 'contact' ? onPick(r) : onEdit(r, f as 'role' | 'level'))} />}
                    <span className={v ? undefined : 'pt-muted'}>{v || '—'}</span>
                  </td>
                );
              })}
              <td className="pt-x-cell"><RemoveButton row={r} onRemove={onRemove} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** × removes the row from the sheet; click twice to confirm (the confirm resets after 4 seconds). */
function RemoveButton({ row, onRemove }: { row: RosterRow; onRemove: (r: RosterRow) => void }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t); }, [confirm]);
  return (
    <button type="button" className={'pt-meet-x' + (confirm ? ' pt-x-confirm' : '')}
      title={confirm ? 'Click again to remove this line from the roster sheet' : 'Remove this line'}
      aria-label={'Remove ' + (row.role || 'line')}
      onClick={() => { if (!confirm) setConfirm(true); else { setConfirm(false); onRemove(row); } }}>
      {confirm ? 'Remove?' : '×'}
    </button>
  );
}

/** Role / Level editor: free text with suggestions from existing values. */
function EditPanel({ edit, allRows, onClose, onSaved }: {
  edit: { row: RosterRow; field: 'role' | 'level' }; allRows: RosterRow[]; onClose: () => void; onSaved: () => void;
}) {
  const { row, field } = edit;
  const [value, setValue] = useState(row[field] || '');
  const [msg, setMsg] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);

  const options = [...new Set([...(field === 'level' ? ['Lead', 'Support'] : []), ...allRows.map((r) => r[field]).filter(Boolean)])].sort((a, b) => a.localeCompare(b));

  const save = async () => {
    setMsg('Saving…');
    const err = await rosterCall('PATCH', { ...ref(row), values: { [field]: value.trim() } });
    if (err) { setMsg(err.message); if (err.conflict) onSaved(); return; }
    setMsg('Saved.');
    onSaved();
    setTimeout(onClose, 900);
  };

  return (
    <div className="pt-picker" id="pt-edit-panel">
      <div className="pt-proj-head">
        <h3 className="pt-af-h3">Change {field === 'role' ? 'role' : 'level'} · {row.tier1 || ''} › {row.tier2 || ''} · {row.role || ''}</h3>
        <button type="button" className="pt-hidden-btn" onClick={onClose}>Close</button>
      </div>
      <div className="pt-picker-row">
        <input ref={input} className="dash-input pt-edit-q" type="text" list="pt-edit-options" aria-label="New value" maxLength={300}
          value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onClose(); }} />
        <datalist id="pt-edit-options">{options.map((o) => <option key={o} value={o} />)}</datalist>
        <button type="button" className="pt-hidden-btn" onClick={() => void save()}>Save</button>
      </div>
      {msg && <div className="pt-empty">{msg}</div>}
    </div>
  );
}

/** Zoho CRM contact picker: sets Firm, Contact, Email, CRM ID and Phone on a roster row. */
function ContactPicker({ row, onClose, onSaved }: { row: RosterRow; onClose: () => void; onSaved: () => void }) {
  const initial = String(row.contact || '').trim();
  const [text, setText] = useState(initial);
  const [q, setQ] = useState<string | null>(RULES.crmq.test(initial) ? initial : null);
  const [msg, setMsg] = useState('');
  const s = useCrmContacts(q);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const search = () => {
    const v = text.trim();
    if (!RULES.crmq.test(v)) { setMsg('Type at least 2 letters (letters, numbers, spaces, . @ - only).'); return; }
    setMsg('');
    setQ(v);
  };

  const use = async (c: CrmContactRow) => {
    setMsg('Saving ' + c.name + ' to the roster…');
    const err = await rosterCall('PATCH', {
      ...ref(row),
      values: { firm: c.company || row.firm || '', level: row.level || '', contact: c.name, contact_email: c.email || '', crm_id: c.id, phone: c.mobile || '' },
    });
    if (err) { setMsg(err.message); if (err.conflict) onSaved(); return; }
    setMsg('Saved ' + c.name + (c.company ? ' (' + c.company + ')' : '') + ' as ' + row.role + '.');
    onSaved();
    setTimeout(onClose, 1200);
  };

  let results: React.ReactNode = null;
  if (s.status === 'error') results = <div className="pt-empty">Zoho CRM search failed: {s.message || 'unknown error'}</div>;
  else if (s.status === 'ok') {
    results = !s.data.length ? <div className="pt-empty">No Zoho CRM contacts match “{q}”.</div> : (
      <>
        <div className="pt-pick-list">
          {s.data.map((c) => (
            <div key={c.id} className="pt-pick-item">
              <div>
                <div className="pt-person-name">{c.name}</div>
                <div className="pt-meet-sum">{[c.title, c.company, c.email, c.mobile].filter(Boolean).join(' · ')}</div>
              </div>
              <button type="button" className="pt-hidden-btn" onClick={() => void use(c)}>Use</button>
            </div>
          ))}
        </div>
        {s.truncated && <div className="pt-empty">More contacts match; refine the search to narrow it down.</div>}
      </>
    );
  }

  return (
    <div className="pt-picker" id="pt-crm-picker">
      <div className="pt-proj-head">
        <h3 className="pt-af-h3">Choose a contact for {row.role}{row.firm ? ' · ' + row.firm : ''}{row.level ? ' (' + row.level + ')' : ''}</h3>
        <button type="button" className="pt-hidden-btn" onClick={onClose}>Close</button>
      </div>
      <div className="pt-picker-row">
        <input ref={input} className="dash-input pt-pick-q" type="search" placeholder="Search Zoho CRM contacts by name, company or email" aria-label="Search Zoho CRM contacts"
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} />
        <button type="button" className="pt-hidden-btn" onClick={search}>Search</button>
      </div>
      <div className={s.status === 'loading' ? 'dash-skeleton' : undefined} style={s.status === 'loading' ? { minHeight: 60 } : undefined}>
        {msg && <div className="pt-empty">{msg}</div>}
        {results}
      </div>
    </div>
  );
}
