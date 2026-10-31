# WindVeal Biz Platform

WindVeal Biz Platform is a business operations application developed by [WindVeal](https://github.com/Daveralphy). It brings essential business activities into one place, helping teams manage their people, recruitment, customers, documents and daily work.

The platform is being built as a Windows desktop application with offline support. Businesses will be able to work with their local data without an internet connection and synchronise changes when they reconnect.

## Workspaces

- **Recruitment** — Manage job openings, applicants, interviews and hiring.
- **People & HR** — Maintain employee records, departments, leave and attendance.
- **CRM** — Organise companies, contacts, leads, opportunities and follow-ups.
- **Workflows** — Assign tasks, manage deadlines and handle approvals.
- **Documents** — Store, organise and access business documents.
- **Insights** — Review business reports and operational performance.

## Key capabilities

- A single workspace for business operations.
- Import and organise existing spreadsheets and business documents.
- Review data mappings and import results before records are added.
- Work offline with locally available business data.
- Synchronise authorised changes when internet access is restored.
- Manage organisation members, roles and access permissions.
- Use core features without depending on an external AI service.

## Project status

WindVeal Biz Platform is under active development. The repository is being rebuilt around the desktop-first product direction. The capabilities described above represent the intended product scope; they should not be assumed to be available until implemented and released.

WindVeal will be the first pilot organisation. Initial development and testing will take place on one Windows computer before the application is packaged for installation and tested across multiple computers.

## Brand

The product uses the WindVeal blue colour palette and a typography-led identity. The platform name is the visual identity; no product logo is used.

## Development

WindVeal is currently built and tested as an online web application. Offline support and the Windows desktop app (Tauri, with an encrypted local database) come later, just before packaging.

### What's in the repository

| Folder | What it is |
| --- | --- |
| `apps/web` | The business app (React, TypeScript, Vite) on http://localhost:5173 |
| `apps/site` | The public website and each organisation's careers page on http://localhost:5174 |
| `apps/api` | The central API (Fastify, Drizzle, PostgreSQL) on http://localhost:4000 |
| `packages/shared` | Types, validation and permission rules shared by the apps and the API |
| `packages/ui` | Design tokens and shared UI components |

### Requirements

- Node.js 20 or newer
- pnpm 10 (`npm install -g pnpm@10`)
- Docker Desktop (runs PostgreSQL 16)

### First-time setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up        # start PostgreSQL in Docker (port 5433)
pnpm db:push      # create the database tables
pnpm db:seed      # optional: load demo data (see below)
```

**Demo data.** `pnpm db:seed` creates a sample business, *Sunrise Foods*, with people, jobs, candidates, clients, deals, tasks and approvals, plus WindVeal's own careers page. Sign in with any of these (password `Sunrise#2026x`):

| Email | Role |
| --- | --- |
| amaka@sunrisefoods.test | Admin (primary admin) |
| kofi@sunrisefoods.test | Manager |
| efua@sunrisefoods.test | Member |

### Run everything

```bash
pnpm dev          # API + business app + public site together
```

Then open http://localhost:5173 and create an account. In development no real emails are sent: verification codes, invitation links and password reset links appear at http://localhost:5173/dev/mailbox (and in the API console).

To test the public careers page, open **Settings → Organisation** and use **Mark as verified** (development only), publish a job in **Recruitment**, then visit http://localhost:5174/careers/your-organisation-slug.

### Checks

```bash
pnpm typecheck    # TypeScript across all packages
pnpm test         # API tests (use a separate database, windveal_test)
pnpm build        # production builds
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

---

Developed by **WindVeal**.
