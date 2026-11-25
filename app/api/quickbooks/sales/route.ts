import { loadQbSales } from '@/lib/server/finance';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('QuickBooks sales by customer', loadQbSales);
}
