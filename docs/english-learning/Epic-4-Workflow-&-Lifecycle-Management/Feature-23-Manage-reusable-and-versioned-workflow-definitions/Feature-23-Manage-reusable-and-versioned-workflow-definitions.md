# Issue #23: Feature: Manage reusable and versioned workflow definitions

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can define reusable processes for project management, goal decomposition, task decomposition, execution, and triage without embedding those rules in execution entities.

## Scope

- Create, read, update, archive, and list Workflow entities.
- Capture workflow type, purpose, version, entry criteria, and exit criteria.
- Support workflow types for project management, goal decomposition/execution, task decomposition/execution, and idea triage.
- Define explicit versioning rules and lineage between versions.

## Acceptance criteria

- A Workflow requires a title, workflow type, and positive version.
- Entry and exit criteria are optional and preserved.
- Consumers can query active Workflows by type and version.
- Publishing a new version creates a distinguishable definition and does not rewrite the earlier version.
- Archiving a Workflow does not invalidate historical project execution.
- Important mutations and version creation produce provenance.

## Dependencies

- Feature: Capture provenance for core entity mutations.

## Out of scope

- Project-specific state machines.
- Executing lifecycle transitions.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以定义可复用的项目管理、目标分解、任务分解、执行与分流流程，而无需将这些规则嵌入执行实体中。

## 范围

- 创建、读取、更新、归档并列出工作流实体。
- 捕获工作流类型、用途、版本、准入条件和退出条件。
- 支持项目管理、目标分解/执行、任务分解/执行以及想法分流等工作流类型。
- 定义显式的版本规则及版本之间的血统关系。

## 验收标准

- 工作流需要标题、工作流类型和正版本号。
- 准入条件和退出条件为可选项，且会被保留。
- 消费者可以按类型和版本查询活跃工作流。
- 发布新版本会创建一个可区分的定义，不会改写之前的版本。
- 归档工作流不会使历史项目执行失效。
- 重要变更和版本创建都会产生溯源记录。

## 依赖

- 特性：捕获核心实体变更的溯源。

## 范围外

- 项目特定的状态机。
- 执行生命周期转换。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Users can define reusable processes for project management, goal decomposition, task decomposition, execution, and triage without embedding those rules in execution entities. |
| archive | 归档 | Create, read, update, archive, and list Workflow entities. |
| query | 查询 | Consumers can query active Workflows by type and version. |
| capture | 捕获 | Capture workflow type, purpose, version, entry criteria, and exit criteria. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| entry criteria | 准入条件 | Capture workflow type, purpose, version, entry criteria, and exit criteria. |
| exit criteria | 退出条件 | Capture workflow type, purpose, version, entry criteria, and exit criteria. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |

### 值得模仿的句式
1. **Users can ... without embedding those rules in execution entities.** — 用户可以在不将这些规则嵌入执行实体的情况下…… — 例句：Users can define reusable processes without embedding those rules in execution entities.
2. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
3. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
4. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Decomposition | 分解 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Lineage | 血统/谱系 |
| Entry criteria | 准入条件 |
| Exit criteria | 退出条件 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Every material mutation should emit structured _______ in the same transaction.
3. Archiving a Workflow must not invalidate historical project _______.
4. Required source _______ must pass before a transition is authorized.
5. Publishing a new version records an explicit, traversable _______ to its predecessor.

<details>
<summary>点击查看答案</summary>

1. state machine
2. provenance
3. execution
4. exit criteria
5. lineage

</details>
