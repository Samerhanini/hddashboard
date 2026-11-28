import { cached } from './cache';
import { matrixRolesTab, matrixValuesGet, sheetsReady } from './googleSheets';

// Section order for the People tab, from the Group column of the
// "Roles x Projects" tab of the Project Roles Matrix sheet — the same
// order Samer sees on the sheet. Cached 5 minutes; fails open (empty
// list → the page falls back to its built-in order) so a sheet read
// problem never breaks the roster.

const CACHE_KEY = 'matrix:roles-tiers';

export async function loadMatrixTierOrder(): Promise<string[]> {
  if (!sheetsReady()) return [];
  return cached(CACHE_KEY, async () => {
    try {
      const values = await matrixValuesGet(`'${matrixRolesTab()}'!A2:A200`);
      const seen = new Set<string>();
      const order: string[] = [];
      for (const row of values) {
        const name = String(row[0] ?? '').trim();
        if (!name || name.toLowerCase() === 'group') continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        order.push(name);
      }
      return order;
    } catch (err) {
      console.warn('Matrix tier order unreadable, using built-in order', err instanceof Error ? err.message : err);
      return [];
    }
  });
}
