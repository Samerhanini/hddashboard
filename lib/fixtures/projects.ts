// Made-up sample projects, shaped like the `projects` loader in reference/data-loaders.js.
// Used until the Zoho credentials are set. Names follow the real naming pattern so the
// matching rules in lib/rules.ts can be exercised (HD609BRO -> building 609, UC153HAL-J04 -> QuickBooks job J04).

import type { ProjectRow } from '../types';

const p = (
  id: string, name: string, group: string, status: string, owner: string,
  percent_complete: number, open_tasks: number, closed_tasks: number,
  start_date: string | null, end_date: string | null,
): ProjectRow => ({ id, name, group, status, owner, percent_complete, open_tasks, closed_tasks, start_date, end_date });

export const sampleProjects: ProjectRow[] = [
  p('900000000000001', 'HD609BRO-609 Broad St Mixed Use', 'Development', 'Active', 'Sample Owner A', 34, 42, 61, '2025-03-01', '2027-09-30'),
  p('900000000000002', 'HD12MAIN-12 Main St Rehab', 'Development', 'Active', 'Sample Owner B', 58, 17, 40, '2025-06-15', '2026-12-31'),
  p('900000000000003', 'HD225WAS-225 Washington Ave', 'Development', 'Active', 'Sample Owner A', 12, 65, 9, '2026-01-10', '2028-06-30'),
  p('900000000000004', 'HD48ELM-48 Elm St Townhomes', 'Development', 'On Hold', 'Sample Owner C', 20, 8, 5, '2025-09-01', '2027-03-31'),
  p('900000000000005', 'HD310PAR-310 Park Pl Acquisition', 'Development', 'Active', 'Sample Owner B', 5, 23, 1, '2026-08-01', '2027-12-31'),
  p('900000000000006', 'HD77OAK-77 Oak St', 'Development', 'Completed', 'Sample Owner C', 100, 0, 88, '2023-04-01', '2025-10-31'),
  p('900000000000011', 'UC153HAL-J04 Halsey Interior Fit-out', 'Construction', 'Active', 'Sample PM D', 66, 31, 74, '2025-11-01', '2026-12-20'),
  p('900000000000012', 'UC153HAL-J05 Halsey Facade', 'Construction', 'Active', 'Sample PM D', 22, 19, 6, '2026-05-01', '2027-04-30'),
  p('900000000000013', 'UC88MAR-J02 Market St Renovation', 'Construction', 'Active', 'Sample PM E', 81, 6, 52, '2025-02-01', '2026-12-15'),
  p('900000000000014', 'UC410CEN-J07 Central Ave Core and Shell', 'Construction', 'Not Started', 'Sample PM E', 0, 14, 0, '2027-01-15', '2028-02-28'),
  p('900000000000015', 'UC22ASH-J01 Ash St Punch List', 'Construction', 'Cancelled', 'Sample PM D', 10, 2, 3, '2025-01-01', '2025-06-30'),
  p('900000000000021', 'BS-Brand Refresh 2026', 'Creative', 'Active', 'Sample Lead F', 45, 12, 10, '2026-02-01', '2026-12-31'),
  p('900000000000022', 'BS-Leasing Website', 'Creative', 'Active', 'Sample Lead F', 70, 7, 18, '2026-04-01', '2027-01-31'),
  p('900000000000023', 'BS609-Broad St Lobby Art Program', 'Creative', 'On Hold', 'Sample Lead G', 15, 9, 2, '2026-06-01', '2027-06-30'),
];
