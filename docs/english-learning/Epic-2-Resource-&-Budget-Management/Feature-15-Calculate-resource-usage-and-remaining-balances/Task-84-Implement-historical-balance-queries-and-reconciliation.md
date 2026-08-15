# Issue #84: Task: Implement historical balance queries and reconciliation

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Calculate resource usage and remaining balances (#15)

---

## 1. Original English

## Outcome

Provide historical/as-of and time-window balance queries whose outputs can be reproduced exactly from the underlying temporal relations and Records.

Parent Feature: #15

## Implementation plan

1. Extend #83 with an explicit as-of instant and optional usage occurrence-time window, using a single documented clock/time-zone boundary convention.
2. Select only budgets and allocations valid at the as-of instant, including ended/superseded histories, while selecting usage and correction effects by occurrence-time rules from #82.
3. Expose Project and Task summary query contracts with stable Resource ordering and optional filters that do not change aggregation semantics.
4. Include an audit/reconciliation breakdown or trace token mapping each output to its exact relation and Record contributors.
5. Add a cross-check path in tests that independently folds raw source data and compares every aggregate field.

## Acceptance criteria

- [ ] Historical as-of results use the budget/allocation relationships valid at the requested instant.
- [ ] Usage windows and correction/archival rules are applied consistently and documented in responses/contracts.
- [ ] Current queries are equivalent to as-of queries evaluated at the same effective instant.
- [ ] Historical results remain available after budgets, allocations, Resources, or Records are ended/archived.
- [ ] Stable exact outputs never mix incompatible units.
- [ ] Every aggregate reconciles exactly to underlying relation and Record data.

## Tests

- Test instants immediately before, at, and after relation start/end and usage occurrence boundaries.
- Test historical correction visibility and archived related entities.
- Add property/fixture-based reconciliation tests comparing aggregate fields with independently folded source rows.

## Dependencies

- #82, Task: Specify unit-safe resource balance semantics.
- #83, Task: Calculate project and task resource balances.

## Out of scope

- Forecasting future usage, currency conversion, materiality thresholds, automated remediation, accounting, and billing.

---

## 2. 中文翻译

## 成果

提供历史/截至某个时间点和时间窗口的余额查询，其输出可以精确地从底层时态关系和记录中重现。

父 Feature：#15

## 实施计划

1. 扩展 #83，增加显式的截至某个时间点时刻和可选的使用发生时间窗口，使用单一文档化的时钟/时区边界约定。
2. 仅选择在截至某个时间点时刻有效的预算和分配，包括已结束/被取代的历史，同时按照 #82 的发生时间规则选择使用和更正效果。
3. 公开项目和任务汇总查询契约，包含稳定的资源排序以及不改变聚合语义的可选过滤器。
4. 包含审计/对账明细或跟踪令牌，将每个输出映射到其精确的关系和记录贡献者。
5. 在测试中添加交叉检查路径，独立折叠原始源数据并比较每个聚合字段。

## 验收标准

- [ ] 历史截至某个时间点结果使用在请求时刻有效的预算/分配关系。
- [ ] 使用窗口和更正/归档规则被一致地应用，并在响应/契约中记录。
- [ ] 当前查询等同于在相同有效时刻评估的截至某个时间点查询。
- [ ] 在预算、分配、资源或记录结束/归档后，历史结果仍然可用。
- [ ] 稳定的精确输出从不混合不兼容单位。
- [ ] 每个聚合都精确地与底层关系和记录数据对账。

## 测试

- 在关系开始/结束和使用发生边界之前、之时和之后立即测试时刻。
- 测试历史更正可见性和归档的相关实体。
- 添加基于属性/固件的 reconciliation 测试，将聚合字段与独立折叠的源行进行比较。

## 依赖

- #82，任务：指定单位安全的资源余额语义。
- #83，任务：计算项目和任务资源余额。

## 排除范围

- 预测未来使用、货币转换、重要性阈值、自动修复、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| provide | 提供 | Provide historical/as-of and time-window balance queries. |
| extend | 扩展 | Extend #83 with an explicit as-of instant. |
| select | 选择 | Select budgets valid at the as-of instant. |
| expose | 暴露、公开 | Expose Project and Task summary query contracts. |
| include | 包含 | Include an audit/reconciliation breakdown. |
| map | 映射 | Map each output to its exact contributors. |
| add | 添加 | Add a cross-check path in tests. |
| fold | 折叠 | Independently fold raw source data. |
| reproduce | 重现 | Outputs can be reproduced exactly from source data. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| historical/as-of queries | 历史/截至某个时间点的查询 | provide historical/as-of queries |
| time-window queries | 时间窗口查询 | time-window balance queries |
| as-of instant | 截至某个时间点的时刻 | explicit as-of instant |
| occurrence-time window | 发生时间窗口 | optional usage occurrence-time window |
| clock/time-zone boundary convention | 时钟/时区边界约定 | documented clock/time-zone boundary convention |
| ended/superseded histories | 已结束/被取代的历史 | including ended/superseded histories |
| stable Resource ordering | 稳定的资源排序 | stable Resource ordering |
| aggregation semantics | 聚合语义 | filters that do not change aggregation semantics |
| audit/reconciliation breakdown | 审计/对账明细 | include an audit/reconciliation breakdown |
| trace token | 跟踪令牌 | trace token mapping output to contributors |
| cross-check path | 交叉检查路径 | add a cross-check path in tests |

### 值得模仿的句式
1. **“Provide historical/as-of and time-window balance queries whose outputs can be reproduced exactly from the underlying temporal relations and Records.”** — “提供历史/截至某个时间点和时间窗口的余额查询，其输出可以精确地从底层时态关系和记录中重现。” — *Provide historical/as-of and time-window balance queries whose outputs can be reproduced exactly from the underlying temporal relations and Records.*
2. **“Current queries are equivalent to as-of queries evaluated at the same effective instant.”** — “当前查询等同于在相同有效时刻评估的截至某个时间点查询。” — *Current queries are equivalent to as-of queries evaluated at the same effective instant.*
3. **“Every aggregate reconciles exactly to underlying relation and Record data.”** — “每个聚合都精确地与底层关系和记录数据对账。” — *Every aggregate reconciles exactly to underlying relation and Record data.*

### 领域词汇
| English | 中文 |
|---|---|
| historical/as-of query | 历史/截至某个时间点的查询 |
| time-window query | 时间窗口查询 |
| as-of instant | 截至某个时间点的时刻 |
| occurrence-time window | 发生时间窗口 |
| clock/time-zone boundary | 时钟/时区边界 |
| stable ordering | 稳定排序 |
| aggregation semantics | 聚合语义 |
| audit/reconciliation breakdown | 审计/对账明细 |
| trace token | 跟踪令牌 |
| cross-check path | 交叉检查路径 |
| independently folded source data | 独立折叠的源数据 |

---

## 4. 小练习

1. We provide historical/as-of and time-window balance queries whose outputs can be ______ exactly from underlying temporal relations and Records.
2. We extend #83 with an explicit as-of ______ and optional usage occurrence-time window.
3. Budgets and allocations valid at the as-of instant are selected, including ended/______ histories.
4. Each output is mapped to its exact contributors via an audit/reconciliation breakdown or ______ token.
5. A cross-check path in tests independently ______ raw source data and compares aggregate fields.

<details>
<summary>点击查看答案</summary>

1. reproduced  
2. instant  
3. superseded  
4. trace  
5. folds

</details>
