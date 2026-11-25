// Made-up sample rows for QuickBooks and AppFolio, shaped like the qbSales / qbAR loaders and the
// appfolio_*.json fields listed in reference/datasets.json. Customer and property names line up with
// the sample projects so the matching rules (ptQbMatch, ptAfMatch) find them.

import type { AppfolioLoanRow, AppfolioSpendRow, QbArRow, QbSalesRow } from '../types';

// QuickBooks names UC jobs like "153 Halsey J04" (building number, street, job number).
export const sampleQbSales: QbSalesRow[] = [
  { customer: '153 Halsey', is_total: false, total_sales: 0 },
  { customer: '153 Halsey J04 Interior Fit-out', is_total: false, total_sales: 1284500 },
  { customer: '153 Halsey J05 Facade', is_total: false, total_sales: 212750 },
  { customer: 'Total for 153 Halsey', is_total: true, total_sales: 1497250 },
  { customer: '88 Market J02 Renovation', is_total: false, total_sales: 641320 },
  { customer: 'Sample Client LLC', is_total: false, total_sales: 18400 },
];

export const sampleQbAr: QbArRow[] = [
  { customer: '153 Halsey J04 Interior Fit-out', is_total: false, current: 96500, d1_30: 54200, d31_60: 0, d61_90: 12800, d91_plus: 8750, total: 172250 },
  { customer: 'Total for 153 Halsey', is_total: true, current: 96500, d1_30: 54200, d31_60: 0, d61_90: 12800, d91_plus: 8750, total: 172250 },
  { customer: '88 Market J02 Renovation', is_total: false, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_plus: 0, total: 0 },
];

// AppFolio properties are matched by building number + 3-letter street code (HD609BRO -> 609 / BRO).
export const sampleAfSpend: AppfolioSpendRow[] = [
  { property_id: 'sample-1', property: '609 Broad Street', street: '609 Broad St', city: 'Sample City', bldg_num: 609, street_abbr: 'BRO', bills_to_date: 214, spent_to_date: 1865420.55, bills_ytd: 61, spend_ytd: 402310.1 },
  { property_id: 'sample-2', property: '609 Broad Street - Retail', street: '609 Broad St Unit R1', city: 'Sample City', bldg_num: 609, street_abbr: 'BRO', bills_to_date: 18, spent_to_date: 48210, bills_ytd: 4, spend_ytd: 9120 },
  { property_id: 'sample-3', property: '225 Washington Avenue', street: '225 Washington Ave', city: 'Sample City', bldg_num: 225, street_abbr: 'WAS', bills_to_date: 37, spent_to_date: 126700, bills_ytd: 37, spend_ytd: 126700 },
];

export const sampleAfLoans: AppfolioLoanRow[] = [
  { loan_id: 'sample-loan-1', lender: 'Sample Community Bank', street: '609 Broad St', bldg_num: 609, street_abbr: 'BRO', balance: 7450000, interest_rate: 6.875, monthly_payment: 48932.17, maturity_date: '2028-04-01' },
  { loan_id: 'sample-loan-2', lender: 'Sample Bridge Lender', street: '609 Broad St', bldg_num: 609, street_abbr: 'BRO', balance: 1200000, interest_rate: 9.5, monthly_payment: 9500, maturity_date: '2027-02-15' },
];
