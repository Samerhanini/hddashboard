import { NextResponse } from 'next/server';
import { loadProjects } from '@/lib/server/projects';

export async function GET() {
  try {
    const data = await loadProjects();
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=300' } });
  } catch (err) {
    console.error('GET /api/projects failed', err);
    return NextResponse.json({ error: 'Could not load projects from Zoho.' }, { status: 502 });
  }
}
