# Issue #25: Feature: Define reusable workflow state templates

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can define reusable lifecycle states for a particular Workflow, entity type, and management label.

## Scope

- Create, update, archive, order, and query Workflow State templates.
- Identify a machine by workflow ID, entity type, and label ID.
- Capture category, initial/terminal flags, and entry/exit criteria.
- Enforce application-level logical-reference and machine-integrity rules.

## Acceptance criteria

- Every state belongs to exactly one workflow/entity-type/label machine.
- Referenced Workflow and Label exist and the entity type is supported.
- State titles are unique within a machine according to an explicit normalization rule.
- A machine has no more than one active initial state unless multiple initials are explicitly supported.
- Initial and terminal semantics are validated and queryable.
- Archived states remain resolvable by historical versions.

## Dependencies

- Feature: Manage reusable and versioned workflow definitions.
- Feature: Classify core entities with labels.

## Out of scope

- Project-specific state copies.
- Transition execution.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以为特定工作流、实体类型和管理标签定义可复用的生命周期状态。

## 范围

- 创建、更新、归档、排序和查询工作流状态模板。
- 通过工作流 ID、实体类型和标签 ID 标识一个机器。
- 捕获类别、初始/终止标志以及准入/退出条件。
- 强制执行应用层逻辑引用和机器完整性规则。

## 验收标准

- 每个状态恰好属于一个工作流/实体类型/标签机器。
- 引用的工作流和标签存在，且实体类型受支持。
- 状态标题按照显式规范化规则在机器内唯一。
- 除非显式支持多个初始状态，否则机器最多只有一个活跃初始状态。
- 初始和终止语义经过验证且可查询。
- 已归档状态仍可被历史版本解析。

## 依赖

- 特性：管理可复用且带版本的工作流定义。
- 特性：用标签对核心实体分类。

## 范围外

- 项目特定的状态副本。
- 转换执行。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Users can define reusable lifecycle states for a particular Workflow, entity type, and management label. |
| reference | 引用 | Enforce application-level logical-reference and machine-integrity rules. |
| archive | 归档 | Create, update, archive, order, and query Workflow State templates. |
| enforce | 强制执行 | Enforce application-level logical-reference and machine-integrity rules. |
| classify | 分类 | Feature: Classify core entities with labels. |
| query | 查询 | Create, update, archive, order, and query Workflow State templates. |
| capture | 捕获 | Capture category, initial/terminal flags, and entry/exit criteria. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| lifecycle states | 生命周期状态 | Users can define reusable lifecycle states for a particular Workflow, entity type, and management label. |
| exit criteria | 退出条件 | Capture category, initial/terminal flags, and entry/exit criteria. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |

### 值得模仿的句式
1. **Every ... belongs to exactly one ...** — 每个……恰好属于一个…… — 例句：Every state belongs to exactly one workflow/entity-type/label machine.
2. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
3. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
4. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Exit criteria | 退出条件 |

---

## 4. 小练习

1. Archiving a Workflow must not invalidate historical project _______.
2. Users can classify core entities with _______ and preserve assignment history.
3. A machine should have at most one active _______ state.
4. Required source _______ must pass before a transition is authorized.
5. The application should _______ workflow state machine integrity.

<details>
<summary>点击查看答案</summary>

1. execution
2. labels
3. initial
4. exit criteria
5. enforce

</details>
