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

The desktop application is planned to use Tauri with a React and TypeScript interface. Local data will be stored in an encrypted SQLite database, with PostgreSQL supporting the central service and synchronisation.

The initial application scaffold and its exact development scripts will be added as implementation begins. Until that scaffold is in place, this repository does not contain a runnable application.

Once the development setup has been added, this section will include the required tools, environment configuration, database setup, development command, tests and production build instructions.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

---

Developed by **WindVeal**.
