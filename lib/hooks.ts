'use client';

import type {
  AgendaNoteRow, AppfolioLoanRow, AppfolioSpendRow, CrmContactRow, HoursRow, MeetingRow,
  PhaseRow, ProjectRateRow, QbArRow, QbSalesRow, RosterRow, TaskRow,
} from './types';
import { useDataset } from './useDataset';
import { RULES } from './validate';

// One hook per dataset in reference/datasets.json. Passing null/false skips the request.
// SWR shares a request between every component that uses the same hook and argument.

/** projectTasks: open tasks of the selected project (Tasks and Schedule views). */
export const useProjectTasks = (projectId: string | null) =>
  useDataset<TaskRow>(projectId ? `/api/projects/${projectId}/tasks` : null);

/** projectPhases: phases (milestones) of the selected project. */
export const useProjectPhases = (projectId: string | null) =>
  useDataset<PhaseRow>(projectId ? `/api/projects/${projectId}/phases` : null);

/** projectHours: logged hours per task owner on the selected project. */
export const useProjectHours = (projectId: string | null) =>
  useDataset<HoursRow>(projectId ? `/api/projects/${projectId}/hours` : null);

/** projectRates: billable rate per hour for each user on the selected project (Zoho Projects users). */
export const useProjectRates = (projectId: string | null) =>
  useDataset<ProjectRateRow>(projectId ? `/api/projects/${projectId}/rates` : null);

export const useQbSales = (on = true) => useDataset<QbSalesRow>(on ? '/api/quickbooks/sales' : null);
export const useQbAr = (on = true) => useDataset<QbArRow>(on ? '/api/quickbooks/ar' : null);
export const useAfSpend = (on = true) => useDataset<AppfolioSpendRow>(on ? '/api/appfolio/spend' : null);
export const useAfLoans = (on = true) => useDataset<AppfolioLoanRow>(on ? '/api/appfolio/loans' : null);

/** meetings: Gemini notes whose title contains the building key ('none' when the project has no usable key). */
export const useMeetings = (bldg: string | null) =>
  useDataset<MeetingRow>(bldg && RULES.bldg.test(bldg) ? `/api/meetings?bldg=${encodeURIComponent(bldg)}` : null);

export const useAgendaNotes = (on = true) => useDataset<AgendaNoteRow>(on ? '/api/agenda' : null);
export const useRoster = (on = true) => useDataset<RosterRow>(on ? '/api/roster' : null);

/** crmContacts: Zoho CRM contact search for the Overview contact picker. */
export const useCrmContacts = (q: string | null) =>
  useDataset<CrmContactRow>(q && RULES.crmq.test(q) ? `/api/crm/contacts?q=${encodeURIComponent(q)}` : null);
