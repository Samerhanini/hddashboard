import { loadAfSpend } from '@/lib/server/finance';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('AppFolio spend', loadAfSpend);
}
