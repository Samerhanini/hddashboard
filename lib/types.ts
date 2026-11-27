// Row shapes produced by the loaders in reference/data-loaders.js.
// The UI code depends on these exact field names, so keep them in sync with the loaders.

export type Dept = 'HD' | 'UC' | 'BS';
export const DEPTS: Dept[] = ['HD', 'UC', 'BS'];
export const DEPT_NAMES: Record<Dept, string> = {
  HD: 'Hanini Development',
  UC: 'Urban Core Builders',
  BS: 'Brick Studios',
};

export type View = 'overview' | 'agenda' | 'schedule' | 'finance' | 'resources' | 'tasks' | 'meetings';
export const VIEWS: View[] = ['overview', 'agenda', 'schedule', 'finance', 'resources', 'tasks', 'meetings'];

export interface ProjectRow {
  id: string;
  name: string;
  group: string;
  status: string;
  owner: string;
  percent_complete: number;
  open_tasks: number;
  closed_tasks: number;
  start_date: string | null;
  end_date: string | null;
}

export interface TaskRow {
  id: string;
  project_id: string;
  task: string;
  tasklist: string;
  depth: number;
  owners: string;
  status: string;
  completion: number;
  start: string | null;
  due: string | null;
  milestone_id: string;
}

export interface PhaseRow {
  id: string;
  project_id: string;
  phase: string;
  owner: string;
  status: string;
  status_color: string;
  closed: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface HoursRow {
  project_id: string;
  task_id: string;
  /** Task (or bug / general log) the time was logged against. */
  task?: string;
  person: string;
  /** Email of the person who logged the time (time logs only; used to match their billable rate). */
  email?: string;
  /** Distinct people who logged time on this task (not the task's owners). */
  owners: number;
  task_hours: number;
  hours: number;
  /** How many separate time-log entries make up this row. */
  entries?: number;
}

export interface HoursByPersonRow {
  person: string;
  hours: number;
  share: number;
  tasks: number;
  shared_tasks: number;
  /** Billable rate per hour from Zoho (the project's invoice rate for this person), when known. */
  rate_per_hour?: number;
  /** hours × rate_per_hour, when the rate is known. */
  cost?: number;
}

/**
 * One project user's billable rate from Zoho Projects
 * (GET /projects/{id}/users: `invoice`, falling back to `budget.rate_per_hour`).
 * This is the BILLABLE rate — what the person's hour is billed at — not
 * `budget.cost_per_hour`, the internal staff cost, which is never used here.
 */
export interface ProjectRateRow {
  person: string;
  email: string;
  rate_per_hour: number;
}

export interface QbSalesRow {
  customer: string;
  is_total: boolean;
  total_sales: number;
}

export interface QbArRow {
  customer: string;
  is_total: boolean;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d91_plus: number;
  total: number;
}

export interface MeetingRow {
  id: string;
  meeting: string;
  date: string | null;
  summary: string;
  next_steps: string;
  url: string;
  owner: string;
}

export interface RosterRow {
  id: string;
  sheet_row: number;
  project: string;
  tier1: string;
  tier2: string;
  role: string;
  firm: string;
  level: string;
  contact: string;
  contact_email: string;
  crm_id: string;
  phone: string;
  /** JSON column-letter map, e.g. {"_n":11,"row_id":"A","project":"B",...} */
  colmap: string;
}

export interface CrmContactRow {
  id: string;
  name: string;
  company: string;
  title: string;
  email: string;
  mobile: string;
}

export interface AgendaNoteRow {
  id: string;
  project: string;
  week: string;
  section: string;
  item: string;
  last_week: string;
  this_week: string;
  upcoming: string;
  source: string;
}

export interface AppfolioSpendRow {
  property_id: string;
  property: string;
  street: string;
  city: string;
  bldg_num: string | number;
  street_abbr: string;
  bills_to_date: number;
  spent_to_date: number;
  bills_ytd: number;
  spend_ytd: number;
}

export interface AppfolioLoanRow {
  loan_id: string;
  lender: string;
  street: string;
  bldg_num: string | number;
  street_abbr: string;
  balance: number | null;
  interest_rate: number | null;
  monthly_payment: number | null;
  maturity_date: string | null;
}

/** What every /api/* read route returns. */
export interface ApiRows<T> {
  rows: T[];
  truncated?: boolean;
  /** 'sample' while credentials aren't set, 'live' once they are, 'snapshot' for static files. */
  source: 'sample' | 'live' | 'snapshot';
  asOf?: string;
  /**
   * Hours only: true when rows come from Zoho time logs (each person's own
   * logged hours), false when they are the old estimate (a task's total hours
   * split evenly between its owners). Undefined for other datasets.
   */
  exact?: boolean;
  /**
   * Rates only: false when Zoho answered but the data isn't available — the
   * token lacks the ZohoProjects.users.READ scope — so the UI shows hours
   * without costs instead of an error. Absent (treated as true) otherwise.
   */
  available?: boolean;
}
