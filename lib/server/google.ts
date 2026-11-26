import type { AgendaNoteRow, ApiRows, MeetingRow } from '../types';
import { sampleAgendaNotes, sampleMeetings } from '../fixtures/people';

// Google Drive (meetings) and the Google Sheets Agenda tab (agendaNotes).
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
