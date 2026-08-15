# Issue #65: Task: Audit relation creation and ending atomically

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Track relationship changes over time (#5)

---

## 1. Original English

Parent Feature: #5 — Feature: Track relationship changes over time

## Outcome

Every successful semantic relation creation or end appends exactly one matching provenance Record, and failed operations leave neither partial current-state changes nor misleading success history.

## Implementation plan

1. Integrate the relation-change provenance contract into Feature #19's relation create and end application services after endpoint, direction, type, cardinality, and metadata validation.
2. On creation, persist `relations.created_at` and append one `relation_created` Record using the same actor and clock context.
3. On ending, update only `ended_at` on the existing relation and append one `relation_ended` Record while retaining the original row and metadata.
4. Enforce the selected repeated-end contract and prohibit ordinary physical deletion of active or ended relation rows.
5. Commit each relation mutation and its provenance append atomically.

## Acceptance criteria

- [ ] Creating a relation emits exactly one structured provenance Record with both endpoints, type, actor, and time.
- [ ] Ending a relation preserves its row and original `created_at`, sets `ended_at`, and emits exactly one end Record.
- [ ] An already-ended relation is handled according to the explicit contract without duplicate or misleading success Records.
- [ ] Validation or persistence failure leaves relation state and provenance unchanged.
- [ ] Ordinary relation application operations cannot physically erase ended history.
- [ ] Audit behavior applies to relations between any allowed pair of core entity types.

## Tests

- Integration-test relation create/end for representative directed endpoint combinations and assert Record payloads and temporal fields.
- Test unknown endpoints, unsupported relation types/directions, cardinality violations, already-ended relations, and metadata validation failures.
- Inject relation/provenance persistence failures and assert transaction rollback.
- Test that no public repository/application delete path can erase ended history.

## Dependencies

- Parent Feature #5.
- Task: Define the relation-change provenance contract.
- Feature #19 — Create and validate semantic relations, including its relation repository and application validation.

## Out of scope

- Defining relation-type business semantics beyond Feature #19 policies.
- Lineage traversal and entity timeline aggregation.

---

## 2. 中文翻译

父功能：#5 — 功能：跟踪关系随时间的变化

## 成果

每次成功的语义关系创建或结束都会追加一条匹配的来源记录，失败的操作不会留下部分当前状态变更，也不会留下误导性的成功历史。

## 实施计划

1. 在端点、方向、类型、基数和元数据验证之后，将关系变更来源合同集成到功能 #19 的关系创建和结束应用服务中。
2. 在创建时，持久化 `relations.created_at`，并使用相同的行为者和时钟上下文追加一条 `relation_created` 记录。
3. 在结束时，仅更新现有关系的 `ended_at`，并追加一条 `relation_ended` 记录，同时保留原始行和元数据。
4. 强制执行选定的重复结束合同，并禁止对活动或已结束关系行进行普通物理删除。
5. 原子性地提交每次关系变更及其来源追加。

## 验收标准

- [ ] 创建关系会发出一条包含两个端点、类型、行为者和时间的结构化来源记录。
- [ ] 结束关系保留其行和原始 `created_at`，设置 `ended_at`，并发出一条结束记录。
- [ ] 已结束的关系按照显式合同处理，不会产生重复或误导性的成功记录。
- [ ] 验证或持久化失败会使关系状态和来源保持不变。
- [ ] 普通关系应用操作无法物理擦除已结束的历史。
- [ ] 审计行为适用于任何允许的核心实体类型对之间的关系。

## 测试

- 对代表性有向端点组合进行集成测试，创建/结束关系，并断言记录载荷和时间字段。
- 测试未知端点、不支持的关系类型/方向、基数冲突、已结束关系和元数据验证失败。
- 注入关系/来源持久化失败并断言事务回滚。
- 测试没有公共仓库/应用删除路径可以擦除已结束的历史。

## 依赖

- 父功能 #5。
- 任务：定义关系变更来源合同。
- 功能 #19 — 创建并验证语义关系，包括其关系仓库和应用验证。

## 范围外

- 超出功能 #19 策略的关系类型业务语义。
- 谱系遍历和实体时间线聚合。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| integrate | 集成 | Integrate the relation-change provenance contract into application services. |
| persist | 持久化 | On creation, persist `relations.created_at`. |
| append | 追加 | Append one `relation_created` Record using the same actor and clock context. |
| update | 更新 | On ending, update only `ended_at` on the existing relation. |
| enforce | 强制执行 | Enforce the selected repeated-end contract. |
| prohibit | 禁止 | Prohibit ordinary physical deletion of active or ended relation rows. |
| commit | 提交 | Commit each relation mutation and its provenance append atomically. |
| leave | 留下 | Failed operations leave neither partial current-state changes nor misleading success history. |
| handle | 处理 | An already-ended relation is handled according to the explicit contract. |
| apply | 适用 | Audit behavior applies to relations between any allowed pair of core entity types. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| audit relation creation atomically | 原子性地审计关系创建 | 描述关系创建与审计的原子性 |
| semantic relation creation | 语义关系创建 | 创建带有业务含义的关系 |
| endpoint validation | 端点验证 | 验证关系两端是否有效 |
| cardinality validation | 基数验证 | 验证关系的数量约束 |
| relation-created Record | 关系创建记录 | 关系创建的来源记录 |
| relation-ended Record | 关系结束记录 | 关系结束的来源记录 |
| repeated-end contract | 重复结束合同 | 多次结束的处理约定 |
| physical deletion | 物理删除 | 从数据库中真正删除数据 |
| ordinary operations | 普通操作 | 常规业务操作 |
| transaction rollback | 事务回滚 | 失败时撤销已执行的操作 |

### 值得模仿的句式
1. **“Every successful ... appends exactly one matching provenance Record...”** — 每次成功的...都会追加一条匹配的来源记录... — 例句：Every successful update appends exactly one matching audit record.
2. **“...failed operations leave neither partial current-state changes nor misleading success history.”** — ...失败的操作不会留下部分当前状态变更，也不会留下误导性的成功历史。 — 例句：Failed operations leave neither partial data nor misleading success logs.
3. **“Commit each relation mutation and its provenance append atomically.”** — 原子性地提交每次关系变更及其来源追加。 — 例句：Commit each state change and its audit append atomically.

### 领域词汇
| English | 中文 |
|---|---|
| Atomic commit | 原子性提交 |
| Provenance Record | 来源记录 |
| Cardinality | 基数 |
| Endpoint validation | 端点验证 |
| Current-state changes | 当前状态变更 |
| Transaction rollback | 事务回滚 |
| Misleading history | 误导性历史 |
| Relation-ended | 关系已结束 |
| Physical deletion | 物理删除 |
| Directed endpoint | 有向端点 |

---

## 4. 小练习

1. Every successful semantic relation creation or end ______ exactly one matching provenance Record.
2. Failed operations leave neither partial current-state changes nor misleading ______ history.
3. On ending, update only `ended_at` on the existing relation while ______ the original row and metadata.
4. We must ______ ordinary physical deletion of active or ended relation rows.
5. Validation or persistence failure leaves relation state and provenance ______.

<details>
<summary>点击查看答案</summary>

1. appends
2. success
3. retaining
4. prohibit
5. unchanged

</details>
