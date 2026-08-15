# Issue #15: Feature: Calculate resource usage and remaining balances

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can see how much of each Project and Task resource allowance was planned, consumed, and remains.

## Scope

- Aggregate active Project budgets, Task allocations, and actual usage.
- Calculate consumed and remaining amounts by Project and Resource.
- Calculate Task allocation usage where Task attribution exists.
- Define treatment of ended budgets, ended allocations, corrections, and time windows.
- Return deterministic, unit-safe summaries.

## Acceptance criteria

- Project summaries expose budgeted, allocated, unallocated, consumed, and remaining amounts per Resource.
- Task summaries expose allocated, consumed, and remaining amounts where an allocation exists.
- Results never combine incompatible units.
- Corrected or archived usage follows a documented aggregation rule.
- Historical as-of queries produce results using relationships and Records valid at that time.
- Aggregate results reconcile to their underlying relation and Record data.

## Dependencies

- Feature: Allocate project resources to tasks.
- Feature: Record actual resource consumption.

## Out of scope

- Forecasting future usage.
- Currency conversion.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以查看每个项目和任务的资源限额中有多少已计划、已消耗以及剩余多少。

## 范围

- 聚合活跃项目预算、任务分配和实际使用。
- 按项目和资源计算已消耗和剩余金额。
- 在存在任务归属时计算任务分配使用情况。
- 定义对已结束预算、已结束分配、更正和时间窗口的处理方式。
- 返回确定性的、单位安全的汇总。

## 验收标准

- 项目汇总按资源暴露预算、已分配、未分配、已消耗和剩余金额。
- 任务汇总在存在分配时暴露已分配、已消耗和剩余金额。
- 结果从不组合不兼容单位。
- 已更正或归档的使用遵循文档化的聚合规则。
- 历史截至某个时间点的查询使用当时有效的关系和记录生成结果。
- 聚合结果可以与其底层关系和记录数据对账。

## 依赖

- Feature：将项目资源分配给任务。
- Feature：记录实际资源消耗。

## 排除范围

- 预测未来使用。
- 货币转换。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| see | 查看 | Users can see planned, consumed, and remaining amounts. |
| aggregate | 聚合 | Aggregate active Project budgets, Task allocations, and usage. |
| calculate | 计算 | Calculate consumed and remaining amounts. |
| define | 定义 | Define treatment of ended budgets and corrections. |
| return | 返回 | Return deterministic, unit-safe summaries. |
| expose | 暴露、公开 | Project summaries expose five amounts per Resource. |
| reconcile | 对账 | Aggregate results reconcile to underlying data. |
| follow | 遵循 | Corrected usage follows a documented aggregation rule. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| resource allowance | 资源限额 | how much of each resource allowance |
| planned, consumed, and remaining | 已计划、已消耗和剩余 | planned, consumed, and remaining amounts |
| active Project budgets | 活跃项目预算 | aggregate active Project budgets |
| Task allocations | 任务分配 | aggregate Task allocations |
| actual usage | 实际使用 | aggregate actual usage |
| consumed and remaining amounts | 已消耗和剩余金额 | calculate consumed and remaining amounts |
| Task allocation usage | 任务分配使用情况 | calculate Task allocation usage |
| unit-safe summaries | 单位安全的汇总 | return unit-safe summaries |
| budgeted/allocated/unallocated/consumed/remaining | 预算/已分配/未分配/已消耗/剩余 | Project summaries expose all five amounts |
| as-of queries | 截至某个时间点的查询 | historical as-of queries |
| aggregation rule | 聚合规则 | documented aggregation rule |

### 值得模仿的句式
1. **“Users can see how much of each Project and Task resource allowance was planned, consumed, and remains.”** — “用户可以查看每个项目和任务的资源限额中有多少已计划、已消耗以及剩余多少。” — *Users can see how much of each Project and Task resource allowance was planned, consumed, and remains.*
2. **“Project summaries expose budgeted, allocated, unallocated, consumed, and remaining amounts per Resource.”** — “项目汇总按资源暴露预算、已分配、未分配、已消耗和剩余金额。” — *Project summaries expose budgeted, allocated, unallocated, consumed, and remaining amounts per Resource.*
3. **“Historical as-of queries produce results using relationships and Records valid at that time.”** — “历史截至某个时间点的查询使用当时有效的关系和记录生成结果。” — *Historical as-of queries produce results using relationships and Records valid at that time.*

### 领域词汇
| English | 中文 |
|---|---|
| resource allowance | 资源限额 |
| Project budget | 项目预算 |
| Task allocation | 任务分配 |
| actual usage | 实际使用 |
| consumed amount | 已消耗金额 |
| remaining amount | 剩余金额 |
| unallocated amount | 未分配金额 |
| unit-safe summary | 单位安全的汇总 |
| as-of query | 截至某个时间点的查询 |
| aggregation rule | 聚合规则 |
| underlying relation | 底层关系 |

---

## 4. 小练习

1. Users can see how much of each Project and Task resource ______ was planned, consumed, and remains.
2. We must aggregate active Project budgets, Task allocations, and ______ usage.
3. Project summaries expose budgeted, allocated, unallocated, consumed, and ______ amounts per Resource.
4. Results never combine ______ units.
5. Aggregate results must ______ to their underlying relation and Record data.

<details>
<summary>点击查看答案</summary>

1. allowance  
2. actual  
3. remaining  
4. incompatible  
5. reconcile

</details>
