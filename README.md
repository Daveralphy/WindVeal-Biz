# WindVeal Biz Platform

**A unified business operations platform by WindVeal.**

WindVeal Biz Platform is being repositioned from its original recruitment-focused application into a desktop-first business operations platform. It is intended to help organisations bring scattered business records into one place, manage connected workflows, and continue working when internet access is unavailable.

> **Project status: Redesign and technical audit**
>
> This repository contains an existing React/TypeScript frontend and Fastify/TypeScript backend with recruitment functionality. The broader platform described here is the agreed product direction, not a claim that every capability is already implemented. The first task is to audit the current codebase, preserve useful working functionality, and define a safe migration plan before implementation.

## Product direction

WindVeal Biz Platform is designed around an organisation-owned workspace. Businesses can bring existing spreadsheets and documents, review suggested data mappings, and import approved records into the relevant workspaces.

The platform is planned to be:

- **Business-first:** every workspace and business record belongs to an organisation.
- **Desktop-first:** Windows is the first target, with macOS and Linux considered later.
- **Offline-capable:** authorised local data and pending changes remain usable without an internet connection.
- **Synchronised:** local changes reconcile with the central service when connectivity returns.
- **Modular:** organisations enable the workspaces they need and can expand over time.
- **AI-optional:** core workflows and structured imports must work without an external AI provider.
- **Secure by design:** organisation isolation, least-privilege access, device controls and auditability are foundational.

## Workspaces

The platform has one product identity. Workspaces use functional names, not separate sub-brands.

| Workspace | Purpose |
| --- | --- |
| **Recruitment** | Jobs, applicants, candidate pipelines, interviews, evaluations and hiring decisions. |
| **People & HR** | Employee records, departments, onboarding, offboarding, leave and attendance. |
| **CRM** | Companies, contacts, leads, opportunities, sales pipelines and follow-ups. |
| **Workflows** | Shared tasks, assignments, deadlines, comments, notifications and approvals. |
| **Documents** | Shared document library, attachments, access controls and import history. |
| **Insights** | Reports and dashboards based on actual organisation data. |

## Brand direction

- **Product name:** WindVeal Biz Platform
- **Company:** WindVeal
- **Logo:** no logo is used in this product identity. The platform name is the visual signature.
- **Typography:** use a distinctive, confident wordmark treatment for the product name. Manrope is the preferred starting point for the name; use a highly legible UI typeface such as Inter for application controls and data-heavy screens. Confirm font licensing and offline font packaging before release.
- **Palette:** use the blue-led palette from the supplied WindVeal reference. Initial design tokens:
  - Primary blue: `#486FE4`
  - Deep blue: `#263F91`
  - Navy: `#172B63`
  - Pale blue surface: `#EEF3FF`
  - White: `#FFFFFF`
  - Neutral text and borders should remain restrained and accessible.
- Do not recreate, trace or insert the supplied symbol as an application logo. Do not invent a new icon or emblem to stand in for it.

The palette values are initial working tokens sampled from the supplied reference and should be validated against contrast and interface states during the design phase.

## Planned delivery and testing approach

The first pilot organisation will be **WindVeal**, initially running on one Windows development computer.

1. Audit the existing repository and document what can be retained, redesigned or replaced.
2. Agree the target architecture and migration sequence.
3. Establish a repeatable local development environment and automated test baseline.
4. Build and test the desktop application in development mode before creating an installer.
5. Configure WindVeal as the pilot organisation using approved business data.
6. Test the core workspaces, imports, permissions, local persistence and offline behaviour on one computer.
7. Test reconnect and server reconciliation on that computer.
8. Only after local acceptance, create a Windows installer and test installation independently of the development environment.
9. Add a second computer to validate multi-device synchronisation, concurrent edits and conflict handling.

The architecture must support multiple devices from the beginning, even though the first pilot is single-computer. A successful single-computer pilot does not by itself prove cross-device synchronisation.

## Architecture direction

The following is the target direction to evaluate, not an instruction to replace the current stack without an audit:

| Area | Direction to evaluate |
| --- | --- |
| Desktop shell | Tauri for the Windows-first desktop application |
| UI | Retain and evolve the existing React, TypeScript and Vite frontend where practical |
| Local data | Encrypted SQLite with a durable local change queue |
| Central data | PostgreSQL as the authoritative shared store |
| API | Audit and potentially retain the existing Fastify backend |
| Sync | Explicit versioned sync protocol, idempotent operations, conflict detection and authorised incremental sync |
| AI | Optional provider abstraction; no core dependency on a single AI vendor |

The coding agent must verify compatibility, security, operational cost and migration implications before selecting final technologies. Do not introduce a second framework or replace working infrastructure without evidence.

## Current repository baseline

The repository currently includes:

- `apps/web/`: React, TypeScript and Vite frontend.
- `apps/api/`: Node.js, Fastify and TypeScript backend.
- PostgreSQL and Prisma configuration.
- Existing recruitment-oriented routes, data models and user interface.
- Existing UI reference PDFs in `vealbiz_UI/`.

These are repository-level observations from the existing project documentation and structure. Their actual completeness, correctness, security and test status must be verified during the technical audit. Do not rely on old README feature claims as proof that a feature works.

## Getting started

The setup instructions below are provisional until the audit confirms the current scripts and environment requirements.

### Prerequisites

- Git
- Node.js version supported by the repository's package configuration
- npm
- Docker Desktop, if the existing local PostgreSQL setup is retained
- Rust and the Windows build prerequisites when Tauri desktop work begins

### Setup

```bash
git clone https://github.com/Daveralphy/VealBiz.git
cd VealBiz
npm install
```

Inspect the root and workspace `package.json` files before running scripts. Copy the relevant `.env.example` files to local `.env` files and supply local development values. Never commit secrets or real pilot credentials.

The existing web/API development commands may be available through:

```bash
npm run dev
```

Confirm the actual scripts and database setup against the current repository before relying on them. The development setup must use isolated development data, not WindVeal's pilot or production data.

## Data and security principles

- Every business-owned record must be scoped to an organisation and checked on the server.
- A user has one active organisation membership.
- Users must only receive records and files they are authorised to access.
- Local storage must be protected and device access revocable.
- Offline writes must be durable and queued transactionally.
- Sync operations must be idempotent and version-aware.
- Non-overlapping edits may be merged; same-field conflicts require a deliberate resolution path.
- Deletion must be represented safely for synchronisation and audit purposes.
- Original imported files and import history must be handled according to explicit retention rules.
- Sensitive employee information must have more restrictive permissions than general directory information.
- Do not send business documents or personal data to an external AI service without an explicit, informed configuration.

## Development workflow

- Use focused branches for changes.
- Keep changes small enough to review.
- Add or update tests with behaviour changes.
- Run relevant tests, linting and builds before opening a pull request.
- Update documentation when setup, architecture, data contracts or user-facing behaviour changes.
- Never commit credentials, production data, local databases, build artefacts or uploaded customer files.
- Do not delete or rewrite existing functionality until its purpose and dependencies have been audited.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution process and [the project roadmap](docs/PROJECT-ROADMAP.md) for delivery phases.

## Project planning

Work is intended to be tracked as GitHub issues and organised into a GitHub Project board with these workflow states:

- Backlog
- Ready
- In Progress
- In Review
- Testing
- Done
- Blocked

Each task should have an owner, priority, phase, acceptance criteria and dependencies where relevant. Do not mark a task complete solely because code has been written; its acceptance criteria and tests must pass.

## License

The existing repository includes an MIT license badge in its previous documentation, but the license file and legal status must be verified during the repository audit before this README makes a definitive licensing claim.

---

**Built by WindVeal.**
