import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ApiRows, AppfolioLoanRow, AppfolioSpendRow, QbArRow, QbSalesRow } from '../types';
import { sampleAfLoans, sampleAfSpend, sampleQbAr, sampleQbSales } from '../fixtures/finance';

// QuickBooks (qbSales, qbAR): sample rows until stage 5 connects the QuickBooks Reports API.
export async function loadQbSales(): Promise<ApiRows<QbSalesRow>> {
  return { rows: sampleQbSales, source: 'sample' };
}
export async function loadQbAr(): Promise<ApiRows<QbArRow>> {
  return { rows: sampleQbAr, source: 'sample' };
}

// AppFolio: static JSON snapshots in data/. Falls back to sample rows while the files are missing.
// Accepts either a plain array of rows or { "as_of": "2026-11-17", "rows": [...] }.
const SNAPSHOT_DATE = process.env.APPFOLIO_SNAPSHOT_DATE || '2026-11-17';

async function readSnapshot<T>(file: string, sample: T[]): Promise<ApiRows<T>> {
  let text: string;
  try {
    text = await readFile(path.join(process.cwd(), 'data', file), 'utf8');
  } catch {
    return { rows: sample, source: 'sample', asOf: SNAPSHOT_DATE };
  }
  const json = JSON.parse(text) as T[] | { rows?: T[]; as_of?: string };
  const rows = Array.isArray(json) ? json : json.rows || [];
  const asOf = (!Array.isArray(json) && json.as_of) || SNAPSHOT_DATE;
  return { rows, source: 'snapshot', asOf };
}

export const loadAfSpend = () => readSnapshot<AppfolioSpendRow>('appfolio_spend.json', sampleAfSpend);
export const loadAfLoans = () => readSnapshot<AppfolioLoanRow>('appfolio_loans.json', sampleAfLoans);
