import type { NextRequest } from 'next/server';
import { loadProjectHours } from '@/lib/server/zohoProjects';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { isValid } from '@/lib/validate';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!isValid('project_id', projectId)) return badInput('Invalid project id.');
  return rowsResponse('logged hours from Zoho', () => loadProjectHours(projectId));
}
