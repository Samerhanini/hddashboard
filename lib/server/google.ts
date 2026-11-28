import type { AgendaNoteRow, ApiRows, MeetingRow } from '../types';
import { loadAgendaNotes as loadAgendaNotesLive } from './agendaNotes';
import { loadLiveMeetings } from './googleDrive';

// Google Drive (meetings) and the Google Sheets Agenda tab (agendaNotes).
// Meetings are live from Drive (stage 5) and agenda notes are live from
// the "Agenda" tab of the Project Roles Matrix sheet; both loaders throw
// when the service account is not set or the read fails, so the route
// answers 502 instead of silently falling back to sample data.

/** Gemini notes whose title contains the building key, newest first (50 max, like the original). */
export async function loadMeetings(bldg: string): Promise<ApiRows<MeetingRow>> {
  return loadLiveMeetings(bldg);
}

export async function loadAgendaNotes(): Promise<ApiRows<AgendaNoteRow>> {
  return loadAgendaNotesLive();
}
