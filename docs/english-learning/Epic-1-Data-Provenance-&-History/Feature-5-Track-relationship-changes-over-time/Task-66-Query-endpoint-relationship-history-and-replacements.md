# Issue #66: Task: Query endpoint relationship history and replacements

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Track relationship changes over time (#5)

---

## 1. Original English

Parent Feature: #5 — Feature: Track relationship changes over time

## Outcome

A consumer can inspect active and ended relationship history from either endpoint and observe a replacement as an ended relation plus a newly created relation.

## Implementation plan

1. Add relation-history application queries by source or target endpoint with filters for relation type, active/historical status, and time window, using deterministic ordering.
2. Resolve and expose the matching relation-change Records for each returned relation without embedding provenance columns in the core relation row.
3. Implement the replacement command as the contractually atomic composition of end-old and create-new, preserving both rows and appending both change Records.
4. Define stable result shapes and explicit errors for unknown endpoints and invalid filters independently of any HTTP or UI framework.

## Acceptance criteria

- [ ] Relationship history is queryable from either the source or target endpoint.
- [ ] Results preserve source/type/target direction and expose `created_at`, `ended_at`, relevant metadata, and matching audit references.
- [ ] Active status, relation type, and time-window filters can be combined with deterministic ordering.
- [ ] Replacing a relation atomically ends one row, creates another, and emits exactly one end and one create Record.
- [ ] Ended relationships remain visible and cannot be erased by ordinary operations.
- [ ] Unknown endpoints and invalid filters return explicit application/domain errors.

## Tests

- Repository contract-test source/target queries, combined filters, deterministic ordering, and ended-row visibility.
- Integration-test successful replacement and rollback on failures at each end/create/provenance step.
- Test replacement results from both old and new endpoints and assert the two audit entries.

## Dependencies

- Parent Feature #5.
- Task: Audit relation creation and ending atomically.
- Feature #19's active and historical relation query primitives.

## Out of scope

- Generic entity timeline aggregation (Feature #10).
- Arbitrary-depth traversal or visual graph exploration.
- Authorization-policy design.

---

## 2. 中文翻译

父功能：#5 — 功能：跟踪关系随时间的变化

## 成果

消费者可以从任一端点检查活动和已结束的关系历史，并将替换观察为一个已结束的关系加上一个新创建的关系。

## 实施计划

1. 添加按来源或目标端点查询关系历史的应用查询，支持按关系类型、活动/历史状态和时间窗口过滤，使用确定性排序。
2. 为返回的每条关系解析并暴露匹配的关系变更记录，而不将来源列嵌入核心关系行中。
3. 将替换命令实现为合同约定的原子组合：结束旧关系并创建新关系，保留两行并追加两条变更记录。
4. 为未知端点和无效过滤器定义稳定的结果形状和显式错误，独立于任何 HTTP 或 UI 框架。

## 验收标准

- [ ] 关系历史可以从来源或目标端点查询。
- [ ] 结果保留来源/类型/目标方向，并暴露 `created_at`、`ended_at`、相关元数据和匹配审计引用。
- [ ] 活动状态、关系类型和时间窗口过滤器可以组合，并带有确定性排序。
- [ ] 替换关系会原子性地结束一行、创建另一行，并发出一条结束和一条创建记录。
- [ ] 已结束的关系保持可见，无法通过普通操作擦除。
- [ ] 未知端点和无效过滤器返回显式的应用/领域错误。

## 测试

- 仓库合同测试来源/目标查询、组合过滤器、确定性排序和已结束行可见性。
- 对成功的替换以及在结束/创建/来源每一步失败时的回滚进行集成测试。
- 从旧端点和新端点测试替换结果，并断言两条审计条目。

## 依赖

- 父功能 #5。
- 任务：原子性地审计关系创建和结束。
- 功能 #19 的活动和历史关系查询原语。

## 范围外

- 通用实体时间线聚合（功能 #10）。
- 任意深度遍历或可视化图探索。
- 授权策略设计。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查 | A consumer can inspect active and ended relationship history. |
| resolve | 解析 | Resolve and expose the matching relation-change Records. |
| expose | 暴露、公开 | Expose the matching relation-change Records for each returned relation. |
| implement | 实现 | Implement the replacement command as the contractually atomic composition. |
| preserve | 保留 | ...preserving both rows and appending both change Records. |
| combine | 组合 | Active status, relation type, and time-window filters can be combined. |
| return | 返回 | Unknown endpoints and invalid filters return explicit errors. |
| remain | 保持 | Ended relationships remain visible. |
| erase | 擦除 | ...cannot be erased by ordinary operations. |
| observe | 观察 | ...observe a replacement as an ended relation plus a newly created relation. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| endpoint relationship history | 端点关系历史 | 从某个端点出发的关系变更历史 |
| active/historical status | 活动/历史状态 | 关系当前是否有效或已成为历史 |
| time window | 时间窗口 | 查询的时间范围 |
| deterministic ordering | 确定性排序 | 稳定、可重复的排序方式 |
| relation-change Records | 关系变更记录 | 关系创建/结束的来源记录 |
| core relation row | 核心关系行 | `relations` 表中的记录 |
| atomic composition | 原子组合 | 不可分割的组合操作 |
| stable result shapes | 稳定的结果形状 | 一致的返回结构 |
| explicit errors | 显式错误 | 明确返回的错误信息 |
| archive visibility | 归档可见性 | 归档数据是否可见 |

### 值得模仿的句式
1. **“A consumer can inspect active and ended relationship history from either endpoint...”** — 消费者可以从任一端点检查活动和已结束的关系历史... — 例句：A consumer can inspect active and ended tasks from either project view.
2. **“...without embedding provenance columns in the core relation row.”** — ...而不将来源列嵌入核心关系行中。 — 例句：Keep audit data separate without embedding audit columns in the core table.
3. **“Replacing a relation atomically ends one row, creates another, and emits exactly one end and one create Record.”** — 替换关系会原子性地结束一行、创建另一行，并发出一条结束和一条创建记录。 — 例句：Replacing a budget atomically ends one allocation and creates another.

### 领域词汇
| English | 中文 |
|---|---|
| Endpoint | 端点 |
| Relationship history | 关系历史 |
| Deterministic ordering | 确定性排序 |
| Relation-change Record | 关系变更记录 |
| Atomic composition | 原子组合 |
| Archive visibility | 归档可见性 |
| Source/target | 来源/目标 |
| Time window | 时间窗口 |
| Result shape | 结果形状 |
| Authorization policy | 授权策略 |

---

## 4. 小练习

1. A consumer can inspect active and ended relationship history from either ______.
2. Resolve and ______ the matching relation-change Records for each returned relation.
3. Active status, relation type, and time-window filters can be combined with ______ ordering.
4. Replacing a relation ______ ends one row, creates another, and emits exactly one end and one create Record.
5. Ended relationships remain visible and cannot be ______ by ordinary operations.

<details>
<summary>点击查看答案</summary>

1. endpoint
2. expose
3. deterministic
4. atomically
5. erased

</details>
