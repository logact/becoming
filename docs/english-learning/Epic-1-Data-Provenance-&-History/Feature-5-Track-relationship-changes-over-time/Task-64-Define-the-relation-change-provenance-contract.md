# Issue #64: Task: Define the relation-change provenance contract

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Track relationship changes over time (#5)

---

## 1. Original English

Parent Feature: #5 — Feature: Track relationship changes over time

## Outcome

Creating, ending, or replacing a semantic relation has a shared structured provenance contract that identifies both logical endpoints, relation type, metadata, actor, and time while preserving temporal relation history.

## Implementation plan

1. Define relation-change Record payloads for `relation_created` and `relation_ended`, including relation ID, source type/ID, relation type, target type/ID, relevant metadata, actor, event time, `created_at`, and optional `ended_at`.
2. Define the allowed eight core endpoint types and delegate endpoint existence and relation semantic validation to Feature #19's application/domain policies, without an `entities` table or database foreign keys.
3. Define one transaction/unit-of-work boundary for the relation write and appended provenance Record and specify rollback/failure behavior.
4. Specify an explicit repeated-end contract (idempotent return or domain error) and replacement semantics as an atomic end-old/create-new operation that produces the corresponding two audit Records.
5. Define payload metadata filtering so meaningful relationship context is retained without recording unrelated or sensitive data.

## Acceptance criteria

- [ ] Create/end payloads identify source, relation type, target, relation ID, actor, and event time.
- [ ] Relation temporal values are represented explicitly and the original `created_at` remains unchanged when ending.
- [ ] Metadata inclusion uses an explicit allowlist/redaction policy.
- [ ] The relation mutation and its audit Record share one application transaction boundary.
- [ ] Repeated ending and replacement each have documented, testable semantics.
- [ ] The contract uses the independent `relations` and `records` tables, logical validation, and no database foreign keys.

## Tests

- Unit-test create/end payload construction for all supported endpoint-type discriminators and metadata filtering.
- Contract-test rollback when either the relation or provenance write fails.
- Test the chosen repeated-end and replacement contracts, including expected Record counts and timestamps.

## Dependencies

- Parent Feature #5.
- #58 — Task: Define the atomic core-mutation provenance contract.
- Feature #19 — Create and validate semantic relations.

## Out of scope

- Domain-specific lineage meanings (Feature #8).
- Relation graph visualization and deep graph analytics.
- Lifecycle-state and label-assignment provenance.

---

## 2. 中文翻译

父功能：#5 — 功能：跟踪关系随时间的变化

## 成果

创建、结束或替换语义关系都使用一个共享的结构化来源合同，该合同标识两个逻辑端点、关系类型、元数据、行为者和时间，同时保留时间关系历史。

## 实施计划

1. 为 `relation_created` 和 `relation_ended` 定义关系变更记录载荷，包括关系 ID、来源类型/ID、关系类型、目标类型/ID、相关元数据、行为者、事件时间、`created_at` 以及可选的 `ended_at`。
2. 定义允许的八种核心端点类型，并将端点存在性及关系语义验证委托给功能 #19 的应用/领域策略，不使用 `entities` 表或数据库外键。
3. 为关系写入和追加的来源记录定义一个事务/工作单元边界，并指定回滚/失败行为。
4. 指定显式的重复结束合同（幂等返回或领域错误）以及替换语义，作为原子性的结束旧关系/创建新关系操作，产生相应的两条审计记录。
5. 定义载荷元数据过滤，以保留有意义的关系上下文，而不记录无关或敏感数据。

## 验收标准

- [ ] 创建/结束载荷标识来源、关系类型、目标、关系 ID、行为者和事件时间。
- [ ] 关系时间值被显式表示，且结束时不改变原始 `created_at`。
- [ ] 元数据包含使用显式的白名单/编辑策略。
- [ ] 关系变更及其审计记录共享一个应用事务边界。
- [ ] 重复结束和替换各自具有可文档化、可测试的语义。
- [ ] 该合同使用独立的 `relations` 和 `records` 表、逻辑验证，且不使用数据库外键。

## 测试

- 对所有支持的端点类型鉴别器和元数据过滤进行单元测试，构建创建/结束载荷。
- 当关系或来源写入失败时，进行合同测试回滚。
- 测试所选的重复结束和替换合同，包括预期的记录数量和时间戳。

## 依赖

- 父功能 #5。
- #58 — 任务：定义原子核心变更来源合同。
- 功能 #19 — 创建并验证语义关系。

## 范围外

- 领域特定的谱系含义（功能 #8）。
- 关系图可视化和深度图分析。
- 生命周期状态和标签分配来源。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define relation-change Record payloads for `relation_created` and `relation_ended`. |
| identify | 标识 | ...a contract that identifies both logical endpoints, relation type, metadata, actor, and time. |
| preserve | 保留 | ...while preserving temporal relation history. |
| delegate | 委托 | Delegate endpoint existence and relation semantic validation to Feature #19's policies. |
| specify | 指定 | Specify rollback/failure behavior. |
| prohibit | 禁止 | ...without an `entities` table or database foreign keys. |
| append | 追加 | ...the relation write and appended provenance Record... |
| represent | 表示 | Relation temporal values are represented explicitly. |
| filter | 过滤 | Define payload metadata filtering. |
| retain | 保留 | ...meaningful relationship context is retained. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| relation-change provenance contract | 关系变更来源合同 | 定义关系变更来源信息的标准 |
| structured provenance contract | 结构化来源合同 | 统一格式化的来源信息约定 |
| logical endpoints | 逻辑端点 | 关系两端的逻辑引用 |
| temporal relation history | 时间关系历史 | 带时间戳的关系变更历史 |
| endpoint existence | 端点存在性 | 验证关系两端实体是否存在 |
| relation semantic validation | 关系语义验证 | 验证关系是否符合业务语义 |
| unit-of-work boundary | 工作单元边界 | 一个事务或操作的原子范围 |
| rollback/failure behavior | 回滚/失败行为 | 失败时如何回滚 |
| repeated-end contract | 重复结束合同 | 多次结束同一关系的处理约定 |
| atomic end-old/create-new operation | 原子性的结束旧/创建新操作 | 不可分割的替换操作 |
| allowlist/redaction policy | 白名单/编辑策略 | 决定保留或隐藏哪些字段 |

### 值得模仿的句式
1. **“Creating, ending, or replacing a semantic relation has a shared structured provenance contract...”** — 创建、结束或替换语义关系有一个共享的结构化来源合同... — 例句：Creating, updating, or deleting a task has a shared structured validation contract.
2. **“...without an `entities` table or database foreign keys.”** — ...不使用 `entities` 表或数据库外键。 — 例句：The design stores logical references without an `entities` table or database foreign keys.
3. **“...produces the corresponding two audit Records.”** — ...产生相应的两条审计记录。 — 例句：A replacement produces the corresponding two audit records.

### 领域词汇
| English | 中文 |
|---|---|
| Provenance contract | 来源合同 |
| Endpoint type | 端点类型 |
| Unit-of-work boundary | 工作单元边界 |
| Redaction policy | 编辑策略 |
| Allowlist | 白名单 |
| Atomic operation | 原子操作 |
| Audit record | 审计记录 |
| Semantic relation | 语义关系 |
| Discriminator | 鉴别器 |
| Database foreign key | 数据库外键 |

---

## 4. 小练习

1. Creating, ending, or replacing a semantic relation has a shared structured ______ contract.
2. We delegate endpoint existence and relation semantic validation to Feature #19's application/domain ______.
3. The relation mutation and its audit Record share one application ______ boundary.
4. Metadata inclusion uses an explicit ______/redaction policy.
5. The contract uses the independent `relations` and `records` tables, logical validation, and no database ______ keys.

<details>
<summary>点击查看答案</summary>

1. provenance
2. policies
3. transaction
4. allowlist
5. foreign

</details>
