import type { AgendaNoteRow, ApiRows, CrmContactRow, MeetingRow } from '../types';
import { sampleAgendaNotes, sampleCrmContacts, sampleMeetings } from '../fixtures/people';

// Google Drive (meetings), Google Sheets Agenda tab (agendaNotes) and Zoho CRM (crmContacts).
// Sample rows until the credentials are set; the live calls are added in stage 5.

/** Gemini notes whose title contains the building key, newest first (50 max, like the original). */
export async function loadMeetings(bldg: string): Promise<ApiRows<MeetingRow>> {
  const b = bldg.toLowerCase();
  const rows = sampleMeetings
    .filter((m) => m.title.toLowerCase().includes(b))
    .sort((a, c) => Date.parse(c.date || '') - Date.parse(a.date || ''))
    .map(({ title: _title, ...m }) => m);
  return { rows: rows.slice(0, 50), truncated: rows.length > 50, source: 'sample' };
}

export async function loadAgendaNotes(): Promise<ApiRows<AgendaNoteRow>> {
  return { rows: sampleAgendaNotes(), source: 'sample' };
}

/** Zoho CRM contacts matching a name, company or email (20 max). */
export async function searchCrmContacts(q: string): Promise<ApiRows<CrmContactRow>> {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = sampleCrmContacts.filter((c) => {
    const hay = [c.name, c.company, c.email, c.title].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  return { rows: rows.slice(0, 20), truncated: rows.length > 20, source: 'sample' };
}
