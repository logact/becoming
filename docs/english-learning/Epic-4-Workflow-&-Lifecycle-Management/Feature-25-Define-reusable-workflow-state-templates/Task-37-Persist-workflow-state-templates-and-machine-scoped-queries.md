# Issue #37: Task: Persist workflow state templates and machine-scoped queries

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define reusable workflow state templates (#25)

---

## 1. Original English

Parent Feature: #25

## Outcome

Reusable state templates are durably stored and queried by their exact Workflow/entity-type/Label machine identity.

## Implementation plan

1. Define the WorkflowState domain model from `workflow_states`, including supported entity types, optional category/order/criteria, initial/terminal flags, timestamps, and archival.
2. Add the documented storage migration and repository ports for create, get, update, archive, list-by-machine, and historical resolution, with logical UUID references and no database foreign keys.
3. Implement application-level checks that Workflow and Label exist and that entity type is one of the eight core concepts.
4. Define deterministic `sort_order` and tie-breaking behavior for machine queries.

## Acceptance criteria

- [ ] Every state belongs to exactly one `workflow_id + entity_type + label_id` machine.
- [ ] Missing/archived Workflow or Label and unsupported entity types produce explicit errors for new states.
- [ ] All state fields round-trip through persistence.
- [ ] Active machine queries are deterministically ordered.
- [ ] Archived states remain retrievable by ID and in historical version queries.

## Tests

- Domain tests for allowed entity types and field validation.
- Repository contract tests for all fields, machine isolation, active/historical filtering, and ordering ties.
- Migration/schema tests confirming no database foreign keys.

## Dependencies

- Feature #23 workflow definitions.
- Feature #24 label definitions.

## Out of scope

- Workflow transitions.
- Project-specific state copies.
- Runtime state occupancy.

---

## 2. 中文翻译

父特性：#25

## 预期成果

可复用状态模板被持久化存储，并通过精确的工作流/实体类型/标签机器身份进行查询。

## 实现计划

1. 根据 `workflow_states` 定义 WorkflowState 领域模型，包括受支持的实体类型、可选类别/排序/条件、初始/终止标志、时间戳和归档。
2. 添加文档化的存储迁移和仓库端口，支持创建、获取、更新、归档、按机器列出和历史解析，使用逻辑 UUID 引用且不包含数据库外键。
3. 在应用层检查工作流和标签存在，且实体类型属于八种核心概念之一。
4. 为机器查询定义确定性的 `sort_order` 和打破平局的规则。

## 验收标准

- [ ] 每个状态恰好属于一个 `workflow_id + entity_type + label_id` 机器。
- [ ] 缺失/已归档的工作流或标签以及不受支持的实体类型会在创建新状态时产生显式错误。
- [ ] 所有状态字段通过持久化无损往返。
- [ ] 活跃机器查询按确定性顺序返回。
- [ ] 已归档状态可通过 ID 和历史版本查询检索。

## 测试

- 允许实体类型和字段验证的领域测试。
- 所有字段、机器隔离、活跃/历史过滤和排序平局的仓库契约测试。
- 确认无数据库外键的迁移/模式测试。

## 依赖

- 特性 #23 工作流定义。
- 特性 #24 标签定义。

## 范围外

- 工作流转换。
- 项目特定状态副本。
- 运行时状态占用。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the WorkflowState domain model from workflow_states, including supported entity types, optional category/order/criteria, initial/terminal flags, timestamps, and archival. |
| archive | 归档 | Add the documented storage migration and repository ports for create, get, update, archive, list-by-machine, and historical resolution, with logical UUID references and no datab... |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement application-level checks that Workflow and Label exist and that entity type is one of the eight core concepts. |
| add | 添加 | Add the documented storage migration and repository ports for create, get, update, archive, list-by-machine, and historical resolution, with logical UUID references and no datab... |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| machine identity | 机器标识 | Reusable state templates are durably stored and queried by their exact Workflow/entity-type/Label machine identity. |
| historical resolution | 历史解析 | Add the documented storage migration and repository ports for create, get, update, archive, list-by-machine, and historical resolution, with logical UUID references and no datab... |
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
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Machine identity | 机器标识 |
| Occupancy | 占用情况 |

---

## 4. 小练习

1. Archiving a Workflow must not invalidate historical project _______.
2. Workflow discovery must return _______ results when multiple candidates match.
3. Invalid transitions should be _______ by the state machine.

<details>
<summary>点击查看答案</summary>

1. execution
2. deterministic
3. rejected

</details>
