# Contributing to WindVeal Biz Platform

Thank you for contributing. WindVeal Biz Platform is undergoing a product and architecture redesign. Contributions must follow the agreed product direction and should not introduce unreviewed architectural decisions.

## Before starting

1. Read the repository README and the current project roadmap.
2. Check existing issues and the project board for the task.
3. Confirm the task is in the Ready state and its scope is understood.
4. For architectural, security, data-model or sync changes, obtain review before implementation.
5. Do not begin a broad rewrite or remove existing functionality without an approved migration plan.

## Development principles

- Preserve useful existing functionality unless an approved plan says otherwise.
- Keep organisation ownership and tenant isolation enforced by the backend.
- Design for offline-first use and eventual multi-device synchronisation.
- Keep AI optional. Core business workflows must not depend on a third-party AI service.
- Prefer clear, testable modules over tightly coupled features.
- Follow existing project conventions unless the task explicitly includes improving them.
- Never introduce secrets, real customer data or private credentials into the repository.

## Branch naming

Use descriptive branch names:

```text
feature/short-description
fix/short-description
docs/short-description
refactor/short-description
test/short-description
```

## Commit messages

Use Conventional Commits:

```text
feat: add organisation document import review
fix: prevent cross-organisation record access
docs: clarify local development setup
refactor: isolate sync operation handling
test: cover offline change persistence
chore: update development tooling
```

## Quality requirements

Before opening a pull request:

- Run the tests relevant to the change.
- Run linting and type checks where configured.
- Run the applicable build.
- Add tests for new behaviour and regression tests for fixed bugs.
- Check error, loading, empty and permission-denied states.
- Check that organisation boundaries are enforced server-side.
- For offline and sync work, test restart recovery, duplicate delivery, retry behaviour and conflict cases.
- Update documentation and configuration examples when needed.

Do not claim a check passed if it was not run. Include the command and result in the pull request.

## Pull requests

A pull request should include:

1. **Purpose:** the problem being solved.
2. **Scope:** what changed and what did not change.
3. **Implementation:** important technical decisions.
4. **Testing:** commands run and observed results.
5. **Data impact:** schema, migration, import or sync implications.
6. **Security impact:** permissions, organisation isolation, local storage or sensitive data implications.
7. **Screenshots or recordings:** for visible UI changes where useful.
8. **Follow-up work:** known limitations and linked issues.

Keep pull requests focused. Do not combine unrelated cleanup with a feature unless the cleanup is necessary for that feature.

## Data and environment safety

- Use development data for local development.
- Use a separate staging dataset for the WindVeal pilot.
- Never point destructive development scripts at pilot or production databases.
- Do not commit `.env` files, API keys, tokens, certificates, local SQLite databases, uploaded documents or customer exports.
- Database migrations must be reviewed and must not silently destroy existing data.
- Any change to sync contracts must consider older pending operations and duplicate delivery.

## Product identity

Use **WindVeal Biz Platform** as the single product name. Workspace names are:

- Recruitment
- People & HR
- CRM
- Workflows
- Documents
- Insights

Do not create separate workspace sub-brands. The product identity is typography-led: do not add a logo or invent an emblem. Follow the blue-led palette documented in the README and the approved design tokens.

## Review and merge

- Link the pull request to its issue.
- Request review from the appropriate maintainer.
- Resolve review comments and keep the branch current.
- Merge only after required checks and approvals pass.
- Do not merge unfinished or untested work merely to keep the schedule moving.
