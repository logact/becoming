# Issue #82: Task: Specify unit-safe resource balance semantics

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Calculate resource usage and remaining balances (#15)

---

## 1. Original English

## Outcome

Define deterministic, unit-safe rules for deriving planned, consumed, and remaining Resource amounts from temporal budget/allocation relations and append-oriented usage Records.

Parent Feature: #15

## Implementation plan

1. Define canonical Project summary fields per Resource: budgeted, allocated, unallocated (`budgeted - allocated`), consumed, and remaining (`budgeted - consumed`), allowing negative results to describe exceptions rather than truncating them.
2. Define canonical Task summary fields where an allocation exists: allocated, attributed consumed, and remaining (`allocated - consumed`).
3. Specify effective-time selection for active and as-of budgets/allocations using relation validity, plus occurrence-time inclusion for usage.
4. Document correction/archival aggregation: original usage plus valid append-oriented correction effects; archived Resources/Records remain historical facts unless a domain-defined correction explicitly changes effective usage.
5. Require partitioning by Resource and canonical unit/precision, exact decimal arithmetic, deterministic rounding/scale, and trace identifiers for every contributing relation/Record.

## Acceptance criteria

- [ ] Every requested summary field has an unambiguous formula and sign convention.
- [ ] Planned relations and actual Records remain distinct inputs and outputs.
- [ ] Incompatible units are never combined; currency conversion is not implied.
- [ ] Ended relations, archived data, corrections, and time-window/as-of boundaries have documented treatment.
- [ ] Project and Task summaries retain contributor IDs for exact reconciliation.
- [ ] Rules are framework-neutral and introduce no database foreign keys, accounting, or billing model.

## Tests

- Create executable specification/table tests for formulas, zero, fractional values, negative remaining, and exact scale.
- Test temporal boundaries for ended/superseded relations and occurrence timestamps.
- Test full/partial corrections, archived facts, and incompatible-unit inputs.

## Dependencies

- Feature #13, Allocate project resources to tasks (tasks #67-#69).
- Feature #14, Record actual resource consumption (tasks #76, #78, #80).

## Out of scope

- Forecasting, currency conversion, exception presentation, accounting, and billing.

---

## 2. 中文翻译

## 成果

定义确定性的、单位安全的规则，用于从时态预算/分配关系和追加导向的使用记录中推导出计划、已消耗和剩余的资源金额。

父 Feature：#15

## 实施计划

1. 按资源定义规范的项目汇总字段：预算（budgeted）、已分配（allocated）、未分配（`budgeted - allocated`）、已消耗（consumed）和剩余（`budgeted - consumed`），允许负结果来描述异常，而不是截断它们。
2. 在存在分配时定义规范的任务汇总字段：已分配（allocated）、归属的已消耗（attributed consumed）和剩余（`allocated - consumed`）。
3. 使用关系有效性指定活跃和截至某个时间点的预算/分配的有效时间选择，以及使用发生时间包含规则。
4. 记录更正/归档聚合规则：原始使用加上有效的追加导向更正效果；归档的资源/记录保持为历史事实，除非领域定义的更正明确改变了有效使用。
5. 要求按资源和规范单位/精度进行分区，使用精确小数算术、确定性舍入/精度，并为每个贡献关系/记录提供跟踪标识符。

## 验收标准

- [ ] 每个请求的汇总字段都有明确的公式和符号约定。
- [ ] 计划关系和实际记录保持为独立的输入和输出。
- [ ] 不兼容单位永远不会被组合；不暗示货币转换。
- [ ] 已结束关系、归档数据、更正以及时间窗口/截至某个时间点的边界都有文档化的处理方式。
- [ ] 项目和任务汇总保留贡献者 ID 以进行精确对账。
- [ ] 规则与框架无关，不引入数据库外键、会计或计费模型。

## 测试

- 为公式、零值、分数值、负剩余和精确精度创建可执行规范/表驱动测试。
- 测试已结束/被取代关系和发生时间戳的时间边界。
- 测试完整/部分更正、归档事实以及不兼容单位输入。

## 依赖

- Feature #13：将项目资源分配给任务（任务 #67-#69）。
- Feature #14：记录实际资源消耗（任务 #76、#78、#80）。

## 排除范围

- 预测、货币转换、异常展示、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define deterministic, unit-safe rules. |
| derive | 推导 | Derive planned, consumed, and remaining amounts. |
| specify | 指定 | Specify effective-time selection. |
| document | 记录、文档化 | Document correction/archival aggregation. |
| allow | 允许 | Allow negative results to describe exceptions. |
| retain | 保留 | Retain contributor IDs for exact reconciliation. |
| combine | 组合 | Incompatible units are never combined. |
| imply | 暗示 | Currency conversion is not implied. |
| truncate | 截断 | Rather than truncating negative results. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| unit-safe rules | 单位安全规则 | deterministic, unit-safe rules |
| temporal budget/allocation relations | 时态预算/分配关系 | derive amounts from temporal relations |
| append-oriented usage Records | 追加导向的使用记录 | derive amounts from append-oriented usage Records |
| canonical summary fields | 规范汇总字段 | define canonical Project summary fields |
| sign convention | 符号约定 | unambiguous formula and sign convention |
| effective-time selection | 有效时间选择 | specify effective-time selection |
| relation validity | 关系有效性 | using relation validity |
| occurrence-time inclusion | 发生时间包含规则 | occurrence-time inclusion for usage |
| correction/archival aggregation | 更正/归档聚合 | document correction/archival aggregation |
| exact decimal arithmetic | 精确小数算术 | use exact decimal arithmetic |
| deterministic rounding/scale | 确定性舍入/精度 | deterministic rounding/scale |
| trace identifiers | 跟踪标识符 | trace identifiers for contributors |

### 值得模仿的句式
1. **“Define deterministic, unit-safe rules for deriving planned, consumed, and remaining Resource amounts from temporal budget/allocation relations and append-oriented usage Records.”** — “定义确定性的、单位安全的规则，用于从时态预算/分配关系和追加导向的使用记录中推导出计划、已消耗和剩余的资源金额。” — *Define deterministic, unit-safe rules for deriving planned, consumed, and remaining Resource amounts from temporal budget/allocation relations and append-oriented usage Records.*
2. **“Allow negative results to describe exceptions rather than truncating them.”** — “允许负结果来描述异常，而不是截断它们。” — *Allowing negative results to describe exceptions rather than truncating them.*
3. **“Require partitioning by Resource and canonical unit/precision, exact decimal arithmetic, deterministic rounding/scale, and trace identifiers for every contributing relation/Record.”** — “要求按资源和规范单位/精度进行分区，使用精确小数算术、确定性舍入/精度，并为每个贡献关系/记录提供跟踪标识符。” — *Require partitioning by Resource and canonical unit/precision, exact decimal arithmetic, deterministic rounding/scale, and trace identifiers for every contributing relation/Record.*

### 领域词汇
| English | 中文 |
|---|---|
| unit-safe rule | 单位安全规则 |
| temporal relation | 时态关系 |
| append-oriented record | 追加导向的记录 |
| canonical summary field | 规范汇总字段 |
| sign convention | 符号约定 |
| effective-time selection | 有效时间选择 |
| relation validity | 关系有效性 |
| occurrence-time inclusion | 发生时间包含规则 |
| correction/archival aggregation | 更正/归档聚合 |
| exact decimal arithmetic | 精确小数算术 |
| deterministic rounding | 确定性舍入 |
| trace identifier | 跟踪标识符 |

---

## 4. 小练习

1. We need to define deterministic, ______ rules for deriving planned, consumed, and remaining Resource amounts.
2. The canonical Project summary fields include budgeted, allocated, unallocated, consumed, and ______.
3. Negative results are allowed to describe ______ rather than being truncated.
4. Effective-time selection for budgets/allocations uses relation ______.
5. Every contributing relation/Record must have a ______ identifier for traceability.

<details>
<summary>点击查看答案</summary>

1. unit-safe  
2. remaining  
3. exceptions  
4. validity  
5. trace

</details>
