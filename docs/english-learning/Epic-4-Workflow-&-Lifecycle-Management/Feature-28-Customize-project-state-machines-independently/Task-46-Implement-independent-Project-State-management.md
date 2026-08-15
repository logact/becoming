# Issue #46: Task: Implement independent Project State management

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Customize project state machines independently (#28)

---

## 1. Original English

Parent Feature: #28

## Outcome

A Project can own, edit, order, archive, and query state definitions scoped to one Project/entity-type/Label machine, with optional template origin.

## Implementation plan

1. Define the ProjectState domain model and persistence contract from `project_states`, including optional `source_workflow_state_id` as provenance-only data.
2. Implement logical validation for Project, Label, supported entity type, normalized title uniqueness, initial/terminal semantics, and one active initial state within a machine.
3. Add create/update/reorder/archive commands for both copied and Project-native states, ensuring no command writes back to Workflow templates.
4. Expose active and historical machine queries with deterministic order.

## Acceptance criteria

- [ ] Project States are scoped by `project_id + entity_type + label_id`.
- [ ] States initialized from a Workflow can be edited without changing the source template.
- [ ] Project-native states work with no source Workflow ID.
- [ ] Source IDs remain queryable provenance and create no live coupling.
- [ ] State title/initial/order invariants are enforced per Project machine.
- [ ] Archived states remain historically queryable.

## Tests

- Domain and repository tests for all fields, machine isolation, native/copied states, ordering, and archival.
- Regression test proving Project edits do not touch source Workflow States.
- Concurrency test for competing initial-state creation.

## Dependencies

- Feature #27 initialization contract.
- Features #20 and #24 for Project and Label validation.

## Out of scope

- Project transitions.
- Runtime entity occupancy changes.
- Automatic template synchronization.

---

## 2. 中文翻译

父特性：#28

## 预期成果

项目可以拥有、编辑、排序、归档和查询归属于一个项目/实体类型/标签机器的状态定义，并可选地保留模板来源。

## 实现计划

1. 根据 `project_states` 定义 ProjectState 领域模型和持久化契约，包括仅作为溯源数据的可选 `source_workflow_state_id`。
2. 实现项目、标签、受支持实体类型、规范化标题唯一性、初始/终止语义以及机器内单一活跃初始状态的逻辑验证。
3. 为复制和项目原生状态添加创建/更新/排序/归档命令，确保任何命令都不会写回工作流模板。
4. 暴露活跃和历史机器查询，按确定性顺序返回。

## 验收标准

- [ ] 项目状态按 `project_id + entity_type + label_id` 划分范围。
- [ ] 从工作流初始化的状态可以被编辑，而不会改变源模板。
- [ ] 项目原生状态可以没有源工作流 ID。
- [ ] 源 ID 保持为可查询溯源，不产生实时耦合。
- [ ] 每个项目机器强制执行状态标题/初始/排序不变量。
- [ ] 已归档状态可在历史上查询。

## 测试

- 所有字段、机器隔离、原生/复制状态、排序和归档的领域和仓库测试。
- 证明项目编辑不会触及源工作流状态的回归测试。
- 竞争初始状态创建的并发测试。

## 依赖

- 特性 #27 初始化契约。
- 特性 #20 和 #24 用于项目和标签验证。

## 范围外

- 项目转换。
- 运行时实体占用变更。
- 自动模板同步。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the ProjectState domain model and persistence contract from project_states, including optional source_workflow_state_id as provenance-only data. |
| archive | 归档 | A Project can own, edit, order, archive, and query state definitions scoped to one Project/entity-type/Label machine, with optional template origin. |
| query | 查询 | A Project can own, edit, order, archive, and query state definitions scoped to one Project/entity-type/Label machine, with optional template origin. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement logical validation for Project, Label, supported entity type, normalized title uniqueness, initial/terminal semantics, and one active initial state within a machine. |
| add | 添加 | Add create/update/reorder/archive commands for both copied and Project-native states, ensuring no command writes back to Workflow templates. |
| expose | 暴露 | Expose active and historical machine queries with deterministic order. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| source template | 源模板 | States initialized from a Workflow can be edited without changing the source template. |
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
| Provenance | 溯源 |
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Occupancy | 占用情况 |
| Source template | 源模板 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Concurrent requests require _______ controls to avoid duplicate active rows.
3. Archiving a Workflow must not invalidate historical project _______.
4. Workflow discovery must return _______ results when multiple candidates match.
5. A machine should have at most one active _______ state.

<details>
<summary>点击查看答案</summary>

1. provenance
2. concurrency
3. execution
4. deterministic
5. initial

</details>
