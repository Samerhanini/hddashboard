'use client';

import * as d3 from 'd3';
import { afMatch, COLORS, qbMatch } from '@/lib/rules';
import { useAfLoans, useAfSpend, useQbAr, useQbSales } from '@/lib/hooks';
import type { AppfolioLoanRow, AppfolioSpendRow } from '@/lib/types';
import { useDashboard } from '../DashboardContext';

const fmtNum = d3.format(',');
const fmtUsd = d3.format('$,.0f');

/** QuickBooks card (qbTitle + qbBody). Shown for UC and BS; figures only for UC. */
export function QuickBooksCard() {
  const { project, dept } = useDashboard();
  const s = useQbSales(), a = useQbAr();
  const loading = s.status === 'loading' || a.status === 'loading';

  let body: React.ReactNode = null;
  const msg = (t: string) => <div className="pt-empty">{t}</div>;
  if (loading) body = null;
  else if (s.status === 'error' || a.status === 'error') body = msg('Failed to load');
  else if (project && s.status === 'ok' && a.status === 'ok') {
    if (dept !== 'UC') body = msg('QuickBooks is connected to UrbanCore Builders LLC, so figures appear for UC projects only.');
    else {
      const sale = qbMatch(s.data, project), ar = qbMatch(a.data, project);
      if (!sale && !ar) body = msg('No QuickBooks customer matches this project. QuickBooks names UC jobs like “153 Halsey J04”, matched by building number and job number.');
      else {
        const cust = (sale || ar)!.customer;
        const buckets: [string, number][] = ar ? [['Current', ar.current], ['1–30 days', ar.d1_30], ['31–60 days', ar.d31_60], ['61–90 days', ar.d61_90], ['91+ days', ar.d91_plus]] : [];
        const colors = ['var(--color-good, #3c8d5a)', COLORS[0], COLORS[1 % COLORS.length], 'var(--color-warn)', 'var(--color-bad)'];
        body = (
          <>
            <div className="pt-qb">
              <div><div className="pt-qb-label">Invoiced to date</div><div className="pt-qb-val">{fmtUsd(sale ? sale.total_sales : 0)}</div></div>
              <div><div className="pt-qb-label">Open balance (A/R)</div><div className={'pt-qb-val' + (ar && ar.total > 0 ? ' pt-warn' : '')}>{fmtUsd(ar ? ar.total : 0)}</div></div>
              <div><div className="pt-qb-label">Over 90 days past due</div><div className={'pt-qb-val' + (ar && ar.d91_plus > 0 ? ' pt-bad' : '')}>{fmtUsd(ar ? ar.d91_plus : 0)}</div></div>
            </div>
            {ar && ar.total > 0 && (
              <>
                <div className="pt-qb-aging">
                  {buckets.map(([n, v], i) => (v ? <span key={n} style={{ width: (100 * v) / ar.total + '%', background: colors[i] }} title={n + ': ' + fmtUsd(v)} /> : null))}
                </div>
                <div className="pt-qb-legend">
                  {buckets.map(([n, v], i) => (v ? <span key={n}><i style={{ background: colors[i] }} />{n + ' ' + fmtUsd(v)}</span> : null))}
                </div>
              </>
            )}
            <div className="pt-empty">QuickBooks customer: {cust}</div>
          </>
        );
      }
    }
  }

  return (
    <section className="pt-card" id="project-quickbooks">
      <h2 className="pt-h2">{project ? project.name + ' — QuickBooks' : 'QuickBooks'}</h2>
      <p className="pt-sub">From QuickBooks Online · UrbanCore Builders LLC · all dates</p>
      <div className={loading ? 'dash-skeleton' : undefined} style={loading ? { minHeight: 80 } : undefined}>{body}</div>
    </section>
  );
}

const fmtD = d3.utcFormat('%b %-d, %Y');
const parseD = d3.utcParse('%Y-%m-%d');
const usd = (v: number | null | undefined) => (v == null ? '—' : fmtUsd(v));
const longDate = (v: string | undefined) => { const d = v ? parseD(v.slice(0, 10)) : null; return d ? d3.utcFormat('%B %-d, %Y')(d) : 'unknown date'; };

interface Col<T> { label: string; num?: boolean; fmt: (r: T) => string }
function Table<T>({ cols, rows, rowKey }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string }) {
  return (
    <div className="pt-table-wrap">
      <table className="pt-table">
        <thead><tr>{cols.map((c) => <th key={c.label} className={c.num ? 'pt-num' : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={rowKey(r)}>{cols.map((c) => <td key={c.label} className={c.num ? 'pt-num' : undefined}>{c.fmt(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** AppFolio card (afTitle + afBody). HD only. */
export function AppFolioCard() {
  const { project } = useDashboard();
  const s = useAfSpend(), l = useAfLoans();
  const loading = s.status === 'loading' || l.status === 'loading';

  let body: React.ReactNode = null;
  if (s.status === 'error' || l.status === 'error') body = <div className="pt-empty">Failed to load</div>;
  else if (project && s.status === 'ok' && l.status === 'ok') {
    const spend = afMatch(s.data, project), loans = afMatch(l.data, project);
    if (!spend.length && !loans.length) {
      body = <div className="pt-empty">No AppFolio property matches this project. Properties are matched by building number and street, e.g. HD609BRO → 609 Broad St.</div>;
    } else {
      const propCol: Col<AppfolioSpendRow> = { label: 'Property', fmt: (r) => (r.property || '') + (r.street ? ' · ' + r.street : '') };
      const noBills = <div className="pt-empty">No bills recorded in AppFolio for this property.</div>;
      body = (
        <>
          <div className="pt-af-sec">
            <h3 className="pt-af-h3">Loan</h3>
            {!loans.length ? <div className="pt-empty">No active loans recorded in AppFolio for this property.</div> : (
              <Table<AppfolioLoanRow> rowKey={(r) => r.loan_id} rows={loans.slice().sort((a, b) => (b.balance || 0) - (a.balance || 0))} cols={[
                { label: 'Lender', fmt: (r) => r.lender || '—' },
                { label: 'Property', fmt: (r) => r.street || '—' },
                { label: 'Balance', num: true, fmt: (r) => usd(r.balance) },
                { label: 'Rate', num: true, fmt: (r) => (r.interest_rate == null ? '—' : r.interest_rate.toFixed(2) + '%') },
                { label: 'Monthly payment', num: true, fmt: (r) => usd(r.monthly_payment) },
                { label: 'Matures', fmt: (r) => { const d = r.maturity_date ? parseD(String(r.maturity_date).slice(0, 10)) : null; return d ? fmtD(d) : '—'; } },
              ]} />
            )}
          </div>
          <div className="pt-af-sec">
            <h3 className="pt-af-h3">Spent to date</h3>
            {!spend.length ? noBills : <Table<AppfolioSpendRow> rowKey={(r) => r.property_id} rows={spend} cols={[propCol, { label: 'Bills', num: true, fmt: (r) => fmtNum(r.bills_to_date || 0) }, { label: 'Spent to date', num: true, fmt: (r) => usd(r.spent_to_date) }]} />}
          </div>
          <div className="pt-af-sec">
            <h3 className="pt-af-h3">Spend year to date ({new Date().getFullYear()})</h3>
            {!spend.length ? noBills : <Table<AppfolioSpendRow> rowKey={(r) => r.property_id} rows={spend} cols={[propCol, { label: 'Bills', num: true, fmt: (r) => fmtNum(r.bills_ytd || 0) }, { label: 'Spend YTD', num: true, fmt: (r) => usd(r.spend_ytd) }]} />}
          </div>
        </>
      );
    }
  }

  return (
    <section className="pt-card" id="project-appfolio">
      <h2 className="pt-h2">{project ? project.name + ' — AppFolio' : 'AppFolio'}</h2>
      <p className="pt-sub">From AppFolio · snapshot of {longDate(s.asOf)} · spend is bill amounts, paid and unpaid{s.source === 'sample' ? ' · sample data' : ''}</p>
      <div className={loading ? 'dash-skeleton' : undefined} style={loading ? { minHeight: 120 } : undefined}>{body}</div>
    </section>
  );
}
