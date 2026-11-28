import type { AgendaNoteRow, ApiRows, MeetingRow } from '../types';
import { sampleAgendaNotes } from '../fixtures/people';
import { loadLiveMeetings } from './googleDrive';

// Google Drive (meetings) and the Google Sheets Agenda tab (agendaNotes).
// Meetings are live from Drive (stage 5); the loader throws when the
// service account is not set or Drive fails, so the route answers 502
// instead of silently falling back to sample data. Agenda is still
// sample — its live connection is a separate step.

/** Gemini notes whose title contains the building key, newest first (50 max, like the original). */
export async function loadMeetings(bldg: string): Promise<ApiRows<MeetingRow>> {
  return loadLiveMeetings(bldg);
}

export async function loadAgendaNotes(): Promise<ApiRows<AgendaNoteRow>> {
  return { rows: sampleAgendaNotes(), source: 'sample' };
}
