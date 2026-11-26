import type { NextRequest } from 'next/server';
import { searchCrmContacts } from '@/lib/server/zohoCrm';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { isValid } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!isValid('crmq', q)) return badInput('Type at least 2 letters (letters, numbers, spaces, . @ - only).');
  return rowsResponse('Zoho CRM contacts', () => searchCrmContacts(q));
}
