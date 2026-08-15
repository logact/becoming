# Issue #4: Epic: Workflow & Lifecycle Management

**Labels:** Epic  
**State:** OPEN  
**Parent:** None

---

## 1. Original English

## Purpose

Define reusable rules for how Goals, Projects, and Tasks are decomposed, executed, and moved through their lifecycle.

## Scope

- Define Project Management Workflows.
- Define Goal decomposition workflows.
- Define Task decomposition and execution workflows.
- Define state machines and allowed transitions.
- Associate workflows with Projects, Goals, and Tasks.
- Support changing or versioning workflows over time.

Example lifecycle: Backlog → Ready → In Progress → Review → Done.

## Non-goals

- Managing a particular Project's work or progress.
- Recording the full history of changes.
- Allocating or consuming resources.

## Acceptance criteria

- Workflows are first-class, reusable domain entities.
- A workflow can define decomposition rules and lifecycle states.
- Allowed transitions are explicit and invalid transitions are rejected.
- Projects, Goals, and Tasks can reference an applicable workflow.
- Workflow changes do not silently rewrite historical execution records.
- The model leaves room for workflow versioning.

## Dependencies

- Goal & Task Planning and Execution Management for workflow consumers.
- Data Provenance & History for workflow and transition records.

This issue is labeled Epic.

---

## 2. 中文翻译

## 目的

定义可复用的规则，用于规范目标、项目和任务如何被分解、执行以及在生命周期中流转。

## 范围

- 定义项目管理工作流。
- 定义目标分解工作流。
- 定义任务分解与执行工作流。
- 定义状态机及允许的转换。
- 将工作流与项目、目标和任务关联。
- 支持工作流随时间变化或进行版本管理。

示例生命周期：待办 → 就绪 → 进行中 → 评审 → 已完成。

## 非目标

- 管理某个特定项目的工作或进度。
- 记录完整的变更历史。
- 分配或消耗资源。

## 验收标准

- 工作流是一等公民、可复用的领域实体。
- 工作流可以定义分解规则和生命周期状态。
- 允许的转换必须显式定义，无效转换将被拒绝。
- 项目、目标和任务可以引用适用的工作流。
- 工作流变更不会悄悄改写历史执行记录。
- 模型为工作流版本管理预留空间。

## 依赖

- 目标与任务规划及执行管理（作为工作流的消费者）。
- 数据来源与历史（用于记录工作流及转换记录）。

此 issue 被标记为 Epic。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define reusable rules for how Goals, Projects, and Tasks are decomposed, executed, and moved through their lifecycle. |
| associate | 关联 | Associate workflows with Projects, Goals, and Tasks. |
| reference | 引用 | Projects, Goals, and Tasks can reference an applicable workflow. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| decompose | 分解 | Decompose large Tasks into smaller ones. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| allowed transitions | 允许的转换 | Define state machines and allowed transitions. |
| invalid transitions | 无效的转换 | Allowed transitions are explicit and invalid transitions are rejected. |
| workflow versioning | 工作流版本管理 | The model leaves room for workflow versioning. |
| domain entities | 领域实体 | Workflows are first-class, reusable domain entities. |
| lifecycle states | 生命周期状态 | A workflow can define decomposition rules and lifecycle states. |
| first-class | 一等公民的 | Workflows are first-class, reusable domain entities. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Decomposition | 分解 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |

---

## 4. 小练习

1. The model leaves room for workflow _______ so definitions can evolve over time.
2. Only _______ transitions are permitted; invalid ones are rejected.
3. A reusable Workflow defines the _______ and allowed transitions for managed entities.
4. Workflows should be _______, reusable domain entities.
5. Every material mutation should emit structured _______ in the same transaction.

<details>
<summary>点击查看答案</summary>

1. versioning
2. allowed
3. state machine
4. first-class
5. provenance

</details>
