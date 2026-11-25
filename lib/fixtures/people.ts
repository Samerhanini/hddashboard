// Made-up sample roster, CRM contacts, meeting notes and agenda notes, shaped like the
// projectRoster, crmContacts, meetings and agendaNotes loaders in reference/data-loaders.js.

import type { AgendaNoteRow, CrmContactRow, MeetingRow, RosterRow } from '../types';
import { weekKey } from '../rules';

// Column layout of the sample Roster tab (the live one is read from the sheet's header row).
export const SAMPLE_ROSTER_HEADER = ['Row ID', 'Project', 'Tier 1', 'Tier 2', 'Role', 'Level', 'Firm', 'Contact', 'Contact Email', 'CRM Contact ID', 'Phone'];

type R = [string, string, string, string, string, string, string, string, string];
const P609 = 'HD609BRO-609 Broad St Mixed Use';
const P153 = 'UC153HAL-J04 Halsey Interior Fit-out';
const raw: [string, R][] = [
  [P609, ['Development', 'Sponsors', 'Managing Sponsor', 'Lead', 'Hanini Development', 'Sample Person A', 'person.a@example.com', '', '555-0101']],
  [P609, ['Development', 'Development', 'Project Manager', 'Lead', 'Hanini Development', 'Sample Person B', 'person.b@example.com', '', '555-0102']],
  [P609, ['Development', 'Development', 'Assistant PM', 'Support', 'Hanini Development', '', '', '', '']],
  [P609, ['Legal', 'Land Use', 'Land use counsel', 'Lead', 'Example Law LLP', 'Avery Example', 'avery@example-law.test', '', '555-0110']],
  [P609, ['Design', 'Architecture', 'Architect of record', 'Lead', 'Example Architects', 'Jordan Sample', 'jordan@example-arch.test', '', '555-0120']],
  [P609, ['Design', 'MEP', 'MEP engineer', 'Lead', 'Sample MEP Co', '', '', '', '']],
  [P609, ['Construction', 'General Contractor', 'GC', 'Lead', 'Urban Core Builders', 'Sample PM D', 'pm.d@example.com', '', '555-0130']],
  [P609, ['Lender Group', 'Construction Lender', 'Loan officer', 'Lead', 'Sample Community Bank', 'Casey Example', 'casey@example-bank.test', '', '555-0140']],
  [P153, ['Construction', 'Construction Manager', 'Superintendent', 'Lead', 'Urban Core Builders', 'Sample PM D', 'pm.d@example.com', '', '555-0130']],
  [P153, ['Design', 'Architecture', 'Interior architect', 'Lead', 'Example Interiors', 'Riley Placeholder', 'riley@example-int.test', '', '']],
];

const COLMAP = JSON.stringify({ _n: 11, row_id: 'A', project: 'B', tier1: 'C', tier2: 'D', role: 'E', level: 'F', firm: 'G', contact: 'H', contact_email: 'I', crm_id: 'J', phone: 'K' });

export function sampleRoster(): RosterRow[] {
  return raw.map(([project, r], i) => ({
    id: String(i + 1), sheet_row: i + 2, project,
    tier1: r[0], tier2: r[1], role: r[2], level: r[3], firm: r[4], contact: r[5], contact_email: r[6], crm_id: r[7], phone: r[8],
    colmap: COLMAP,
  }));
}

export const sampleCrmContacts: CrmContactRow[] = [
  { id: '7000000000001', name: 'Avery Example', company: 'Example Law LLP', title: 'Partner', email: 'avery@example-law.test', mobile: '555-0110' },
  { id: '7000000000002', name: 'Jordan Sample', company: 'Example Architects', title: 'Principal', email: 'jordan@example-arch.test', mobile: '555-0120' },
  { id: '7000000000003', name: 'Casey Example', company: 'Sample Community Bank', title: 'Vice President', email: 'casey@example-bank.test', mobile: '555-0140' },
  { id: '7000000000004', name: 'Riley Placeholder', company: 'Example Interiors', title: 'Designer', email: 'riley@example-int.test', mobile: '' },
  { id: '7000000000005', name: 'Morgan Sample', company: 'Sample MEP Co', title: 'Project Engineer', email: 'morgan@sample-mep.test', mobile: '555-0150' },
  { id: '7000000000006', name: 'Taylor Example', company: 'Sample MEP Co', title: 'Principal', email: 'taylor@sample-mep.test', mobile: '555-0151' },
  { id: '7000000000007', name: 'Quinn Testcase', company: 'Example Surveyors', title: 'Surveyor', email: 'quinn@example-survey.test', mobile: '' },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const doc = (id: string) => 'https://docs.google.com/document/d/' + id + '/edit';

// Rows as the meetings loader produces them; `title` is kept so the route can filter like Drive's "title contains".
export const sampleMeetings: (MeetingRow & { title: string })[] = [
  { id: 'sample-doc-1', title: '609 Broad weekly - 2026/11/18 10:00 EST - Notes by Gemini', meeting: '609 Broad weekly', date: daysAgo(7), summary: 'The team reviewed the lender’s draft term sheet and agreed to push back on the completion guarantee. The architect will issue the 50% DD set next week.', next_steps: 'Sample Person B will send comments on the term sheet to the lender\nJordan Sample will circulate the DD set\nAvery Example will confirm the planning board hearing date', url: doc('sample-doc-1'), owner: 'Sample Person B' },
  { id: 'sample-doc-2', title: '609 Broad weekly - 2026/11/11 10:00 EST - Notes by Gemini', meeting: '609 Broad weekly', date: daysAgo(14), summary: 'Discussion focused on the MEP coordination schedule and the retail tenant LOI.', next_steps: 'Sample Person A will follow up on the LOI\nThe MEP engineer will send revised load calculations…', url: doc('sample-doc-2'), owner: 'Sample Person B' },
  { id: 'sample-doc-3', title: '609 Broad lender call - 2026/11/03 14:00 EST - Notes by Gemini', meeting: '609 Broad lender call', date: daysAgo(22), summary: 'The lender walked through the appraisal timeline and closing conditions.', next_steps: '', url: doc('sample-doc-3'), owner: 'Sample Person A' },
  { id: 'sample-doc-4', title: 'UC 609 Broad site logistics - 2026/11/20 08:30 EST - Notes by Gemini', meeting: 'UC 609 Broad site logistics', date: daysAgo(5), summary: 'Urban Core reviewed crane placement and street closure permits for 609 Broad.', next_steps: 'Sample PM D will file the street opening permit', url: doc('sample-doc-4'), owner: 'Sample PM D' },
  { id: 'sample-doc-5', title: 'UC 153 Halsey OAC - 2026/11/19 09:00 EST - Notes by Gemini', meeting: 'UC 153 Halsey OAC', date: daysAgo(6), summary: 'Owner-architect-contractor meeting: millwork submittals approved, two RFIs open on ceiling heights.', next_steps: 'Riley Placeholder will answer RFIs 14 and 15\nSample PM D will update the three-week lookahead', url: doc('sample-doc-5'), owner: 'Sample PM D' },
  { id: 'sample-doc-6', title: '12 Main kickoff - 2026/10/28 11:00 EST - Notes by Gemini', meeting: '12 Main kickoff', date: daysAgo(28), summary: 'Kickoff for the 12 Main St rehab: scope, budget and team roles.', next_steps: 'Sample Person B will set up the weekly meeting', url: doc('sample-doc-6'), owner: 'Sample Person B' },
];

/** Sample Agenda tab rows for this week and last week (so the "Last week" fallback is visible). */
export function sampleAgendaNotes(): AgendaNoteRow[] {
  const now = new Date();
  const wk = weekKey(now), prev = weekKey(now, 1);
  const rows: Omit<AgendaNoteRow, 'id'>[] = [
    { project: P609, week: prev, section: 'Schedule and critical path', item: 'Current phase and next milestone', last_week: '', this_week: 'Financing phase; term sheet due', upcoming: '', source: 'sample notes' },
    { project: P609, week: wk, section: 'Schedule and critical path', item: 'Current phase and next milestone', last_week: '', this_week: 'Term sheet received; DD set at 50%', upcoming: 'Lender appraisal kickoff', source: '609 Broad weekly' },
    { project: P609, week: wk, section: 'Schedule and critical path', item: 'Slipped phase dates and what’s driving them', last_week: 'Permitting moved two weeks', this_week: 'No new slips', upcoming: '', source: '609 Broad weekly' },
    { project: P609, week: wk, section: 'Entitlements and approvals', item: 'Planning board, zoning, landmarks/SHPO submissions and hearings', last_week: 'Application filed', this_week: 'Hearing date to be confirmed', upcoming: 'Planning board hearing', source: '609 Broad weekly' },
    { project: P609, week: wk, section: 'Design', item: 'Stage: schematic, DD, CDs, permit set', last_week: '', this_week: 'DD at 50%', upcoming: '100% DD in three weeks', source: '609 Broad weekly' },
    { project: P609, week: wk, section: 'Financing and capital', item: 'Debt: term sheets, appraisal, loan commitment, closing conditions', last_week: 'Waiting on lender', this_week: 'Comments on completion guarantee sent', upcoming: 'Appraisal', source: '609 Broad weekly' },
    { project: P609, week: wk, section: 'Risks and decisions needed', item: 'Decisions needed from sponsors this week', last_week: '', this_week: 'Approve guarantee position', upcoming: '', source: '609 Broad weekly' },
    { project: P153, week: wk, section: 'Construction, when active', item: 'Change orders and RFIs needing decisions', last_week: 'RFI 12 closed', this_week: 'RFIs 14 and 15 open', upcoming: 'CO 3 pricing', source: 'UC 153 Halsey OAC' },
  ];
  return rows.map((r, i) => ({ id: String(i + 2), ...r }));
}
