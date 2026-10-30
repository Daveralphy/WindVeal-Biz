# WindVeal Biz Platform — Delivery Board Index

The GitHub Issues list is the source of truth for phase work items. Use a GitHub Project board to visualise and schedule them. The available repository connection can create and manage issues and files, but cannot create a GitHub Projects board directly; create the board in GitHub Projects and add the issues below.

## Board configuration

**Suggested board name:** WindVeal Biz Platform — Delivery

**Views**
- Board view grouped by Status.
- Roadmap view grouped by Phase and sorted by target dates after estimation.
- Table view showing Status, Phase, Priority, Assignee, Estimate, Iteration and Dependencies.

**Workflow states**
Backlog → Ready → In Progress → In Review → Testing → Done

Use Blocked when work cannot proceed. Do not move an item to Done until its acceptance criteria and test evidence are recorded.

**Suggested fields**
- Phase: 0–9
- Priority: P0 Critical, P1 High, P2 Normal, P3 Low
- Status: the workflow states above
- Estimate: assigned after audit
- Target start / target finish: assigned after audit
- Dependencies: linked issues
- Acceptance evidence: test run, review or sign-off reference

## Initial phase issues

| Phase | Issue | Scope |
|---|---:|---|
| 0 | [#1](../issues/1) | Repository and architecture audit |
| 0 | [#2](../issues/2) | Product requirements and user journeys |
| 0 | [#3](../issues/3) | Architecture decisions and migration strategy |
| 0 | [#4](../issues/4) | Project tracking and quality gates |
| 1 | [#5](../issues/5) | Organisation identity, membership and access control |
| 2 | [#6](../issues/6) | Tauri desktop shell and local data |
| 3 | [#7](../issues/7) | Offline queue and synchronisation protocol |
| 4 | [#8](../issues/8) | Business document and spreadsheet import |
| 5 | [#9](../issues/9) | Six core workspaces |
| 6 | [#10](../issues/10) | WindVeal single-computer pilot |
| 7 | [#11](../issues/11) | Windows installer and installed-app validation |
| 8 | [#12](../issues/12) | Second-computer and multi-device validation |
| 9 | [#13](../issues/13) | Release readiness |

## Scheduling policy

Do not assign arbitrary dates yet. Phase 0 must establish the current baseline, dependencies, risk and realistic effort. Then schedule work in weekly review cycles with explicit phase exit gates. If a dependency slips, update the plan and communicate the impact rather than quietly moving dates.

## Weekly review

At each review:
1. Confirm completed work against acceptance criteria.
2. Review blocked items and dependencies.
3. Check test results and regressions.
4. Update estimates and target dates where evidence requires it.
5. Select a small, achievable set of Ready tasks for the next cycle.
6. Record decisions and scope changes in the relevant issue.
