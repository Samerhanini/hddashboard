# Hanini Projects & Tasks — starter kit

This folder contains everything Claude Code needs to rebuild the "Projects & Tasks" dashboard as a website.
`CLAUDE.md` holds the plan (Claude Code reads it automatically), and `reference/` holds the original page.

## 1. Install the tools (once)

1. **Node.js 20+**: download it from nodejs.org.
2. **Claude Code**: run this in a terminal:
   - Mac/Linux: `curl -fsSL https://claude.ai/install.sh | bash`
   - or, with Node: `npm install -g @anthropic-ai/claude-code`
3. **Git** and a **GitHub** account, which you'll need for deploying later.

## 2. Open the project in Claude Code

```bash
cd path/to/hanini-projects-site
git init
claude
```
Sign in when prompted. Claude Code reads `CLAUDE.md` on its own.

## 3. Build it in stages. Paste these prompts one at a time

1. *"Read CLAUDE.md and everything in reference/. Then scaffold the Next.js app as described, with the page layout,
   department tabs, project tiles and the seven view buttons. Use fixture data shaped like data-loaders.js for now."*
2. *"Port the Tasks view and the Schedule (Gantt) view using fixtures."*
3. *"Port the Finance, Meetings, Agenda and Overview views using fixtures."*
4. *"Add Google sign-in limited to @hanini.com."*
5. Once the credentials from step 4 are in `.env.local`: *"Replace the fixtures with live API routes, starting with Zoho Projects."*
   Then do Google Sheets, Drive, Zoho CRM and QuickBooks one at a time.
6. *"Add the roster write-back routes (edit cells, add a row, remove a row with the safety check)."*

After each step, run `npm run dev` and open http://localhost:3000 to check the result.

## 4. Get API credentials (copy .env.example to .env.local and fill it in)

| System | Where | What you need |
|---|---|---|
| Google sign-in | console.cloud.google.com → APIs & Services → Credentials → OAuth client (Web) | Client ID and secret. Redirect URI: `http://localhost:3000/api/auth/callback/google`, plus your live URL later |
| Google Sheets + Drive | Same project → enable the Sheets API and Drive API → create a **service account** → Keys → JSON | Paste the JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`. **Share the roster sheet (Editor) and the Gemini notes (Viewer) with the service account's email** |
| Zoho Projects + CRM | api-console.zoho.com → Self Client → generate a code with scopes `ZohoProjects.portals.READ,ZohoProjects.projects.READ,ZohoProjects.tasks.READ,ZohoProjects.milestones.READ,ZohoProjects.timesheets.READ,ZohoCRM.modules.contacts.READ`, then exchange it for a refresh token | Client ID, secret and refresh token. Claude Code can walk you through the exchange |
| QuickBooks | developer.intuit.com → create an app (Accounting scope) → use the OAuth Playground to connect UrbanCore Builders LLC | Client ID, secret, refresh token and Realm (company) ID |
| AppFolio | Export the reports again, or reuse the Nov 17 snapshot | Save them as `data/appfolio_spend.json` and `data/appfolio_loans.json` |

## 5. Deploy

1. Push the project to a **private** GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. Add every variable from `.env.local` under Settings → Environment Variables.
4. Add the live URL's `/api/auth/callback/google` to the Google OAuth client.
5. Optional: under Domains, add `projects.hanini.com` and create the DNS record Vercel shows you.

## Notes
- The site shows loan balances, receivables and contact details, so keep the login on.
- The original saved hidden projects, removed meetings and the last view in each person's browser. The website does the same unless you ask Claude Code to store them per user.
- The original asked people to sign in to each system with their own account. The website uses one set of company credentials instead, so everyone who can sign in sees the same data.
