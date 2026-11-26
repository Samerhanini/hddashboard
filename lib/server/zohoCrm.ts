import type { ApiRows, CrmContactRow } from '../types';
import { sampleCrmContacts } from '../fixtures/people';
import { cached } from './cache';
import { parseCrmContacts } from './parse/zoho';
import { zohoApiDomain, zohoGet, zohoReady } from './zoho';

// Zoho CRM contact search (datasets.json -> crmContacts). Same Zoho Self Client as Zoho Projects.
const CRM_VERSION = process.env.ZOHO_CRM_API_VERSION || 'v8';
const FIELDS = 'Full_Name,First_Name,Last_Name,Email,Phone,Mobile,Account_Name,Title';

/** Contacts matching a name, company or email (20 max). `q` is already checked against the crmq rule. */
export async function searchCrmContacts(q: string): Promise<ApiRows<CrmContactRow>> {
  if (!zohoReady()) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = sampleCrmContacts.filter((c) => words.every((w) => [c.name, c.company, c.email, c.title].join(' ').toLowerCase().includes(w)));
    return { rows: rows.slice(0, 20), truncated: rows.length > 20, source: 'sample' };
  }
  return cached(`zohocrm:contacts:${q.toLowerCase()}`, async () => {
    const ans = await zohoGet(`${await zohoApiDomain()}/crm/${CRM_VERSION}/Contacts/search`, { word: q, fields: FIELDS, per_page: 20 });
    const { rows, more } = parseCrmContacts(ans);
    return { rows, truncated: more, source: 'live' as const };
  });
}
