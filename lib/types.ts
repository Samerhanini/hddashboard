// Row shapes produced by the loaders in reference/data-loaders.js.
// The UI code depends on these exact field names, so keep them in sync with the loaders.

export type Dept = 'HD' | 'UC' | 'BS';
export const DEPTS: Dept[] = ['HD', 'UC', 'BS'];
export const DEPT_NAMES: Record<Dept, string> = {
  HD: 'Hanini Development',
  UC: 'Urban Core Builders',
  BS: 'Brick Studios',
};

export type View = 'overview' | 'agenda' | 'schedule' | 'finance' | 'tasks' | 'meetings';
export const VIEWS: View[] = ['overview', 'agenda', 'schedule', 'finance', 'tasks', 'meetings'];

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
  person: string;
  owners: number;
  task_hours: number;
  hours: number;
}

export interface HoursByPersonRow {
  person: string;
  hours: number;
  share: number;
  tasks: number;
  shared_tasks: number;
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
}
