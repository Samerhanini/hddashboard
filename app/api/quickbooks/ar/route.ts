import { loadQbAr } from '@/lib/server/finance';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('QuickBooks A/R aging', loadQbAr);
}
