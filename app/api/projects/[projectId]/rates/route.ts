import { type NextRequest } from 'next/server';
import { loadProjectRates } from '@/lib/server/zohoProjects';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { isValid } from '@/lib/validate';

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!isValid('project_id', projectId)) return badInput('Invalid project id.');

  // Billable rate per hour for each user on the project, from Zoho Projects
  // (GET /projects/{id}/users, scope ZohoProjects.users.READ). Answers
  // available: false with no rows when the token lacks that scope, so the
  // Resources tab shows hours without costs instead of failing.
  return rowsResponse('billable rates from Zoho', () => loadProjectRates(projectId));
}
