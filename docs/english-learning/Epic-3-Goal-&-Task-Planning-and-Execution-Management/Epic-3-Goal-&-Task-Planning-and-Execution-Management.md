# Issue #3: Epic: Goal & Task Planning and Execution Management

**Labels:** Epic  
**State:** OPEN  
**Parent:** None

---

## 1. Original English

## Purpose

Manage the process of turning a Goal into executable work and tracking progress inside a Project.

## Scope

- Create a Project to achieve a Goal.
- Decompose Goals into sub-goals and Tasks.
- Decompose large Tasks into smaller Tasks.
- Organize Goal and Task relationships within a Project.
- Track, inspect, and change Goal and Task states.
- Maintain the current execution state of a Project.

The Project uses workflows defined by the Workflow & Lifecycle Management epic.

## Non-goals

- Defining reusable workflows or state machines.
- Maintaining cross-entity history and provenance.
- Managing resource budgets or consumption.

## Acceptance criteria

- A Goal can have one or more Projects.
- Projects can contain nested Goals and Tasks with explicit relationships.
- Goals and Tasks expose a current state and supported state changes.
- Project progress can be inspected from its contained work.
- Domain rules prevent invalid hierarchy or state updates.

## Dependencies

- Workflow & Lifecycle Management for configurable lifecycle rules.
- Data Provenance & History for recording changes.

This issue is labeled Epic.

---

## 2. 中文翻译

## 目的

管理将目标（Goal）转化为可执行工作，并在项目（Project）内跟踪进展的过程。

## 范围

- 创建项目以实现目标。
- 将目标分解为子目标和任务（Task）。
- 将大任务分解为更小的任务。
- 在项目内组织目标与任务之间的关系。
- 跟踪、检查并修改目标与任务的状态。
- 维护项目的当前执行状态。

项目使用由“工作流与生命周期管理” Epic 所定义的工作流。

## 非目标

- 定义可复用的工作流或状态机。
- 维护跨实体的历史与来源追溯。
- 管理资源预算或消耗。

## 验收标准

- 一个目标可以拥有一个或多个项目。
- 项目可以包含具有明确关系的嵌套目标与任务。
- 目标与任务展示当前状态以及支持的状态变更。
- 可以从项目所包含的工作中检查项目进展。
- 领域规则会阻止无效的层级结构或状态更新。

## 依赖

- 工作流与生命周期管理：用于可配置的生命周期规则。
- 数据来源与历史：用于记录变更。

本 issue 标记为 Epic。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| manage | 管理 | Manage the process of turning a Goal into executable work. |
| decompose | 分解 | Decompose Goals into sub-goals and Tasks. |
| track | 跟踪 | Track, inspect, and change Goal and Task states. |
| inspect | 检查 | Project progress can be inspected from its contained work. |
| maintain | 维护 | Maintain the current execution state of a Project. |
| prevent | 阻止 | Domain rules prevent invalid hierarchy or state updates. |
| organize | 组织 | Organize Goal and Task relationships within a Project. |
| achieve | 实现 | Create a Project to achieve a Goal. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| turn A into B | 把 A 转化为 B | turning a Goal into executable work |
| executable work | 可执行的工作 | executable work and tracking progress |
| nested Goals and Tasks | 嵌套的目标与任务 | Projects can contain nested Goals and Tasks |
| current state | 当前状态 | Goals and Tasks expose a current state |
| state changes | 状态变更 | supported state changes |
| domain rules | 领域规则 | Domain rules prevent invalid hierarchy |
| acceptance criteria | 验收标准 | Acceptance criteria |
| lifecycle rules | 生命周期规则 | configurable lifecycle rules |

### 值得模仿的句式
1. **"Manage the process of ... and tracking ... inside ..."** — 管理……并在……内跟踪…… — Manage the process of turning a Goal into executable work and tracking progress inside a Project.
2. **"A can have one or more B."** — A 可以拥有一个或多个 B。 — A Goal can have one or more Projects.
3. **"Domain rules prevent invalid ..."** — 领域规则阻止无效的…… — Domain rules prevent invalid hierarchy or state updates.

### 领域词汇
| English | 中文 |
|---|---|
| Goal | 目标 |
| Project | 项目 |
| Task | 任务 |
| Sub-goal | 子目标 |
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Hierarchy | 层级结构 |
| Domain rules | 领域规则 |
| Acceptance criteria | 验收标准 |

---

## 4. 小练习

1. Projects can contain ______ Goals and Tasks with explicit relationships.
2. Domain rules prevent invalid ______ or state updates.
3. A Goal can have one or more ______.
4. The Project uses workflows defined by the Workflow & ______ Management epic.
5. ______ Goals into sub-goals and Tasks.

<details>
<summary>点击查看答案</summary>

1. nested
2. hierarchy
3. Projects
4. Lifecycle
5. Decompose
</details>
