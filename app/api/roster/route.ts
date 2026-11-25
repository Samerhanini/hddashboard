import { NextResponse, type NextRequest } from 'next/server';
import { addRow, loadRoster, removeRow, RosterConflict, WRITABLE_FIELDS, writeCells, type WritableField } from '@/lib/server/roster';
import { badInput, rowsResponse } from '@/lib/server/respond';
import { requireSession } from '@/lib/server/session';

// GET reads the Roster tab. PATCH edits cells of one row, POST appends a row, DELETE removes a row.
// Every write names the row it expects (sheet row + Row ID + Project) and is refused if the sheet changed.
// The roster is never cached, so a reload right after a write shows the change.

export async function GET() {
  return rowsResponse('the roster from Google Sheets', loadRoster, 'no-store');
}

const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

interface RowRef { sheet_row: number; id: string; project: string }
function rowRef(b: Record<string, unknown>): RowRef | null {
  const { sheet_row, id, project } = b;
  if (typeof sheet_row !== 'number' || !Number.isInteger(sheet_row) || sheet_row < 2 || sheet_row > 10000) return null;
  if (!str(id, 40) || !/^[\w-]+$/.test(id)) return null;
  if (!str(project, 200) || !project.trim()) return null;
  return { sheet_row, id, project };
}

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try { const b = await req.json(); return b && typeof b === 'object' ? b : null; } catch { return null; }
}

async function write(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RosterConflict) {
      return NextResponse.json({ error: 'conflict', message: 'The sheet changed since this page loaded, so nothing was changed. The roster has been reloaded; try again.' }, { status: 409 });
    }
    console.error(`roster ${label} failed`, err);
    return NextResponse.json({ error: 'failed', message: 'Google Sheets didn’t answer. The change may or may not have gone through; check the sheet before trying again.' }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const b = await body(req);
  const ref = b && rowRef(b);
  const values = b && b.values;
  if (!ref || !values || typeof values !== 'object') return badInput('Invalid roster edit.');
  const clean: Partial<Record<WritableField, string>> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!(WRITABLE_FIELDS as readonly string[]).includes(k) || !str(v, 300)) return badInput('Invalid roster edit.');
    clean[k as WritableField] = v.trim();
  }
  if (!Object.keys(clean).length) return badInput('Nothing to change.');
  return write('edit', () => writeCells(ref.sheet_row, ref.id, ref.project, clean));
}

export async function POST(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const b = await body(req);
  if (!b || !str(b.project, 200) || !b.project.trim() || !str(b.tier1, 100) || !str(b.tier2, 100)) return badInput('Invalid new roster line.');
  return write('add', () => addRow(b.project as string, b.tier1 as string, b.tier2 as string));
}

export async function DELETE(req: NextRequest) {
  const denied = await requireSession();
  if (denied) return denied;
  const b = await body(req);
  const ref = b && rowRef(b);
  if (!ref) return badInput('Invalid roster row.');
  return write('remove', () => removeRow(ref.sheet_row, ref.id, ref.project));
}
