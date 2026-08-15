# Issue #19: Feature: Create and validate semantic relations

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users and domain capabilities can connect core concepts through explicit, inspectable, time-bounded relationships.

## Scope

- Create, read, end, and query relations among Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record.
- Validate logical endpoint references without database foreign keys.
- Validate supported relation types, direction, cardinality, and metadata through domain policies.
- Expose active and historical relationship queries.

## Acceptance criteria

- Only supported core entity types can be relation endpoints.
- Both endpoint IDs must resolve in their declared types.
- Relation direction and type are preserved exactly.
- Duplicate active relationships are rejected where domain cardinality disallows them.
- Ending a relation sets ended-at instead of deleting the row.
- Queries can filter by source, target, relation type, active status, and time.
- Relationship-specific metadata round-trips without being promoted to unrelated entity columns.

## Dependencies

- Core concept persistence for any endpoint type used by a relation.

## Out of scope

- Labels and lifecycle states.
- General graph analytics.
- Database-level foreign keys.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户和领域能力可以通过显式、可检查、有时间边界的关系连接核心概念。

## 范围

- 在 Task、Goal、Project、Idea、Philosophy、Workflow、Resource 和 Record 之间创建、读取、结束和查询关系。
- 在不使用数据库外键的情况下验证逻辑端点引用。
- 通过领域策略验证支持的关系类型、方向、基数和元数据。
- 提供活动和历史关系查询。

## 验收标准

- 只有支持的核心实体类型可以作为关系端点。
- 两个端点 ID 必须在其声明的类型中解析。
- 关系方向和类型被精确保留。
- 在领域基数不允许的情况下，重复活动关系会被拒绝。
- 结束关系会设置 ended-at，而不是删除该行。
- 查询可以按来源、目标、关系类型、活动状态和时间筛选。
- 关系特定的元数据可以往返，而不会被提升到无关的实体列。

## 依赖

- 关系使用的任何端点类型的核心概念持久化。

## 超出范围

- 标签和生命周期状态。
- 通用图分析。
- 数据库级外键。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| connect | 连接 | connect core concepts |
| validate | 验证 | Validate logical endpoint references |
| resolve | 解析 | endpoint IDs must resolve in their declared types |
| preserve | 保留 | Relation direction and type are preserved exactly |
| reject | 拒绝 | Duplicate active relationships are rejected |
| end | 结束 | Ending a relation sets ended-at |
| filter | 过滤 | Queries can filter by source, target, relation type |
| promote | 提升 | metadata round-trips without being promoted |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| semantic relation | 语义关系 | Create and validate semantic relations |
| time-bounded relationship | 有时间边界的关系 | time-bounded relationships |
| endpoint reference | 端点引用 | logical endpoint references |
| relation type | 关系类型 | supported relation types |
| domain policy | 领域策略 | through domain policies |
| active status | 活动状态 | filter by active status |
| cardinality | 基数 | domain cardinality disallows them |
| database-level foreign keys | 数据库级外键 | Database-level foreign keys |

### 值得模仿的句式
1. **"A can connect B through C."** — A 可以通过 C 连接 B。 — Users and domain capabilities can connect core concepts through explicit, inspectable, time-bounded relationships.
2. **"A are rejected where B disallows them."** — 在 B 不允许的情况下，A 会被拒绝。 — Duplicate active relationships are rejected where domain cardinality disallows them.
3. **"A round-trips without being promoted to B."** — A 可以往返，而不会被提升为 B。 — Relationship-specific metadata round-trips without being promoted to unrelated entity columns.

### 领域词汇
| English | 中文 |
|---|---|
| Semantic relation | 语义关系 |
| Endpoint | 端点 |
| Cardinality | 基数 |
| Metadata | 元数据 |
| Provenance | 来源追溯 |
| Domain policy | 领域策略 |
| Active status | 活动状态 |
| Graph analytics | 图分析 |
| Foreign key | 外键 |

---

## 4. 小练习

1. Users can connect core concepts through explicit, inspectable, ______-bounded relationships.
2. Validate logical endpoint references without database-level foreign ______.
3. Both endpoint IDs must ______ in their declared types.
4. Duplicate active relationships are rejected where domain ______ disallows them.
5. Ending a relation sets ______ instead of deleting the row.

<details>
<summary>点击查看答案</summary>

1. time
2. keys
3. resolve
4. cardinality
5. ended-at
</details>
