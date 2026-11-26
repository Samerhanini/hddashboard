import { NextResponse, type NextRequest } from 'next/server';
import { debugProjectHours, loadProjectHours } from '@/lib/server/zohoProjects';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { requireSession } from '@/lib/server/session';
import { zohoReady } from '@/lib/server/zoho';
import { isValid } from '@/lib/validate';

export async function GET(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  if (!isValid('project_id', projectId)) return badInput('Invalid project id.');

  // ?debug=1 shows what Zoho returns for this project's tasks (signed-in users only, no credentials).
  if (req.nextUrl.searchParams.get('debug') === '1') {
    const denied = await requireSession();
    if (denied) return denied;
    if (!zohoReady()) return NextResponse.json({ error: 'Zoho is not connected, so there is nothing to check.' }, { status: 400 });
    try {
      return NextResponse.json(await debugProjectHours(projectId), { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      return NextResponse.json({ error: String(err instanceof Error ? err.message : err).slice(0, 500) }, { status: 502 });
    }
  }

  return rowsResponse('logged hours from Zoho', () => loadProjectHours(projectId));
}
