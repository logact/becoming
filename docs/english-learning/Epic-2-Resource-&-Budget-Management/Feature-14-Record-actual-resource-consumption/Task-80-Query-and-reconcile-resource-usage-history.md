# Issue #80: Task: Query and reconcile resource usage history

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Record actual resource consumption (#14)

---

## 1. Original English

## Outcome

Expose deterministic, reconcilable actual-usage history by Project, Task, Resource, and occurrence-time window with documented correction treatment.

Parent Feature: #14

## Implementation plan

1. Implement a usage query/read-model port joining `resource_usage` Records to their semantic Project, Resource, optional Task, and correction relations through logical IDs.
2. Support filters for Project, optional Task, Resource, inclusive/exclusive occurrence-time bounds, and stable pagination/order.
3. Apply the correction/reversal rule from #76 to return original facts, correction trail, and effective exact amount without deleting or updating occurrence history.
4. Reject or surface integrity errors for missing logical references, incompatible units, or malformed relation sets rather than relying on database foreign keys.
5. Return underlying Record and relation identifiers so later aggregates can reconcile every total.

## Acceptance criteria

- [ ] Usage is queryable by Project, Task, Resource, and time window in deterministic order.
- [ ] Project-only usage and Task-attributed usage are distinguished without excluding either from Project totals.
- [ ] Corrected usage exposes the original, correction trail, and documented effective amount.
- [ ] Query results preserve exact decimal values and never combine incompatible units.
- [ ] Historical entries remain inspectable even if related catalog entities are later archived.
- [ ] Every result is reconcilable to Record and relation identifiers.

## Tests

- Test each filter alone and in combination, empty results, pagination/order, and occurrence-time boundaries.
- Test original/partial/full correction histories and effective-amount reconciliation.
- Test archived related entities, malformed logical relation sets, and incompatible-unit integrity failures.

## Dependencies

- #76, Task: Define append-oriented resource usage records.
- #78, Task: Record and correct actual resource consumption.

## Out of scope

- Project/Task balance summaries, forecasting, invoicing, payments, provider ingestion, accounting, and billing.

---

## 2. 中文翻译

## 成果

按项目、任务、资源和发生时间窗口公开确定性的、可对账的实际使用历史，并附带文档化的更正处理方式。

父 Feature：#14

## 实施计划

1. 实现一个使用查询/只读模型端口，通过逻辑 ID 将 `resource_usage` 记录与其语义项目、资源、可选任务和更正关系连接起来。
2. 支持按项目、可选任务、资源、包含/排除发生时间边界以及稳定分页/排序进行过滤。
3. 应用 #76 的更正/冲销规则，返回原始事实、更正轨迹和有效精确金额，而不删除或更新发生历史。
4. 对于缺失的逻辑引用、不兼容单位或畸形关系集，拒绝或暴露完整性错误，而不是依赖数据库外键。
5. 返回底层记录和关系标识符，以便后续聚合可以对每个总额进行对账。

## 验收标准

- [ ] 使用记录可以按项目、任务、资源和时间窗口以确定性顺序查询。
- [ ] 仅项目使用和带任务归属的使用会被区分，但两者都不会被排除在项目总计之外。
- [ ] 已更正的使用暴露原始记录、更正轨迹和文档化的有效金额。
- [ ] 查询结果保留精确小数值，且从不组合不兼容单位。
- [ ] 即使相关目录实体后来被归档，历史条目仍保持可审查。
- [ ] 每个结果都可以与记录和关系标识符对账。

## 测试

- 单独和组合测试每个过滤器、空结果、分页/排序以及发生时间边界。
- 测试原始/部分/完整更正历史以及有效金额对账。
- 测试归档的相关实体、畸形逻辑关系集以及不兼容单位的完整性失败。

## 依赖

- #76，任务：定义追加导向的资源使用记录。
- #78，任务：记录和更正实际资源消耗。

## 排除范围

- 项目/任务余额汇总、预测、开票、付款、提供方摄取、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| expose | 暴露、公开 | Expose deterministic, reconcilable actual-usage history. |
| join | 连接 | Join Records to their semantic relations. |
| support | 支持 | Support filters for Project, Task, Resource, and time bounds. |
| apply | 应用 | Apply the correction/reversal rule. |
| reject | 拒绝 | Reject integrity errors. |
| surface | 暴露、呈现 | Surface integrity errors rather than relying on foreign keys. |
| preserve | 保留 | Preserve exact decimal values. |
| distinguish | 区分 | Distinguish Project-only and Task-attributed usage. |
| reconcile | 对账 | Reconcile every total to identifiers. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| actual-usage history | 实际使用历史 | query actual-usage history |
| occurrence-time window | 发生时间窗口 | filter by occurrence-time window |
| documented correction treatment | 文档化的更正处理方式 | with documented correction treatment |
| query/read-model port | 查询/只读模型端口 | implement a query/read-model port |
| semantic relations | 语义关系 | join to semantic Project/Resource/Task relations |
| occurrence-time bounds | 发生时间边界 | inclusive/exclusive occurrence-time bounds |
| stable pagination/order | 稳定的分页/排序 | stable pagination/order |
| correction/reversal rule | 更正/冲销规则 | apply the correction/reversal rule |
| correction trail | 更正轨迹 | return the correction trail |
| effective exact amount | 有效精确金额 | return the effective exact amount |
| malformed relation sets | 畸形关系集 | malformed logical relation sets |

### 值得模仿的句式
1. **“Expose deterministic, reconcilable actual-usage history by Project, Task, Resource, and occurrence-time window with documented correction treatment.”** — “按项目、任务、资源和发生时间窗口公开确定性的、可对账的实际使用历史，并附带文档化的更正处理方式。” — *Expose deterministic, reconcilable actual-usage history by Project, Task, Resource, and occurrence-time window with documented correction treatment.*
2. **“Apply the correction/reversal rule from #76 to return original facts, correction trail, and effective exact amount without deleting or updating occurrence history.”** — “应用 #76 的更正/冲销规则，返回原始事实、更正轨迹和有效精确金额，而不删除或更新发生历史。” — *Apply the correction/reversal rule from #76 to return original facts, correction trail, and effective exact amount without deleting or updating occurrence history.*
3. **“Reject or surface integrity errors for missing logical references, incompatible units, or malformed relation sets rather than relying on database foreign keys.”** — “对于缺失的逻辑引用、不兼容单位或畸形关系集，拒绝或暴露完整性错误，而不是依赖数据库外键。” — *Reject or surface integrity errors for missing logical references, incompatible units, or malformed relation sets rather than relying on database foreign keys.*

### 领域词汇
| English | 中文 |
|---|---|
| actual-usage history | 实际使用历史 |
| query/read-model port | 查询/只读模型端口 |
| occurrence-time window | 发生时间窗口 |
| occurrence-time bounds | 发生时间边界 |
| stable pagination | 稳定的分页 |
| correction/reversal rule | 更正/冲销规则 |
| effective exact amount | 有效精确金额 |
| correction trail | 更正轨迹 |
| integrity error | 完整性错误 |
| malformed relation set | 畸形关系集 |
| reconcilable result | 可对账的结果 |

---

## 4. 小练习

1. We need to expose deterministic, ______ actual-usage history by Project, Task, Resource, and occurrence-time window.
2. The query port joins `resource_usage` Records to their semantic Project, Resource, optional Task, and ______ relations.
3. Filters support inclusive/exclusive occurrence-time ______ and stable pagination/order.
4. Corrected usage exposes the original, correction trail, and documented ______ amount.
5. Every result is reconcilable to Record and relation ______.

<details>
<summary>点击查看答案</summary>

1. reconcilable  
2. correction  
3. bounds  
4. effective  
5. identifiers

</details>
