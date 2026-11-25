import { loadAgendaNotes } from '@/lib/server/google';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('agenda notes from Google Sheets', loadAgendaNotes);
}
