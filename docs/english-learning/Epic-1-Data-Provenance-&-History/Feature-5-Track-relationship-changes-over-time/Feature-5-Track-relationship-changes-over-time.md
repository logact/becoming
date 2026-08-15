# Issue #5: Feature: Track relationship changes over time

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users can inspect when a semantic relationship became active, when it ended, and who or what changed it.

## Scope

- Capture provenance when a core semantic relation is created or ended.
- Preserve temporal validity through created-at and ended-at values.
- Identify both relation endpoints and the relation type in history.
- Retain relationship metadata relevant to the change.

## Acceptance criteria

- Creating a relation emits a structured provenance Record containing source, type, target, actor, and time.
- Ending a relation preserves the original relation row and records its ended-at time.
- Ending an already-ended relation is rejected or handled idempotently according to an explicit contract.
- Relationship history is queryable from either endpoint.
- Replacing a relation is represented as ending one relation and creating another.
- Ordinary operations cannot erase ended relationship history.

## Dependencies

- Feature: Capture provenance for core entity mutations.
- Feature: Create and validate semantic relations.

## Out of scope

- Defining domain-specific relation semantics.
- Visual graph exploration.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户可以检查一个语义关系何时生效、何时结束，以及是谁或什么改变了它。

## 范围

- 在核心语义关系创建或结束时捕获来源信息。
- 通过创建时间和结束时间保留时间有效性。
- 在历史中标识关系的两个端点及关系类型。
- 保留与变更相关的关系元数据。

## 验收标准

- 创建关系会发出一个结构化的来源记录，包含来源、类型、目标、行为者和时间。
- 结束关系会保留原始关系行，并记录其结束时间。
- 对已经结束的关系再次结束，将根据显式合同被拒绝或以幂等方式处理。
- 关系历史可以从任一端点查询。
- 替换关系表示为结束一个关系并创建另一个关系。
- 普通操作不能擦除已结束的关系历史。

## 依赖

- 功能：为核心实体变更捕获来源信息。
- 功能：创建并验证语义关系。

## 范围外

- 定义领域特定的关系语义。
- 可视化图探索。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查、查看 | Users can inspect when a semantic relationship became active. |
| capture | 捕获 | Capture provenance when a core semantic relation is created or ended. |
| preserve | 保留 | Preserve temporal validity through created-at and ended-at values. |
| identify | 标识 | Identify both relation endpoints and the relation type in history. |
| retain | 保留、保持 | Retain relationship metadata relevant to the change. |
| emit | 发出、产生 | Creating a relation emits a structured provenance Record. |
| reject | 拒绝 | Ending an already-ended relation is rejected. |
| handle | 处理 | ...or handled idempotently according to an explicit contract. |
| query | 查询 | Relationship history is queryable from either endpoint. |
| erase | 擦除 | Ordinary operations cannot erase ended relationship history. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| relationship changes over time | 关系随时间的变化 | 描述关系的历史变更 |
| semantic relationship | 语义关系 | 带有业务含义的关系 |
| temporal validity | 时间有效性 | 某事物在时间段内是否有效 |
| created-at / ended-at values | 创建时间 / 结束时间值 | 时间戳字段 |
| relation endpoints | 关系端点 | 关系两端的实体 |
| provenance Record | 来源记录 | 说明来源的结构化记录 |
| idempotently according to an explicit contract | 按照显式合同以幂等方式处理 | 描述幂等性语义 |
| queryable from either endpoint | 可以从任一端点查询 | 双向查询能力 |
| replacing a relation | 替换关系 | 用一个关系替代另一个 |
| ordinary operations | 普通操作 | 常规业务操作 |

### 值得模仿的句式
1. **“Users can inspect when a semantic relationship became active, when it ended, and who or what changed it.”** — 用户可以检查语义关系何时生效、何时结束以及是谁或什么改变了它。 — 例句：Users can inspect when a task was created, when it was archived, and who changed its state.
2. **“Ending a relation preserves the original relation row and records its ended-at time.”** — 结束关系会保留原始关系行并记录其结束时间。 — 例句：Archiving a record preserves the original row and records its archived-at time.
3. **“Replacing a relation is represented as ending one relation and creating another.”** — 替换关系表示为结束一个关系并创建另一个关系。 — 例句：Updating a workflow is represented as ending the old version and creating a new one.

### 领域词汇
| English | 中文 |
|---|---|
| Semantic relationship | 语义关系 |
| Temporal validity | 时间有效性 |
| Provenance Record | 来源记录 |
| Relation endpoints | 关系端点 |
| Idempotency | 幂等性 |
| Explicit contract | 显式合同 / 显式约定 |
| Audit view | 审计视图 |
| Graph exploration | 图探索 |
| Domain-specific semantics | 领域特定语义 |
| Metadata | 元数据 |

---

## 4. 小练习

1. Users can ______ when a semantic relationship became active, when it ended, and who or what changed it.
2. We must preserve ______ validity through created-at and ended-at values.
3. Creating a relation ______ a structured provenance Record.
4. Ending an already-ended relation is rejected or handled ______ according to an explicit contract.
5. Ordinary operations cannot ______ ended relationship history.

<details>
<summary>点击查看答案</summary>

1. inspect
2. temporal
3. emits
4. idempotently
5. erase

</details>
