# Kimi worker contract

Replace every placeholder with data parsed only from `m1-plan.md`, then use the result as the Orca orchestration task spec.

```text
Implement M1 Wave {{WAVE_NUMBER}} task #{{TASK_NUMBER}} in this dedicated worktree.

Local plan task:
{{LOCAL_TASK}}

Wave exit gate:
{{WAVE_EXIT_GATE}}

Contract:
1. Do not run `gh`, call GitHub APIs or connectors, browse any issue URL, or read issue bodies, comments, labels, blockers, pull requests, or other remote issue state. The issue number is only a local identifier.
2. Read only the `Implementation waves` subsection of the repository-root `m1-plan.md`, plus every applicable `AGENTS.md`, `Table-definetion.txt`, and the integrated local code and tests. Do not read other `m1-plan.md` sections. Use only the selected local task description and wave exit gate for task scope.
3. If `.codegraph/` exists, use CodeGraph before grep/find when locating or understanding code.
4. Implement the smallest complete local interpretation of this task while preserving the M1 architecture: independent core tables, no shared `entities` table, no database foreign keys, application-layer logical integrity, atomic append-oriented provenance where required, exact resource quantities, and historically resolvable state.
5. Preserve the settled platform choices: native iOS, TypeScript, React Native, Expo, and on-device SQLite through `expo-sqlite`. Do not introduce a server database.
6. If the local plan lacks information required to choose a public contract or architecture, use the live Orca preamble's `ask` flow. Do not fill material ambiguity from GitHub or invent broad scope.
7. Add and run tests appropriate to the task and wave gate. Inspect the final diff and report failures accurately.
8. After validation, mark only task #{{TASK_NUMBER}} as `[x]` in the `Implementation waves` subsection of `m1-plan.md`. Do not alter Milestone closeout boxes or unrelated prose. Commit this checklist update separately with a message such as `docs(m1): mark task #{{TASK_NUMBER}} complete`.
9. Confirm the implementation and checklist commits are on a clean branch descended from the dispatched integration HEAD. Push the branch, create exactly one PR targeting `main`, and use only the local task description, local diff, and validation evidence in its title/body. Do not use issue-closing keywords, close issues, or inspect unrelated remote issue/PR state.
10. Inspect the created PR's checks and mergeability. Require the repository's merge-commit strategy; if unavailable, escalate rather than switching to squash or rebase. Wait for the exact PR and candidate head SHA to be reported merged into `main`, then fetch `origin/main` and verify the merge commit is an ancestor and task #{{TASK_NUMBER}} is checked in `origin/main:m1-plan.md`.
11. Send `worker_done` exactly once from this Kimi terminal, using the coordinator handle, taskId, and dispatchId in the live preamble, only after successful remote merge verification. Include the implementation SHA, checklist SHA, files modified, exact tests and outcomes, PR URL/number, candidate head SHA, merge commit, architecture notes, and remaining risks in the payload/body. If any delivery or merge step fails, send `escalation` instead and preserve the worktree. Then end the turn and idle.
```
