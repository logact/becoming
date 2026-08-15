# Issue #99: Task: Query active and resolved resource exceptions

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Surface planned versus actual resource exceptions (#16)

---

## 1. Original English

## Outcome

Expose query interfaces for active exceptions and resolved historical exceptions by evaluating reproducible balance snapshots rather than rewriting source history.

Parent Feature: #16

## Implementation plan

1. Implement current exception queries with filters for Project, Resource, exception type, optional Task, and active-only as the default.
2. Implement historical/as-of evaluation using Feature #15's temporal balance query and #98; determine resolution by comparing stable exception identities across ordered snapshots or documented validity boundaries.
3. Support `include_resolved` with detected/evaluated/resolved timestamps (or derivable interval bounds), final supporting amounts, and source trace identifiers.
4. Return stable pagination/order and retain separate Resource/unit partitions throughout.
5. Add reconciliation diagnostics linking every active or resolved exception to the exact balance snapshot, relations, and Records that produced it.

## Acceptance criteria

- [ ] Consumers can query active exceptions only by default or explicitly include resolved historical exceptions.
- [ ] Queries support Project, Resource, exception type, and optional Task context filters.
- [ ] Resolved results have deterministic historical validity/resolution semantics and supporting amounts.
- [ ] Exactly-zero boundary behavior remains consistent in current and historical queries.
- [ ] Results remain unit-safe and include planned amount, actual/comparison amount, variance, unit, and affected context.
- [ ] Every exception reconciles to a Feature #15 snapshot and underlying relation/Record trace.

## Tests

- Test active-only versus include-resolved, all filters, stable ordering, pagination, and empty results.
- Test exception appearance/resolution across budget, allocation, usage, and correction timeline boundaries.
- Test exact-zero transitions, multiple simultaneous exception types, archived source entities, and trace reconciliation.

## Dependencies

- #97, Task: Define planned-versus-actual exception semantics.
- #98, Task: Derive project and task resource exceptions.
- Feature #15 historical/as-of balance queries.

## Out of scope

- Automated remediation/reallocation, notifications, forecasting, persisted incident workflow, general financial reporting, accounting, and billing.

---

## 2. 中文翻译

## 成果

通过评估可重现的余额快照（而不是重写源历史），为活跃异常和已解决的历史异常公开查询接口。

父 Feature：#16

## 实施计划

1. 实现当前异常查询，支持按项目、资源、异常类型、可选任务过滤，并默认仅返回活跃异常。
2. 使用 Feature #15 的时态余额查询和 #98 实现历史/截至某个时间点的评估；通过比较有序快照或文档化有效边界之间的稳定异常标识来确定解决状态。
3. 支持 `include_resolved`，包含检测到/评估/解决的时间戳（或可推导的区间边界）、最终支持金额和源跟踪标识符。
4. 返回稳定的分页/排序，并在整个过程中保持独立的资源/单位分区。
5. 添加对账诊断，将每个活跃或已解决的异常链接到产生它的精确余额快照、关系和记录。

## 验收标准

- [ ] 消费者默认只能查询活跃异常，或显式包含已解决的历史异常。
- [ ] 查询支持项目、资源、异常类型和可选任务上下文过滤器。
- [ ] 已解决结果具有确定性的历史有效性/解决语义和支持金额。
- [ ] 精确零值边界行为在当前和历史查询中保持一致。
- [ ] 结果保持单位安全，并包含计划金额、实际/比较金额、方差、单位和受影响的上下文。
- [ ] 每个异常都与 Feature #15 快照以及底层关系/记录跟踪对账。

## 测试

- 测试仅活跃与包含已解决、所有过滤器、稳定排序、分页和空结果。
- 测试异常在预算、分配、使用和更正时间线边界上的出现/解决。
- 测试精确零值转换、多种同时存在的异常类型、归档源实体和跟踪对账。

## 依赖

- #97，任务：定义计划与实际异常语义。
- #98，任务：推导项目和任务资源异常。
- Feature #15 历史/截至某个时间点余额查询。

## 排除范围

- 自动修复/重新分配、通知、预测、持久化事件工作流、通用财务报告、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| expose | 暴露、公开 | Expose query interfaces for exceptions. |
| evaluate | 评估 | Evaluate reproducible balance snapshots. |
| implement | 实现 | Implement current exception queries. |
| determine | 确定 | Determine resolution by comparing identities. |
| support | 支持 | Support `include_resolved` with timestamps. |
| retain | 保持 | Retain separate Resource/unit partitions. |
| link | 链接 | Link every exception to its snapshot and relations. |
| reconcile | 对账 | Every exception reconciles to a snapshot and trace. |
| include | 包含 | Consumers can include resolved historical exceptions. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| active exceptions | 活跃异常 | query active exceptions |
| resolved historical exceptions | 已解决的历史异常 | include resolved historical exceptions |
| reproducible balance snapshots | 可重现的余额快照 | evaluate reproducible balance snapshots |
| source history | 源历史 | rather than rewriting source history |
| active-only default | 默认仅活跃 | active-only as the default |
| temporal balance query | 时态余额查询 | Feature #15's temporal balance query |
| stable exception identities | 稳定的异常标识 | compare stable exception identities |
| ordered snapshots | 有序快照 | across ordered snapshots |
| validity boundaries | 有效边界 | documented validity boundaries |
| interval bounds | 区间边界 | derivable interval bounds |
| reconciliation diagnostics | 对账诊断 | add reconciliation diagnostics |

### 值得模仿的句式
1. **“Expose query interfaces for active exceptions and resolved historical exceptions by evaluating reproducible balance snapshots rather than rewriting source history.”** — “通过评估可重现的余额快照（而不是重写源历史），为活跃异常和已解决的历史异常公开查询接口。” — *Expose query interfaces for active exceptions and resolved historical exceptions by evaluating reproducible balance snapshots rather than rewriting source history.*
2. **“Implement historical/as-of evaluation using Feature #15's temporal balance query and #98; determine resolution by comparing stable exception identities across ordered snapshots or documented validity boundaries.”** — “使用 Feature #15 的时态余额查询和 #98 实现历史/截至某个时间点的评估；通过比较有序快照或文档化有效边界之间的稳定异常标识来确定解决状态。” — *Implement historical/as-of evaluation using Feature #15's temporal balance query and #98; determine resolution by comparing stable exception identities across ordered snapshots or documented validity boundaries.*
3. **“Every exception reconciles to a Feature #15 snapshot and underlying relation/Record trace.”** — “每个异常都与 Feature #15 快照以及底层关系/记录跟踪对账。” — *Every exception reconciles to a Feature #15 snapshot and underlying relation/Record trace.*

### 领域词汇
| English | 中文 |
|---|---|
| active exception | 活跃异常 |
| resolved historical exception | 已解决的历史异常 |
| reproducible balance snapshot | 可重现的余额快照 |
| temporal balance query | 时态余额查询 |
| stable exception identity | 稳定的异常标识 |
| ordered snapshot | 有序快照 |
| validity boundary | 有效边界 |
| include_resolved | 包含已解决 |
| interval bound | 区间边界 |
| source trace identifier | 源跟踪标识符 |
| reconciliation diagnostic | 对账诊断 |

---

## 4. 小练习

1. We expose query interfaces for active exceptions and ______ historical exceptions by evaluating reproducible balance snapshots.
2. Current exception queries default to ______ only.
3. Historical/as-of evaluation uses Feature #15's temporal ______ query.
4. Resolution is determined by comparing stable exception identities across ordered ______ or documented validity boundaries.
5. Every exception reconciles to a Feature #15 snapshot and underlying relation/Record ______.

<details>
<summary>点击查看答案</summary>

1. resolved  
2. active  
3. balance  
4. snapshots  
5. trace

</details>
