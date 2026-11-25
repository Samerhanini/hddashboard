import { loadProjects } from '@/lib/server/zohoProjects';
import { rowsResponse } from '@/lib/server/respond';

export async function GET() {
  return rowsResponse('projects from Zoho', loadProjects);
}
