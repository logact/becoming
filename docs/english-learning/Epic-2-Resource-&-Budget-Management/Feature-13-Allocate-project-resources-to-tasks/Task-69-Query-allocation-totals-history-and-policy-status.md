# Issue #69: Task: Query allocation totals history and policy status

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Allocate project resources to tasks (#13)

---

## 1. Original English

## Outcome

Expose active allocation totals and historically inspectable Task allocation plans, including deterministic over-allocation policy status.

Parent Feature: #13

## Implementation plan

1. Implement queries for a Task's active allocations, a Project/Resource's active allocations, and a Task/Project/Resource allocation history.
2. Sum only active compatible-unit allocations with exact decimal arithmetic and return contributing relation identifiers.
3. Resolve temporal as-of allocation views using relation validity, including ended and superseded plans.
4. Compare active allocation totals with the active Project budget and return budget, allocated total, variance, unit, and reject/flag policy status.
5. Keep flagged status informational and derived; do not rewrite allocation or budget relations.

## Acceptance criteria

- [ ] Total active allocation is calculable per Project and Resource with exact arithmetic.
- [ ] A Task query returns all explicit active Resource allocations with their funding Project context.
- [ ] Incompatible units are never combined and produce a deterministic integrity error if encountered.
- [ ] Allocation changes and ended plans are inspectable in chronological/as-of queries.
- [ ] Over-allocation results expose budget, allocation total, variance, unit, and explicit policy status.
- [ ] Every aggregate can be reconciled to its contributing relation IDs.

## Tests

- Test multi-Task/multi-Resource totals, empty allocations, and exact-budget boundaries.
- Test temporal selection before, at, and after supersession/end boundaries.
- Test unit mismatch handling, deterministic ordering, flagged status, and relation-level reconciliation.

## Dependencies

- #67, Task: Define project-funded task allocation contracts.
- #68, Task: Create and supersede task resource allocations.
- Feature #12's active and historical budget queries.

## Out of scope

- Consumption, forecasting, scheduling, automated redistribution, accounting, and billing.

---

## 2. 中文翻译

## 成果

公开活跃分配总额以及可按历史审查的任务分配计划，包括确定性的超额分配策略状态。

父 Feature：#13

## 实施计划

1. 实现查询：查询任务的活跃分配、项目/资源的活跃分配，以及任务/项目/资源的分配历史。
2. 仅对活跃且单位兼容的分配使用精确小数算术求和，并返回贡献的关系标识符。
3. 使用关系有效性解析截至某个时间点的分配视图，包括已结束和被取代的计划。
4. 将活跃分配总额与活跃项目预算进行比较，并返回预算、已分配总额、方差、单位以及 reject/flag 策略状态。
5. 将标记状态保持为信息性和派生状态；不重写分配或预算关系。

## 验收标准

- [ ] 可以使用精确算术按项目和资源计算总活跃分配。
- [ ] 任务查询返回其所有带资金项目上下文的明确活跃资源分配。
- [ ] 不兼容单位永远不会被合并；如果遇到，则产生确定性的完整性错误。
- [ ] 分配变更和已结束计划可以在按时间顺序/截至某个时间点的查询中进行审查。
- [ ] 超额分配结果暴露预算、分配总额、方差、单位和明确的策略状态。
- [ ] 每个聚合都可以与其贡献的关系 ID 对账。

## 测试

- 测试多任务/多资源总计、空分配以及精确预算边界。
- 测试取代/结束边界之前、之时和之后的时间点选择。
- 测试单位不匹配处理、确定性排序、标记状态以及关系级对账。

## 依赖

- #67，任务：定义项目资助的任务分配契约。
- #68，任务：创建和取代任务资源分配。
- Feature #12 的活跃和历史预算查询。

## 排除范围

- 消耗、预测、调度、自动重新分配、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| expose | 暴露、公开 | Expose active allocation totals. |
| sum | 求和 | Sum active compatible-unit allocations. |
| resolve | 解析 | Resolve temporal as-of allocation views. |
| compare | 比较 | Compare active allocation totals with the active Project budget. |
| return | 返回 | Return budget, allocated total, variance, and status. |
| keep | 保持 | Keep flagged status informational and derived. |
| reconcile | 对账 | Reconcile every aggregate to its contributing relation IDs. |
| encounter | 遇到 | Produce an error if incompatible units are encountered. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| active allocation totals | 活跃分配总额 | expose active allocation totals |
| historically inspectable plans | 可按历史审查的计划 | historically inspectable Task allocation plans |
| deterministic policy status | 确定性策略状态 | deterministic over-allocation policy status |
| exact decimal arithmetic | 精确小数算术 | sum with exact decimal arithmetic |
| contributing relation identifiers | 贡献的关系标识符 | return contributing relation identifiers |
| temporal as-of views | 截至某个时间点的时态视图 | resolve temporal as-of allocation views |
| ended and superseded plans | 已结束和被取代的计划 | include ended and superseded plans |
| allocated total | 已分配总额 | return the allocated total |
| reject/flag policy status | reject/flag 策略状态 | return policy status |
| informational and derived | 信息性和派生的 | keep status informational and derived |

### 值得模仿的句式
1. **“Expose active allocation totals and historically inspectable Task allocation plans, including deterministic over-allocation policy status.”** — “公开活跃分配总额以及可按历史审查的任务分配计划，包括确定性的超额分配策略状态。” — *Expose active allocation totals and historically inspectable Task allocation plans, including deterministic over-allocation policy status.*
2. **“Keep flagged status informational and derived; do not rewrite allocation or budget relations.”** — “将标记状态保持为信息性和派生状态；不重写分配或预算关系。” — *Keep flagged status informational and derived; do not rewrite allocation or budget relations.*
3. **“Every aggregate can be reconciled to its contributing relation IDs.”** — “每个聚合都可以与其贡献的关系 ID 对账。” — *Every aggregate can be reconciled to its contributing relation IDs.*

### 领域词汇
| English | 中文 |
|---|---|
| allocation total | 分配总额 |
| historically inspectable plan | 可按历史审查的计划 |
| over-allocation policy status | 超额分配策略状态 |
| exact decimal arithmetic | 精确小数算术 |
| contributing relation identifier | 贡献的关系标识符 |
| temporal as-of view | 截至某个时间点的时态视图 |
| variance | 方差/差额 |
| policy status | 策略状态 |
| derived status | 派生状态 |
| aggregate reconciliation | 聚合对账 |

---

## 4. 小练习

1. We need to expose active allocation totals and historically ______ Task allocation plans.
2. Active compatible-unit allocations should be summed with exact ______ arithmetic.
3. Temporal as-of allocation views are resolved using relation ______.
4. The query compares active allocation totals with the active Project ______.
5. Every aggregate can be ______ to its contributing relation IDs.

<details>
<summary>点击查看答案</summary>

1. inspectable  
2. decimal  
3. validity  
4. budget  
5. reconciled

</details>
