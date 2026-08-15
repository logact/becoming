# Issue #28: Feature: Customize project state machines independently

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can adapt a Project's lifecycle to local needs without altering the reusable Workflow or being silently changed by later Workflow updates.

## Scope

- Create, update, archive, order, and query Project States.
- Create, update, archive, and query Project State transitions.
- Validate project/entity-type/label machine identity.
- Retain initialization provenance while allowing independent edits.
- Prevent later Workflow changes from mutating an initialized Project machine.

## Acceptance criteria

- Project States and transitions can be edited without changing their source Workflow templates.
- Both endpoints of a Project transition belong to the same Project/entity-type/label machine.
- Source Workflow IDs remain provenance and do not impose live coupling.
- New Workflow versions do not modify existing Project machines.
- Project-specific states and transitions without template sources are supported.
- Invalid removal of a state currently occupied by an entity is rejected or requires an explicit migration.

## Dependencies

- Feature: Apply workflows to entities and initialize project machines.

## Out of scope

- Automatic merging of template changes into Project machines.
- Runtime entity transitions.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以针对本地需求调整项目的生命周期，而无需修改可复用工作流，也不会被后续工作流更新静默更改。

## 范围

- 创建、更新、归档、排序和查询项目状态。
- 创建、更新、归档和查询项目状态转换。
- 验证项目/实体类型/标签机器身份。
- 保留初始化溯源，同时允许独立编辑。
- 防止后续工作流变更变更已初始化的项目机器。

## 验收标准

- 项目状态和转换可以被编辑，而不会改变其源工作流模板。
- 项目转换的两个端点都属于同一个项目/实体类型/标签机器。
- 源工作流 ID 保持为溯源，不产生实时耦合。
- 新的工作流版本不会修改现有项目机器。
- 支持没有模板来源的项目特定状态和转换。
- 拒绝或要求显式迁移当前被实体占用的状态的无效移除。

## 依赖

- 特性：将工作流应用于实体并初始化项目机器。

## 范围外

- 自动将模板变更合并到项目机器中。
- 运行时实体转换。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| archive | 归档 | Create, update, archive, order, and query Project States. |
| initialize | 初始化 | Feature: Apply workflows to entities and initialize project machines. |
| validate | 验证 | Validate project/entity-type/label machine identity. |
| query | 查询 | Create, update, archive, order, and query Project States. |
| apply | 应用 | Feature: Apply workflows to entities and initialize project machines. |
| retain | 保留 | Retain initialization provenance while allowing independent edits. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| machine identity | 机器标识 | Validate project/entity-type/label machine identity. |
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
| Transition | 转换/迁移 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Machine identity | 机器标识 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Archiving an _______ Project State should be rejected unless a migration is provided.
3. An explicit _______ command moves entities out of an occupied State safely.
4. It is important to _______ every transition before committing it.
5. Consumers can _______ active Workflows by type and version.

<details>
<summary>点击查看答案</summary>

1. provenance
2. occupied
3. migration
4. validate
5. query

</details>
