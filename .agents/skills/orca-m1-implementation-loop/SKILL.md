---
name: orca-m1-implementation-loop
description: Execute the local `m1-plan.md` Implementation waves serially through supervised Orca workers, using a fresh worktree and a fresh Kimi agent launched with `kimi --model kimi-code/k3 --yolo` for each unchecked task, then publish and merge each task PR into `main`. Use when asked to run, continue, drain, or coordinate the Becoming M1 implementation plan one task at a time without reading GitHub issues or consulting remote issue state for scope.
---

# Orca M1 Implementation Loop

Use `m1-plan.md` as the sole scheduling and task-description source. Spawn exactly one fresh Orca Kimi worker at a time. A task is complete only after its validated implementation and checkbox commit are published in a pull request and that exact pull request is confirmed merged into remote `main`; only then start the next task.

## Non-negotiable source boundary

- Read only the local `m1-plan.md` Implementation waves for task numbers, titles, order, wave gates, and completion state.
- Treat issue numbers as local identifiers only.
- Never fetch issue bodies or comments, browse issue URLs, query issue endpoints, or consult remote labels, blockers, milestones, or issue state.
- Never use the plan's links as permission to open GitHub.
- Use GitHub only for the coordinator-owned delivery lifecycle of the task produced from the local plan: push its candidate branch, create its PR, inspect that PR's checks, mergeability, and state, merge it into `main`, and verify the resulting remote `main`. Do not read unrelated PRs or use PR content as task scope.
- Compose PR titles and bodies only from the local task description, local diff, and validation evidence. Do not use issue-closing keywords or close issues.
- Use `AGENTS.md`, `Table-definetion.txt`, the current local code, tests, and migrations as implementation context.
- Let the local checklist override the plan's prose that says GitHub is authoritative. The user explicitly selected local-plan-only execution for this skill.

## Fixed implementation choices

- Build a native iOS application with TypeScript, React Native, and Expo.
- Store application data locally on-device with SQLite through `expo-sqlite`; do not introduce a server database unless the user changes this architecture.
- Launch every Kimi worker with exactly `kimi --model kimi-code/k3 --yolo`.

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

   Require exactly 13 ordered waves, unique task numbers, and at least one parsed implementation task. Validate the plan here, but defer task selection until local `main` is synchronized with `origin/main`.
3. Confirm `kimi` is on `PATH` and `kimi --help` exposes both `--model` and `--yolo`.
4. Run `git rev-parse --verify HEAD`. Stop if the repository has no initial commit; a Git worktree cannot be created before one exists. Never create the initial commit implicitly.
5. Require the coordinator's current worktree to be the clean integration worktree. Stop on staged, modified, or untracked files; never hide or absorb unrelated changes.
6. Record the current integration branch and its HEAD. Require that branch to be the named local `main`, not detached HEAD.
7. Fetch `origin/main` without changing files. Normally require local `main` to equal `origin/main` before selecting a task. If local `main` is ahead only because a prior loop already committed one verified task plus its checklist update but did not publish them, enter publication recovery: publish those exact commits through a task PR, merge it, and synchronize `main` before dispatching anything. Stop on any other divergence or ambiguous unpublished commits.
8. Inspect `<orca> orchestration task-list --brief --json`, `<orca> worktree list --repo path:<repo-root> --json`, and `<orca> terminal list --json`. Do not reset or mutate unrelated runtime-global state.
9. Ensure this invocation has no existing active worker and no competing M1 loop. Never claim the same local plan task twice.

## Select the next task

Parse the local plan fresh before every dispatch. Select the first unchecked task in this order:

1. Ascending wave number.
2. Checklist order inside that wave.

Do not skip ahead, parallelize tasks, or use later-wave work simply because it looks independent. On synchronized `main`, `[x]` in the Implementation waves means its task PR has been merged and `[ ]` is pending. Never treat a checkbox that exists only on an unmerged candidate branch as completion.

Immediately before creating each worker, fetch `origin/main` again and require local `main` to equal it. If it changed, fast-forward local `main`, parse the plan again, and reselect the first unchecked task. Stop on divergence or if the selection changes while an active worker already owns the previously selected task.

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
   <orca> terminal create --worktree id:<full-worktree-id> --title <name>-kimi --command 'kimi --model kimi-code/k3 --yolo' --json
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
- A valid `worker_done` automatically completes only the worker's Orca orchestration task. It means the implementation is ready for coordinator verification; it does not complete the M1 plan task. Never manually mark the orchestration task completed.

## Verify, publish, and merge before continuing

After a successful `worker_done`:

1. Require the worker result to include its commit SHA, files modified, and exact tests run with outcomes.
2. Inspect the worker diff and commit locally. Require the worker branch to descend from the integration HEAD captured before dispatch. Reject unrelated changes, GitHub-derived scope, missing tests, or an uncommitted worktree.
3. Run appropriate validation from the worker worktree. At minimum, rerun the relevant tests; at a wave boundary, also run the broader checks necessary to demonstrate that wave's Exit gate.
4. Keep local `main` unchanged. In the clean worker worktree, mark only this task's checklist item `[x]` inside the `m1-plan.md` Implementation waves. Match its unique task number and do not alter Milestone closeout boxes or unrelated prose.
5. Commit the checklist update separately with a message such as `docs(m1): mark task #<number> complete`. The worker implementation commit and this coordinator-owned checklist commit form the PR candidate.
6. Confirm the candidate branch still descends from the captured integration HEAD and is clean. Push it to a new same-named remote branch without force.
7. Create one PR targeting `main`. Build its title and body only from the local task description, diff summary, and exact validation outcomes. Do not use issue-closing keywords. Record its URL, number, and candidate head SHA.
8. Request the repository's merge-commit strategy so the implementation and checklist commits retain their identities on `main`. If merge commits are unavailable, stop instead of silently switching to squash or rebase. If required checks are pending, enable merge-commit auto-merge when available or wait in bounded intervals and retry. Do not bypass protections. Inspect only this created PR's checks, mergeability, and state.
9. Do not mark the task complete when the PR is merely open, approved, queued, or has passing checks. Wait until GitHub reports that exact PR, with the recorded candidate head SHA, as merged into `main` and provides its merge commit.
10. Fetch `origin/main` and require the PR's reported merge commit to be its ancestor. Verify the task checkbox is `[x]` in `origin/main:m1-plan.md`.
11. In the clean integration worktree, run `git merge --ff-only origin/main`. Stop on failure; never auto-rebase, force-update, or resolve conflicts by guessing.
12. Re-run the plan parser from synchronized local `main`, then set the worker worktree status to `completed` and include the implementation SHA, PR URL, and remote merge commit in its comment.
13. Only now may the loop select and spawn the next Kimi worker.

Do not force-push, close issues, delete worktrees or branches, bypass branch protection, modify unrelated GitHub state, or reset Orca orchestration state unless separately and explicitly authorized.

## Stop conditions

Stop and report instead of spawning another worker when:

- every Implementation waves checkbox is `[x]`;
- the plan cannot be parsed unambiguously;
- the repository has no initial commit or the integration worktree is dirty;
- Orca or Kimi is unavailable;
- another M1 worker/loop already owns the next task;
- the current worker escalates, fails, exits without valid `worker_done`, leaves uncommitted work, or fails verification;
- a branch cannot be pushed, a PR cannot be created or merged, remote integration cannot be proven, or local `main` cannot fast-forward to `origin/main`;
- a wave Exit gate cannot be demonstrated.

Report the completed task, implementation and merge commits, PR URL, validation evidence, next local task, and any blocker. Never report remote issue status because this skill does not read GitHub issues.
