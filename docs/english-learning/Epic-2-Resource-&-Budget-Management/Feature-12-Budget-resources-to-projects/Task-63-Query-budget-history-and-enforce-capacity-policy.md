# Issue #63: Task: Query budget history and enforce capacity policy

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Budget resources to projects (#12)

---

## 1. Original English

## Outcome

Expose active and historical Project Resource budgets and deterministic capacity diagnostics from temporal relation data.

Parent Feature: #12

## Implementation plan

1. Implement query ports/use cases for the active budget by Project and Resource, all active budgets for a Project, and ended/superseded budget history.
2. Resolve temporal validity consistently (`created_at`, `ended_at`, and optional effective validity) and return canonical exact amounts and units.
3. Calculate committed active budget across Projects for a finite Resource so capacity validation can identify the proposed amount, capacity, remaining amount, and over-capacity variance.
4. Surface policy diagnostics on reads when configured rather than mutating relations or automatically rebalancing budgets.
5. Reconcile returned views to underlying relation IDs and provenance references for inspectability.

## Acceptance criteria

- [ ] The active budget for a Project/Resource is returned deterministically or reported absent.
- [ ] A Project query returns all its active Resource budgets without mixing units.
- [ ] Superseded/ended budget relations remain queryable in chronological order with their validity bounds.
- [ ] Finite Resource capacity diagnostics reconcile active Project budgets and expose capacity, committed amount, remaining amount, and variance.
- [ ] Queries surface configured over-capacity policy state without rewriting history.
- [ ] Results retain underlying relation identifiers for provenance and reconciliation.

## Tests

- Test active, ended, and as-of boundary selection across successive budget relations.
- Test multi-Project capacity totals, exact-capacity, over-capacity, missing-capacity, and unit-mismatch cases.
- Test query reconciliation back to relation records and deterministic ordering.

## Dependencies

- #61, Task: Define project budget relation contracts.
- #62, Task: Create and supersede project resource budgets.

## Out of scope

- Task allocation, consumption, forecasting, automated rebudgeting, general accounting, and billing.

---

## 2. 中文翻译

## 成果

从时态关系数据中公开活跃和历史项目资源预算，以及确定性的容量诊断信息。

父 Feature：#12

## 实施计划

1. 实现查询端口/用例：按项目和资源查询活跃预算、查询某个项目的所有活跃预算，以及查询已结束/被取代的预算历史。
2. 一致地解析时态有效性（`created_at`、`ended_at` 和可选的生效有效期），并返回规范精确金额和单位。
3. 为有限资源跨项目计算已提交的活跃预算，以便容量验证可以确定拟议金额、容量、剩余金额和超容量方差。
4. 在配置好的情况下，在读操作时暴露策略诊断信息，而不是修改关系或自动重新平衡预算。
5. 将返回的视图与底层关系 ID 和来源引用进行对账，以便审查。

## 验收标准

- [ ] 按项目/资源查询的活跃预算会确定性返回，或在不存在时报告缺失。
- [ ] 项目查询返回其所有活跃资源预算，且不混合单位。
- [ ] 被取代/已结束的预算关系仍可按时间顺序查询，并附带有效期限。
- [ ] 有限资源容量诊断会对账活跃项目预算，并暴露容量、已提交金额、剩余金额和方差。
- [ ] 查询会暴露配置的超容量策略状态，而不重写历史。
- [ ] 结果保留底层关系标识符，用于来源记录和对账。

## 测试

- 在连续预算关系之间测试活跃、已结束和截至时间点边界选择。
- 测试多项目容量总计、精确容量、超容量、缺失容量和单位不匹配情况。
- 测试查询与关系记录的对账以及确定性排序。

## 依赖

- #61，任务：定义项目预算关系契约。
- #62，任务：创建和取代项目资源预算。

## 排除范围

- 任务分配、消耗、预测、自动重新预算、通用会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| expose | 暴露、公开 | Expose active and historical budgets. |
| calculate | 计算 | Calculate committed active budget across Projects. |
| resolve | 解析 | Resolve temporal validity consistently. |
| surface | 暴露、呈现 | Surface policy diagnostics on reads. |
| reconcile | 对账、调和 | Reconcile returned views to underlying relation IDs. |
| retain | 保留 | Results retain underlying relation identifiers. |
| identify | 识别 | Identify the proposed amount, capacity, remaining amount, and variance. |
| return | 返回 | Return canonical exact amounts and units. |
| report | 报告 | Report the active budget absent. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| capacity diagnostics | 容量诊断 | deterministic capacity diagnostics |
| temporal relation data | 时态关系数据 | derive diagnostics from temporal relation data |
| query ports/use cases | 查询端口/用例 | implement query ports/use cases |
| active budget | 活跃预算 | query the active budget by Project and Resource |
| superseded budget history | 被取代的预算历史 | query ended/superseded budget history |
| temporal validity | 时态有效性 | resolve temporal validity consistently |
| effective validity | 生效有效期 | optional effective validity |
| canonical exact amounts | 规范精确金额 | return canonical exact amounts and units |
| committed active budget | 已提交的活跃预算 | calculate committed active budget across Projects |
| over-capacity variance | 超容量方差 | calculate over-capacity variance |

### 值得模仿的句式
1. **“Expose active and historical X and deterministic Y from temporal relation data.”** — “从时态关系数据中公开活跃和历史的 X 以及确定性的 Y。” — *Expose active and historical Project Resource budgets and deterministic capacity diagnostics from temporal relation data.*
2. **“Surface policy diagnostics on reads when configured rather than mutating relations or automatically rebalancing budgets.”** — “在配置好的情况下，在读操作时暴露策略诊断信息，而不是修改关系或自动重新平衡预算。” — *Surface policy diagnostics on reads when configured rather than mutating relations or automatically rebalancing budgets.*
3. **“Finite Resource capacity diagnostics reconcile active Project budgets and expose capacity, committed amount, remaining amount, and variance.”** — “有限资源容量诊断会对账活跃项目预算，并暴露容量、已提交金额、剩余金额和方差。” — *Finite Resource capacity diagnostics reconcile active Project budgets and expose capacity, committed amount, remaining amount, and variance.*

### 领域词汇
| English | 中文 |
|---|---|
| capacity diagnostic | 容量诊断 |
| temporal relation data | 时态关系数据 |
| query port | 查询端口 |
| use case | 用例 |
| temporal validity | 时态有效性 |
| committed active budget | 已提交的活跃预算 |
| finite Resource | 有限资源 |
| over-capacity variance | 超容量方差 |
| policy diagnostic | 策略诊断 |
| reconciliation | 对账 |
| relation identifier | 关系标识符 |

---

## 4. 小练习

1. We need to ______ active and historical Project Resource budgets from temporal relation data.
2. Queries should resolve temporal ______ consistently across `created_at`, `ended_at`, and optional effective validity.
3. Capacity validation needs the proposed amount, capacity, remaining amount, and ______.
4. Policy diagnostics should be surfaced on reads rather than ______ relations.
5. Results must retain underlying relation identifiers for provenance and ______.

<details>
<summary>点击查看答案</summary>

1. expose  
2. validity  
3. variance  
4. mutating  
5. reconciliation

</details>
