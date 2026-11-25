import { loadAfLoans } from '@/lib/server/finance';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('AppFolio loans', loadAfLoans);
}
