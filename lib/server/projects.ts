import type { ApiRows, ProjectRow } from '../types';
import { sampleProjects } from '../fixtures/projects';
import { hasEnv } from './env';

/**
 * Projects list (datasets.json -> projects). Returns sample rows until the Zoho credentials are set.
 * The live Zoho Projects call is added in stage 5.
 */
export async function loadProjects(): Promise<ApiRows<ProjectRow>> {
  if (!hasEnv('ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN')) {
    return { rows: sampleProjects, source: 'sample' };
  }
  // Credentials are set, but the live loader isn't built yet. Keep showing sample data rather than failing.
  return { rows: sampleProjects, source: 'sample' };
}
