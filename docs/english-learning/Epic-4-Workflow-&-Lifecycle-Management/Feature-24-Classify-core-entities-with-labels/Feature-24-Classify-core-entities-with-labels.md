# Issue #24: Feature: Classify core entities with labels

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can classify any core concept and use selected labels to identify the appropriate lifecycle state machine.

## Scope

- Create, read, update, archive, and list Label definitions.
- Assign and end labels on every supported core entity type.
- Preserve assignment history with created-at and ended-at values.
- Validate logical entity and label references.
- Distinguish classification-only labels from labels configured for state management.

## Acceptance criteria

- Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record can receive labels.
- Duplicate active assignments of the same label are rejected.
- Ending an assignment preserves its history.
- Archived labels cannot be newly assigned but remain resolvable historically.
- A label does not imply a state machine unless Workflow or Project configuration defines one.
- Queries return active labels by entity and labeled entities by label.

## Dependencies

- Feature: Create and validate semantic relations is not used for label assignment; labels remain supporting concepts.
- Feature: Track relationship changes over time or equivalent label-assignment provenance behavior.

## Out of scope

- Hierarchical labels.
- Label-based authorization.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以对任何核心概念进行分类，并使用选定的标签来标识适用的生命周期状态机。

## 范围

- 创建、读取、更新、归档并列出标签定义。
- 为每种受支持的核心实体类型分配和结束标签。
- 保留分配历史，包括创建时间和结束时间。
- 验证逻辑实体和标签引用。
- 区分仅用于分类的标签与配置用于状态管理的标签。

## 验收标准

- 任务、目标、项目、想法、理念、工作流、资源和记录都可以接收标签。
- 拒绝同一标签的重复活跃分配。
- 结束分配会保留其历史。
- 已归档标签不能被新分配，但在历史上仍可解析。
- 除非工作流或项目配置定义了状态机，否则标签不隐含状态机。
- 查询按实体返回活跃标签，按标签返回被标注实体。

## 依赖

- 特性：创建并验证语义关系不用于标签分配；标签仍然是辅助概念。
- 特性：随时间追踪关系变化，或等效的标签分配溯源行为。

## 范围外

- 层级标签。
- 基于标签的授权。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| archive | 归档 | Create, read, update, archive, and list Label definitions. |
| validate | 验证 | Validate logical entity and label references. |
| classify | 分类 | Users can classify any core concept and use selected labels to identify the appropriate lifecycle state machine. |
| distinguish | 区分 | Distinguish classification-only labels from labels configured for state management. |
| preserve | 保留 | Preserve assignment history with created-at and ended-at values. |
| record | 记录 | Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record can receive labels. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| assign | 分配 | Assign and end labels on every supported core entity type. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| semantic relations | 语义关系 | Feature: Create and validate semantic relations is not used for label assignment; labels remain supporting concepts. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| State machine | 状态机 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Every material mutation should emit structured _______ in the same transaction.
3. Archiving a Workflow must not invalidate historical project _______.
4. All eight core entity types can receive and end _______ assignments.
5. A duplicate active assignment is _______ even under concurrent requests.

<details>
<summary>点击查看答案</summary>

1. state machine
2. provenance
3. execution
4. Label
5. rejected

</details>
