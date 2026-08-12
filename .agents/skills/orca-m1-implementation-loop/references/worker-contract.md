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
5. If the local plan lacks information required to choose a public contract or architecture, use the live Orca preamble's `ask` flow. Do not fill material ambiguity from GitHub or invent broad scope.
6. Add and run tests appropriate to the task and wave gate. Inspect the final diff and report failures accurately.
7. Do not edit `m1-plan.md`; the coordinator marks the checkbox only after verified integration. Do not push, open a pull request, merge, close an issue, or perform any GitHub write.
8. Commit the complete implementation locally using a message that includes `#{{TASK_NUMBER}}`. Leave the worktree clean.
9. Send `worker_done` exactly once from this Kimi terminal using the coordinator handle, taskId, and dispatchId in the live preamble. Include the commit SHA, files modified, tests and outcomes, architecture notes, and remaining risks in the payload/body. Then end the turn and idle.
```
