# Contributing

Thank you for your interest in contributing to WindVeal Biz Platform.

## Before you begin

- Check the existing issues and pull requests before starting work.
- Discuss significant features, architectural changes and database changes before implementation.
- Keep changes focused and avoid unrelated refactoring.
- Do not remove or replace existing functionality without an agreed reason and migration plan.

## Development guidelines

- Follow the conventions established by the project.
- Write clear, maintainable and testable code.
- Add or update tests when changing behaviour.
- Update documentation when setup or functionality changes.
- Do not commit credentials, environment files, private keys, local databases or business data.
- Use development data for local testing. Never run destructive scripts against pilot or production data.
- Enforce organisation permissions on the server, not only in the interface.
- Design local data changes and synchronisation to recover safely from interruptions.
- Keep core functionality independent of external AI services.

## Branches and commits

Create a branch for each change:

```text
feature/short-description
fix/short-description
docs/short-description
refactor/short-description
```

Use clear commit messages, for example:

```text
feat: add employee records
fix: prevent unauthorised organisation access
docs: update development instructions
test: cover offline record persistence
```

## Pull requests

A pull request should include:

- A short explanation of the change and its purpose.
- Relevant issue links.
- Tests and checks performed, including their results.
- Screenshots for interface changes where useful.
- Any database, migration, permission or synchronisation impact.
- Known limitations or follow-up work.

Do not mark checks as successful unless they have been run.

## Product naming

Use **WindVeal Biz Platform** as the product name. The workspaces are Recruitment, People & HR, CRM, Workflows, Documents and Insights. Do not introduce separate workspace brands or product logos.

## Code of conduct

Be respectful, constructive and professional. Keep discussions focused on the work, provide useful feedback and help maintain a welcoming environment.
