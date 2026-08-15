# Issue #50: Task: Persist entity state history and initialize current state safely

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Execute project-scoped lifecycle transitions (#29)

---

## 1. Original English

Parent Feature: #29

## Outcome

A supported core entity can enter the active initial State of a Project machine with one durable current row and complete temporal history.

## Implementation plan

1. Implement the `project_entity_states` repository for current lookup, historical list, insert, and end-period operations keyed by Project/entity-type/entity/Label.
2. Resolve and validate the Project, entity, Label assignment, Project machine, and exactly one active initial Project State in the application layer.
3. Implement an initialization command that creates the first state period atomically and rejects already-initialized or invalid contexts.
4. Enforce at most one active row per context under concurrency using a compatible storage invariant/transaction strategy despite logical references.

## Acceptance criteria

- [ ] Initialization uses a valid active initial Project State in the matching machine.
- [ ] The Project State matches row Project, entity type, and Label.
- [ ] Missing/archived references, unsupported types, absent/ambiguous initials, and duplicate initialization return explicit errors.
- [ ] Concurrent initialization cannot create multiple current rows.
- [ ] Current and complete chronological state history are queryable.
- [ ] Ended state periods are never overwritten or deleted.

## Tests

- Table-driven validation tests across all eight core entity types.
- Repository contract tests for current/history lookup, chronology, and ending periods.
- Concurrency test for duplicate initialization and rollback tests for invalid contexts.

## Dependencies

- Feature #28 Project State machines.
- Feature #24 active Label assignments.

## Out of scope

- Moving between states.
- Automatic initialization when a Label is assigned.
- Lifecycle audit Records (Feature #9).

---

## 2. 中文翻译

父特性：#29

## 预期成果

受支持的核心实体可以进入项目机器的活跃初始状态，拥有一条持久的当前行和完整的时间历史。

## 实现计划

1. 实现 `project_entity_states` 仓库，支持按项目/实体类型/实体/标签进行当前查找、历史列表、插入和结束周期操作。
2. 在应用层解析和验证项目、实体、标签分配、项目机器以及恰好一个活跃项目初始状态。
3. 实现初始化命令，原子地创建第一个状态周期，并拒绝已初始化或无效的上下文。
4. 尽管是逻辑引用，仍使用兼容的存储约束/事务策略，在并发下强制每个上下文最多只有一个活跃行。

## 验收标准

- [ ] 初始化使用匹配机器中的有效活跃项目初始状态。
- [ ] 项目状态与行的项目、实体类型和标签匹配。
- [ ] 缺失/已归档引用、不受支持的类型、缺失/模糊初始状态以及重复初始化返回显式错误。
- [ ] 并发初始化不能创建多个当前行。
- [ ] 当前状态和完整时间状态历史可查询。
- [ ] 已结束状态周期从不被覆盖或删除。

## 测试

- 跨全部八种核心实体类型的表驱动验证测试。
- 当前/历史查找、时间线和结束周期的仓库契约测试。
- 重复初始化的并发测试和无效上下文的回滚测试。

## 依赖

- 特性 #28 项目状态机。
- 特性 #24 活跃标签分配。

## 范围外

- 状态之间移动。
- 分配标签时自动初始化。
- 生命周期审计记录（特性 #9）。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| enforce | 强制执行 | Enforce at most one active row per context under concurrency using a compatible storage invariant/transaction strategy despite logical references. |
| validate | 验证 | Resolve and validate the Project, entity, Label assignment, Project machine, and exactly one active initial Project State in the application layer. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| end | 结束 | Implement the project_entity_states repository for current lookup, historical list, insert, and end-period operations keyed by Project/entity-type/entity/Label. |
| implement | 实现 | Implement the project_entity_states repository for current lookup, historical list, insert, and end-period operations keyed by Project/entity-type/entity/Label. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| active row | 活跃行 | Enforce at most one active row per context under concurrency using a compatible storage invariant/transaction strategy despite logical references. |
| state history | 状态历史 | Current and complete chronological state history are queryable. |
| state period | 状态周期 | Implement an initialization command that creates the first state period atomically and rejects already-initialized or invalid contexts. |
| logical references | 逻辑引用 | Enforce at most one active row per context under concurrency using a compatible storage invariant/transaction strategy despite logical references. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Lifecycle | 生命周期 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| State history | 状态历史 |
| Workflow | 工作流 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Concurrent requests require _______ controls to avoid duplicate active rows.
4. Archiving a Workflow must not invalidate historical project _______.
5. All eight core entity types can receive and end _______ assignments.

<details>
<summary>点击查看答案</summary>

1. state machine
2. atomically
3. concurrency
4. execution
5. Label

</details>
