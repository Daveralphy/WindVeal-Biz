# WindVeal Biz Platform — Project Roadmap

This roadmap is a planning baseline, not a promise of calendar dates. Dates and estimates should be set after the repository audit establishes the actual scope and dependencies.

## Delivery principles

- WindVeal is the first pilot organisation.
- The first pilot runs on one Windows development computer.
- The architecture must be multi-device capable from the beginning.
- The application is tested in development mode before packaging.
- A Windows installer is produced only after single-computer acceptance.
- A second computer is introduced after the installed application works reliably on the first.
- Each phase has explicit acceptance criteria and a review gate.

## Phase 0 — Repository audit and project setup

**Outcome:** an evidence-based plan before implementation.

- Inventory the existing frontend, backend, database, routes, models, tests and dependencies.
- Run the current application and record baseline failures and working functionality.
- Identify security, tenant-isolation, data-loss and deployment risks.
- Classify each existing feature as retain, redesign, replace, defer or remove.
- Evaluate Tauri, local SQLite encryption, PostgreSQL and the sync design.
- Confirm a migration strategy that protects existing data.
- Establish GitHub issues, project board, milestones and release gates.
- Agree the brand tokens and typography-led identity.

**Gate:** reviewed audit, architecture decision record, migration plan, test baseline and prioritised backlog.

## Phase 1 — Platform foundation

**Outcome:** secure organisation-owned platform foundations.

- Application shell and navigation.
- Organisation registration and proportionate verification.
- Owner, primary administrator and authorised representative distinctions.
- One active organisation membership per user.
- Invitations, roles and permission model.
- Server-side organisation isolation.
- Audit trail and organisation settings.
- Device identity and revocation model.

**Gate:** organisation and permission tests pass, including cross-organisation access denial.

## Phase 2 — Desktop and local data foundation

**Outcome:** a development-mode desktop application that works locally.

- Tauri desktop shell for Windows.
- Reuse the existing React/TypeScript/Vite UI where practical.
- Local encrypted SQLite storage.
- Secure credential storage and session handling.
- Local file access and import staging.
- Transactional local change queue.
- Database backup and recovery approach.
- Automated desktop and data-layer tests.

**Gate:** app launches in development mode; local data persists across restart; secrets and local data are protected.

## Phase 3 — Synchronisation foundation

**Outcome:** reliable single-device online/offline reconciliation with multi-device-ready contracts.

- Versioned sync API and operation format.
- Idempotency keys and retry handling.
- Incremental pull and push.
- Server-side permission enforcement.
- Tombstones and deletion propagation.
- Checkpoints and recovery from interrupted sync.
- Conflict detection and resolution rules.
- Observability and sync diagnostics.

**Gate:** offline changes survive restart, reconcile after reconnect, duplicate delivery is safe and conflicts are not silently lost.

## Phase 4 — Business data import

**Outcome:** controlled migration of existing business information.

- File intake for supported spreadsheets and documents.
- Local parsing for structured formats.
- Column and record identification.
- Workspace recommendations.
- Reviewable field mappings.
- Duplicate, missing-value and validation reports.
- Explicit approval before import.
- Import history, source-file retention and rollback strategy.
- Unclassified files remain in Documents.

**Gate:** representative test files import accurately with a reviewable report and no silent uncertain mappings.

## Phase 5 — Core workspaces

**Outcome:** useful daily business operations.

- Recruitment core.
- People & HR core.
- CRM core.
- Shared Workflows tasks and approvals.
- Documents library and attachments.
- Basic Insights reports and exports.
- Cross-workspace handoffs such as successful candidate to employee onboarding.

**Gate:** end-to-end WindVeal workflows pass using approved pilot data.

## Phase 6 — WindVeal single-computer pilot

**Outcome:** real usage on one development computer before packaging.

- Configure WindVeal as the pilot organisation.
- Import approved WindVeal records.
- Validate roles and permissions.
- Use the core workspaces in realistic business scenarios.
- Test internet loss, offline edits, application restart and reconnect.
- Review logs, backups, error recovery and data integrity.
- Fix critical and high-priority defects.

**Gate:** pilot acceptance checklist passes and no unresolved critical data-loss or security issues remain.

## Phase 7 — Windows installer and installed-app validation

**Outcome:** a repeatable Windows installation.

- Build the Windows installer from a known release commit.
- Sign the installer when signing credentials and process are available.
- Install on the pilot computer.
- Verify clean install, upgrade, uninstall and reinstall behaviour.
- Verify local data location, backup and recovery.
- Verify application startup, file access and offline behaviour.
- Test update and rollback strategy.

**Gate:** installed application passes the same critical acceptance tests as development mode.

## Phase 8 — Second-computer and multi-device validation

**Outcome:** proven cross-device operation.

- Install on a second Windows computer.
- Register a second device under an authorised user.
- Verify initial authorised data sync.
- Test changes made on either device.
- Test concurrent edits and conflict resolution.
- Test offline work on both devices and later reconciliation.
- Test device revocation and account removal.

**Gate:** no unauthorised data exposure, silent overwrites or unrecoverable sync failures in the test scenarios.

## Phase 9 — Release readiness

**Outcome:** controlled pilot release and a supportable product.

- Security and privacy review.
- Performance and reliability review.
- Backup and restore drill.
- Installer/update verification.
- Documentation and support procedures.
- Known-issues register.
- Release notes and versioning.
- Go/no-go review.

## Suggested project board workflow

Backlog → Ready → In Progress → In Review → Testing → Done

Use **Blocked** when a task cannot progress. Every task should include phase, priority, owner, dependencies, acceptance criteria and test evidence. Keep the board current at each review.

## Timeline policy

Do not assign arbitrary completion dates before Phase 0. After the audit, estimate tasks using dependencies and available capacity, then create a dated schedule with:

- target start and finish,
- task owner,
- dependency,
- effort estimate,
- acceptance gate,
- contingency for high-risk sync, security and migration work.

Review progress weekly. Re-estimate when scope or technical findings change rather than hiding slippage.
