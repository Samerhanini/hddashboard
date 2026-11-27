# Hanini Projects & Tasks — website

## Goal
Rebuild the "Projects & Tasks" dashboard (originally a claude.ai dashboard artifact) as a standalone,
private website for Hanini staff. Same layout, views and behaviour; live data from our systems.

Everything about the original is in `reference/`:
- `reference/page.html` — markup (department tabs, project tiles, seven views)
- `reference/styles.css` — styles (with approximate design tokens at the top)
- `reference/ui.js` — all drawing/interaction logic (each `dash.draw(...)` block ≈ one React component)
- `reference/data-loaders.js` — how each raw API answer becomes rows (the row shapes the UI expects)
- `reference/datasets.json` — every data source: which system, endpoint/tool, arguments, IDs
- `reference/agenda-template.json` — the weekly agenda outline

Treat `reference/` as read-only source material. Keep the row shapes from `data-loaders.js` so UI logic ports over cleanly.

## Stack
- Next.js (App Router) + TypeScript, deployed on Vercel.
- d3 v7 for the Gantt chart and formatting (as in the original).
- Plain CSS ported from `reference/styles.css` (CSS modules or a global stylesheet; no Tailwind needed).
- SWR (or React Query) for client data fetching against our own `/api/*` routes.
- Auth: Auth.js (NextAuth) with Google sign-in, restricted to `@hanini.com` accounts. Every page and API route requires a session.

## Architecture rules
- ALL third-party calls happen server-side in `app/api/*` route handlers. Never expose tokens or keys to the browser.
- Credentials come from environment variables only (see `.env.example`). Never commit `.env.local`.
- One API route per dataset in `datasets.json`, e.g. `/api/projects`, `/api/projects/[projectId]/tasks`,
  `/api/projects/[projectId]/phases`, `/api/projects/[projectId]/hours`, `/api/roster`, `/api/agenda`,
  `/api/meetings?bldg=`, `/api/crm/contacts?q=`, `/api/quickbooks/sales`, `/api/quickbooks/ar`, `/api/appfolio/*`.
- Validate every filter input with the regexes in `datasets.json` → `rules` before using it.
- Cache read routes briefly (e.g. 5 minutes) to avoid API rate limits; bust the roster cache after writes.
- Roster write-backs (`ptWriteCells`, `ptAddRow`, `ptRemoveRow` in ui.js) become POST/PATCH/DELETE routes on `/api/roster`
  using the Google Sheets API with the service account. Keep the safety check before deleting a row.

## Data sources (server-side)
- Zoho Projects (portal 854982967): OAuth refresh-token flow → access token. Projects list, tasks by project
  (open filter + all-pages), phase (milestone) details, and per-person hours from Bulk Time Logs
  (`/projects/{id}/timelogs?view_type=projectspan`, scope `ZohoProjects.timesheets.READ` — each
  log entry counts under the person who logged it; the old task-total split is only a fallback
  while that scope is missing). US data center unless env says otherwise.
- Zoho CRM: same Zoho OAuth client (scopes for CRM), Contacts search.
- Google Sheets + Drive: service account (JSON key in env). Sheet `1h-64cziAfN6mlFV0nv_2m_DoNnB2BoUqiKVobIkWqQI`,
  tabs `Roster` (tab id 401964840) and `Agenda`. Drive: search "Notes by Gemini" docs, export as text, parse Summary/Next steps.
  The Gemini notes may sit in personal drives: they must be shared with the service account (or use domain-wide delegation).
- QuickBooks Online (UrbanCore Builders LLC): OAuth2 refresh token + realm ID. Reports `CustomerSales` and `AgedReceivables`.
  QuickBooks refresh tokens rotate — persist the newest one (e.g. Vercel KV / a small DB), not just env.
- AppFolio: static JSON snapshots in `data/appfolio_spend.json` and `data/appfolio_loans.json` (shown as "snapshot of <date>").

## Matching rules (keep exactly)
- Department = project name prefix HD / UC / BS.
- QuickBooks match: `ptQbMatch` in ui.js. AppFolio match: `ptAfMatch`. Meeting building key: `ptBldgOf`.
- Agenda notes keyed by project name + ISO week (`2026-W48`) + section + item.

## Working style
- Build incrementally, one view at a time, and run `npm run dev` to check each.
- Start with mock data from fixtures if credentials aren't set yet; switch to live when env vars exist.
- Ask before adding new dependencies beyond the stack above.
