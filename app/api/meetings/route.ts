import type { NextRequest } from 'next/server';
import { loadMeetings } from '@/lib/server/google';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { isValid } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const bldg = req.nextUrl.searchParams.get('bldg');
  if (!isValid('bldg', bldg)) return badInput('Invalid building key.');
  return rowsResponse('meeting notes from Google Drive', () => loadMeetings(bldg));
}
