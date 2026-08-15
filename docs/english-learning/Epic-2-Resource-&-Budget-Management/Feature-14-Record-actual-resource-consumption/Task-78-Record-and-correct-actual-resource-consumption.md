# Issue #78: Task: Record and correct actual resource consumption

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Record actual resource consumption (#14)

---

## 1. Original English

## Outcome

Implement atomic application commands to append actual consumption and append corrections without mutating plans or prior occurrence data.

Parent Feature: #14

## Implementation plan

1. Implement record-usage using #76, Feature #6's Record repository, and the semantic relation write port.
2. Resolve and validate Project, Resource, optional Task, Task membership, exact amount/unit, occurrence time, and actor/context before commit.
3. Atomically append the usage Record and its Project/Resource/optional Task relations so partially linked usage cannot become visible.
4. Implement correction as a new correction/reversal Record and semantic link to the original, validating compatible context/unit and computing its documented aggregation effect.
5. Keep budget and allocation relation ports read-only during consumption; return deterministic validation/conflict errors and provenance identifiers.

## Acceptance criteria

- [ ] A valid usage command atomically creates a `resource_usage` Record and all required semantic links.
- [ ] Invalid Project/Resource/Task references, membership, amounts, units, or timestamps are rejected before commit.
- [ ] Correcting usage appends inspectable correction data and never overwrites the original Record.
- [ ] Duplicate/idempotent command handling cannot silently double-count a retried usage submission.
- [ ] Recording or correcting usage never writes to budget or allocation relations.
- [ ] Returned results identify the committed Record and related provenance/relations.

## Tests

- Test successful Project-only and Task-attributed commands plus every validation failure using fake ports.
- Add integration tests for atomic Record/relation writes, rollback, and idempotent retry behavior.
- Test full and partial correction/reversal flows and assert planned relation stores receive no writes.

## Dependencies

- #76, Task: Define append-oriented resource usage records.
- Features #6, #19, and #18 must provide Record, relation, and Project membership ports.

## Out of scope

- Aggregate balance and exception computation.
- Invoicing, payments, automated provider ingestion, accounting, and billing.

---

## 2. 中文翻译

## 成果

实现原子的应用命令，用于追加实际消耗和追加更正，而不修改计划或先前的发生数据。

父 Feature：#14

## 实施计划

1. 使用 #76、Feature #6 的记录仓库和语义关系写入端口实现 record-usage。
2. 在提交前解析并验证项目、资源、可选任务、任务成员关系、精确金额/单位、发生时间和执行者/上下文。
3. 原子地追加使用记录及其项目/资源/可选任务关系，以避免部分链接的使用记录变得可见。
4. 将更正实现为一个新的更正/冲销记录并建立到原始记录的语义链接，验证兼容的上下文/单位并计算其文档化的聚合效果。
5. 在消耗期间保持预算和分配关系端口只读；返回确定性的验证/冲突错误和来源标识符。

## 验收标准

- [ ] 有效的使用命令会原子地创建一个 `resource_usage` 记录和所有必需的语义链接。
- [ ] 无效的项目/资源/任务引用、成员关系、金额、单位或时间戳会在提交前被拒绝。
- [ ] 更正使用会追加可审查的更正数据，且绝不会覆盖原始记录。
- [ ] 重复/幂等命令处理不能静默地对重试的使用提交进行重复计数。
- [ ] 记录或更正使用绝不会写入预算或分配关系。
- [ ] 返回的结果标识已提交的记录和相关的来源/关系。

## 测试

- 使用模拟端口测试成功的仅项目命令和带任务归属的命令，以及每种验证失败。
- 为记录/关系写入的原子性、回滚和幂等重试行为添加集成测试。
- 测试完整和部分更正/冲销流程，并断言计划关系存储未收到写入。

## 依赖

- #76，任务：定义追加导向的资源使用记录。
- Features #6、#19 和 #18 必须提供记录、关系和项目成员关系端口。

## 排除范围

- 聚合余额和异常计算。
- 开票、付款、自动化提供方摄取、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| implement | 实现 | Implement atomic application commands. |
| append | 追加 | Append actual consumption and corrections. |
| mutate | 改变、修改 | Without mutating plans or prior data. |
| resolve | 解析 | Resolve Project, Resource, and optional Task references. |
| validate | 验证 | Validate amount/unit and occurrence time. |
| atomically append | 原子地追加 | Atomically append the usage Record and its relations. |
| overwrite | 覆盖 | Never overwrite the original Record. |
| double-count | 重复计数 | Cannot silently double-count a retried submission. |
| identify | 标识 | Returned results identify the committed Record. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| atomic application commands | 原子应用命令 | implement atomic commands |
| actual consumption | 实际消耗 | append actual consumption |
| prior occurrence data | 先前的发生数据 | without mutating prior occurrence data |
| record-usage | 记录使用 | implement record-usage |
| semantic relation write port | 语义关系写入端口 | use the semantic relation write port |
| exact amount/unit | 精确金额/单位 | validate exact amount/unit |
| occurrence time | 发生时间 | validate occurrence time |
| partially linked usage | 部分链接的使用 | prevent partially linked usage |
| correction/reversal Record | 更正/冲销记录 | create a correction/reversal Record |
| read-only ports | 只读端口 | keep relation ports read-only |
| idempotent command handling | 幂等命令处理 | duplicate/idempotent command handling |

### 值得模仿的句式
1. **“Implement atomic application commands to append actual consumption and append corrections without mutating plans or prior occurrence data.”** — “实现原子的应用命令，用于追加实际消耗和追加更正，而不修改计划或先前的发生数据。” — *Implement atomic application commands to append actual consumption and append corrections without mutating plans or prior occurrence data.*
2. **“Atomically append the usage Record and its Project/Resource/optional Task relations so partially linked usage cannot become visible.”** — “原子地追加使用记录及其项目/资源/可选任务关系，以避免部分链接的使用记录变得可见。” — *Atomically append the usage Record and its Project/Resource/optional Task relations so partially linked usage cannot become visible.*
3. **“Keep budget and allocation relation ports read-only during consumption; return deterministic validation/conflict errors and provenance identifiers.”** — “在消耗期间保持预算和分配关系端口只读；返回确定性的验证/冲突错误和来源标识符。” — *Keep budget and allocation relation ports read-only during consumption; return deterministic validation/conflict errors and provenance identifiers.*

### 领域词汇
| English | 中文 |
|---|---|
| atomic application command | 原子应用命令 |
| actual consumption | 实际消耗 |
| prior occurrence data | 先前的发生数据 |
| record-usage command | 记录使用命令 |
| semantic relation write port | 语义关系写入端口 |
| partially linked usage | 部分链接的使用 |
| correction/reversal Record | 更正/冲销记录 |
| aggregation effect | 聚合效果 |
| read-only port | 只读端口 |
| deterministic validation error | 确定性验证错误 |
| provenance identifier | 来源标识符 |
| idempotent handling | 幂等处理 |

---

## 4. 小练习

1. We implement atomic application commands to append actual consumption and append ______ without mutating plans.
2. The usage Record and its relations must be ______ appended so partially linked usage cannot become visible.
3. Correcting usage appends inspectable correction data and never ______ the original Record.
4. Budget and allocation relation ports should be kept ______ during consumption.
5. Duplicate/idempotent command handling cannot silently ______ a retried usage submission.

<details>
<summary>点击查看答案</summary>

1. corrections  
2. atomically  
3. overwrites  
4. read-only  
5. double-count

</details>
