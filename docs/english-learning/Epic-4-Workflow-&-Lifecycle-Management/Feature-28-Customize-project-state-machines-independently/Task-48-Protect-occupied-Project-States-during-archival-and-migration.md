# Issue #48: Task: Protect occupied Project States during archival and migration

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Customize project state machines independently (#28)

---

## 1. Original English

Parent Feature: #28

## Outcome

A Project State currently occupied by managed entities cannot be invalidated accidentally; explicit migration is atomic, inspectable, and history-preserving.

## Implementation plan

1. Add occupancy queries against `project_entity_states` and require them before State archival or other removal-like mutations.
2. Define V1 behavior: reject archival of an occupied state by default and offer an explicit migration command only when a valid destination in the same machine is supplied.
3. Implement migration transactionally, closing each active state period and opening one destination period while preserving historical rows and transition/provenance context.
4. Integrate Project State/transition mutations and migrations with provenance, and add complete active/historical machine views.

## Acceptance criteria

- [ ] Archiving an occupied State without migration is rejected and changes nothing.
- [ ] An explicit destination must be active and in the identical Project/entity-type/Label machine.
- [ ] Migration preserves old occupancy history and creates exactly one active destination row per entity.
- [ ] Invalid or concurrent migration cannot produce multiple active rows.
- [ ] Project machine changes emit provenance atomically.
- [ ] Current and historical machine queries surface archived definitions and origin IDs correctly.

## Tests

- Acceptance tests for unoccupied archive, occupied rejection, valid bulk migration, and invalid destinations.
- Concurrency/fault-injection tests for migration atomicity and active-row uniqueness.
- Provenance tests for native and template-origin Project machine edits.

## Dependencies

- The two preceding Feature #28 tasks.
- Feature #29 current-state repository and active uniqueness.
- Feature #30 mutation provenance; Feature #9 lifecycle-transition audit semantics where migration is recorded as transitions.

## Out of scope

- Automatic migration heuristics.
- Template-to-Project synchronization.
- General background workflow automation.

---

## 2. 中文翻译

父特性：#28

## 预期成果

当前被管理实体占用的项目状态不会被意外失效；显式迁移是原子的、可检查的，并且保留历史。

## 实现计划

1. 针对 `project_entity_states` 添加占用查询，并在状态归档或其他类移除变更前要求检查占用情况。
2. 定义 V1 行为：默认拒绝归档被占用状态，仅当提供同一机器内有效目标状态时才提供显式迁移命令。
3. 事务性地实现迁移，关闭每个活跃状态周期并开启一个目标周期，同时保留历史行和转换/溯源上下文。
4. 将项目状态/转换变更和迁移与溯源集成，并提供完整的活跃/历史机器视图。

## 验收标准

- [ ] 无迁移时归档被占用状态会被拒绝且不做任何变更。
- [ ] 显式目标必须处于活跃状态，且位于相同的项目/实体类型/标签机器中。
- [ ] 迁移保留旧占用历史，并为每个实体恰好创建一个活跃目标行。
- [ ] 无效或并发迁移不能产生多个活跃行。
- [ ] 项目机器变更原子地发出溯源记录。
- [ ] 当前和历史机器查询正确呈现已归档定义和来源 ID。

## 测试

- 未占用归档、占用拒绝、有效批量迁移和无效目标的验收测试。
- 迁移原子性和活跃行唯一性的并发/故障注入测试。
- 原生和模板来源项目机器编辑的溯源测试。

## 依赖

- 特性 #28 的前两个任务。
- 特性 #29 当前状态仓库和活跃唯一性。
- 特性 #30 变更溯源；特性 #9 生命周期转换审计语义（迁移作为转换被记录）。

## 范围外

- 自动迁移启发式。
- 模板到项目同步。
- 通用后台工作流自动化。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define V1 behavior: reject archival of an occupied state by default and offer an explicit migration command only when a valid destination in the same machine is supplied. |
| reject | 拒绝 | Define V1 behavior: reject archival of an occupied state by default and offer an explicit migration command only when a valid destination in the same machine is supplied. |
| archive | 归档 | Acceptance tests for unoccupied archive, occupied rejection, valid bulk migration, and invalid destinations. |
| emit | 产生/发出 | Project machine changes emit provenance atomically. |
| integrate | 集成 | Integrate Project State/transition mutations and migrations with provenance, and add complete active/historical machine views. |
| surface | 暴露/呈现 | Current and historical machine queries surface archived definitions and origin IDs correctly. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement migration transactionally, closing each active state period and opening one destination period while preserving historical rows and transition/provenance context. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| state period | 状态周期 | Implement migration transactionally, closing each active state period and opening one destination period while preserving historical rows and transition/provenance context. |
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
| Occupancy | 占用情况 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Concurrent requests require _______ controls to avoid duplicate active rows.
4. Archiving a Workflow must not invalidate historical project _______.
5. Archiving an _______ Project State should be rejected unless a migration is provided.

<details>
<summary>点击查看答案</summary>

1. provenance
2. atomically
3. concurrency
4. execution
5. occupied

</details>
