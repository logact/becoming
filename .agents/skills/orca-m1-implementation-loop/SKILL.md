---
name: orca-m1-implementation-loop
description: Execute the local `m1-plan.md` Implementation waves serially through supervised Orca workers, using a fresh worktree and fresh Kimi `k3 --yolo` agent for each unchecked task. Use when asked to run, continue, drain, or coordinate the Becoming M1 implementation plan one task at a time without reading GitHub issues or consulting remote issue state.
---

# Orca M1 Implementation Loop

Use `m1-plan.md` as the sole scheduling and task-description source. Spawn exactly one fresh Orca Kimi worker at a time, integrate its verified result, mark the local checkbox complete, and only then start the next task.

## Non-negotiable source boundary

- Read only the local `m1-plan.md` Implementation waves for task numbers, titles, order, wave gates, and completion state.
- Treat issue numbers as local identifiers only.
- Never run `gh`, query a GitHub API/MCP connector, browse an issue URL, fetch issue bodies or comments, or consult remote labels, blockers, milestones, pull requests, or issue state.
- Never use the plan's links as permission to open GitHub.
- Use `AGENTS.md`, `Table-definetion.txt`, the current local code, tests, and migrations as implementation context.
- Let the local checklist override the plan's prose that says GitHub is authoritative. The user explicitly selected local-plan-only execution for this skill.

## Load live Orca contracts

1. Resolve the Orca executable once according to the `orca-cli` skill.
2. Run `<orca> skills get orca-cli` and `<orca> skills get orchestration`; read both completely before any Orca mutation. Let their current guidance override command examples here.
3. Confirm `<orca> status --json` reports a ready runtime and that the coordinator is running in an Orca-managed agent terminal.
4. Use Orca orchestration for every worker: create a task, create a dispatch, deliver its exact preamble, and wait for `worker_done` or escalation.

## Run preflight

1. Locate the repository-root `m1-plan.md`, `AGENTS.md`, and `Table-definetion.txt`. Stop if any is absent.
2. Run the bundled parser:

   ```text
   python3 scripts/read_m1_waves.py --plan <repo-root>/m1-plan.md
   ```

   Require exactly 13 ordered waves, unique task numbers, and at least one parsed implementation task. Use the first unchecked task as the only next task.
3. Confirm `kimi` is on `PATH` and `kimi --help` exposes both `--model` and `--yolo`.
4. Run `git rev-parse --verify HEAD`. Stop if the repository has no initial commit; a Git worktree cannot be created before one exists. Never create the initial commit implicitly.
5. Require the coordinator's current worktree to be the clean integration worktree. Stop on staged, modified, or untracked files; never hide or absorb unrelated changes.
6. Record the current integration branch and its HEAD. Require a named local branch, not detached HEAD.
7. Inspect `<orca> orchestration task-list --brief --json`, `<orca> worktree list --repo path:<repo-root> --json`, and `<orca> terminal list --json`. Do not reset or mutate unrelated runtime-global state.
8. Ensure this invocation has no existing active worker and no competing M1 loop. Never claim the same local plan task twice.

## Select the next task

Parse the local plan fresh before every dispatch. Select the first unchecked task in this order:

1. Ascending wave number.
2. Checklist order inside that wave.

Do not skip ahead, parallelize tasks, or use later-wave work simply because it looks independent. Do not infer completion from code, commits, Orca state, or remote state: `[x]` in the Implementation waves is completed; `[ ]` is pending.

Read the selected wave's `Exit gate` and the parser's sanitized `localTask` value. Fill [worker-contract.md](references/worker-contract.md) with those values. Do not pass the checklist's GitHub URL to the worker.

## Dispatch exactly one Kimi worker

Use a fresh child worktree based on the integration branch. The work is stacked on the current integrated result, so keep Orca child lineage explicit.

1. Create a unique name such as `m1-w<wave>-task-<number>`:

   ```text
   <orca> worktree create --repo path:<repo-root> --name <name> --parent-worktree active --base-branch <integration-branch> --json
   ```

2. Copy the exact full worktree ID, worktree path, and branch from the response. Never shorten the worktree ID.
3. Because the requested Kimi model and yolo arguments are custom argv, create the agent terminal explicitly:

   ```text
   <orca> terminal create --worktree id:<full-worktree-id> --title <name>-kimi --command 'kimi --model k3 --yolo' --json
   ```

   Capture only this new Kimi terminal handle. Do not send work to the fallback shell or reuse an older Kimi session.
4. Wait for readiness:

   ```text
   <orca> terminal wait --terminal <worker-handle> --for tui-idle --timeout-ms 60000 --json
   ```

5. Create an Orca orchestration task from the filled worker contract and capture its task ID:

   ```text
   <orca> orchestration task-create --spec <filled-worker-contract> --json
   ```

6. Dispatch without guessing whether this Kimi build supports direct injection:

   ```text
   <orca> orchestration dispatch --task <task-id> --to <worker-handle> --return-preamble --json
   <orca> terminal send --terminal <worker-handle> --text <exact-returned-preamble> --enter --json
   ```

   Send the exact returned preamble once. Never invent a lifecycle preamble, create a second dispatch, or separately resend the task spec.
7. Verify the dispatch with `<orca> orchestration dispatch-show --task <task-id> --json`. Record its task ID, dispatch ID, worktree ID, branch, and terminal handle as this invocation's sole active worker.
8. Set the worker worktree comment to `M1 Wave <wave> task #<number> in progress` and workspace status to `in-progress`.

## Supervise to a terminal outcome

Wait in rolling windows rather than sleep polling:

```text
<orca> orchestration check --wait --types worker_done,escalation,decision_gate --timeout-ms 60000 --json
```

- Accept lifecycle mail only when both `taskId` and `dispatchId` match the sole active worker.
- Answer a decision gate only when the local plan and repository instructions already determine the answer. Ask the user when ambiguity would materially change public contracts, architecture, or scope.
- Treat a timeout as a checkpoint, not failure. Inspect only the active task, worktree, and Kimi terminal for liveness, then continue waiting while it is alive.
- On escalation or failed validation, preserve the worktree, mark it blocked in its comment, report the blocker, and stop. Never create the next worker or a duplicate retry automatically.
- A valid `worker_done` automatically completes the orchestration task. Never manually mark it completed.

## Verify and integrate before continuing

After a successful `worker_done`:

1. Require the worker result to include its commit SHA, files modified, and exact tests run with outcomes.
2. Inspect the worker diff and commit locally. Require the worker branch to descend from the integration HEAD captured before dispatch. Reject unrelated changes, GitHub-derived scope, missing tests, or an uncommitted worktree.
3. Run appropriate validation from the worker worktree. At minimum, rerun the relevant tests; at a wave boundary, also run the broader checks necessary to demonstrate that wave's Exit gate.
4. Return to the clean integration worktree and fast-forward only:

   ```text
   git merge --ff-only <worker-branch>
   ```

   Stop if fast-forward fails. Never auto-rebase, force-update, or resolve conflicts by guessing.
5. Mark only the integrated task's checklist item `[x]` inside `m1-plan.md` Implementation waves. Match it by its unique task number within that section; do not alter Milestone closeout boxes or unrelated prose.
6. Commit that checklist update separately with a message such as `docs(m1): mark task #<number> complete`.
7. Confirm the integration worktree is clean, re-run the plan parser, and set the worker worktree status to `completed` with its integrated commit in the comment.
8. Only now may the loop select and spawn the next Kimi worker.

Do not push branches, create or merge pull requests, modify GitHub, close issues, delete worktrees, or reset Orca orchestration state unless separately and explicitly authorized.

## Stop conditions

Stop and report instead of spawning another worker when:

- every Implementation waves checkbox is `[x]`;
- the plan cannot be parsed unambiguously;
- the repository has no initial commit or the integration worktree is dirty;
- Orca or Kimi is unavailable;
- another M1 worker/loop already owns the next task;
- the current worker escalates, fails, exits without valid `worker_done`, leaves uncommitted work, or fails verification;
- integration cannot fast-forward; or
- a wave Exit gate cannot be demonstrated.

Report the completed task, integrated commit, validation evidence, next local task, and any blocker. Never report a remote issue or pull-request status because this skill does not read GitHub.
