# Issue #71: Task: Create and end lineage links with provenance

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Represent entity origins and transformations (#8)

---

## 1. Original English

Parent Feature: #8 — Feature: Represent entity origins and transformations

## Outcome

Applications can create and end validated origin/transformation links while preserving transformation context, endpoint integrity, temporal history, and exactly matching relation-change provenance.

## Implementation plan

1. Implement framework-neutral commands/services for creating origin and transformation links through the shared semantic-relation boundary.
2. Validate policy, source and derivative logical references, metadata, cardinality, and cycle constraints before persistence.
3. Delegate persistence and audit to the atomic relation create/end services, using `created_at`/`ended_at` and appending structured relation-change Records.
4. Expose an explicit end-link operation that retains the relation row and handles repeated endings according to the shared contract.
5. Ensure replacement or correction of a lineage link is represented as end-old plus create-new rather than mutation of historical endpoints.

## Acceptance criteria

- [ ] Valid lineage links can connect every endpoint combination allowed by the lineage policy.
- [ ] Both declared endpoint types and IDs resolve through application/domain validation before a link is stored.
- [ ] Transformation metadata round-trips without changing either endpoint entity.
- [ ] Each successful create/end produces the matching provenance Record atomically.
- [ ] Ending retains the lineage row and repeated ending follows the shared explicit contract.
- [ ] Replacing/correcting lineage preserves the old row and creates a new row instead of rewriting history.

## Tests

- Integration-test representative Idea-to-Goal, Goal-to-Task, Record-to-entity, and other allowed lineage links with metadata round trips.
- Test invalid endpoints, disallowed type/direction/cardinality combinations, malformed metadata, and cycles with no partial writes.
- Test end, repeated end, and replacement history plus relation-change Record payloads.
- Inject relation/provenance failures and assert atomic rollback.

## Dependencies

- Parent Feature #8.
- Task: Define origin and transformation relation policies.
- #65 — Task: Audit relation creation and ending atomically.

## Out of scope

- Discovering or inferring sources automatically.
- Updating source or derivative core entities as a side effect.
- Deep traversal or graph visualization.

---

## 2. 中文翻译

父功能：#8 — 功能：表示实体来源和转换

## 成果

应用可以在保留转换上下文、端点完整性、时间历史和完全匹配的关系变更来源的同时，创建和结束经过验证的来源/转换链接。

## 实施计划

1. 通过共享语义关系边界实现与框架无关的命令/服务，用于创建来源和转换链接。
2. 在持久化前验证策略、来源和派生逻辑引用、元数据、基数和循环约束。
3. 将持久化和审计委托给原子关系创建/结束服务，使用 `created_at`/`ended_at` 并追加结构化关系变更记录。
4. 公开显式的结束链接操作，保留关系行，并根据共享合同处理重复结束。
5. 确保谱系链接的替换或修正表示为结束旧链接加创建新链接，而不是变更历史端点。

## 验收标准

- [ ] 有效的谱系链接可以连接谱系策略允许的每种端点组合。
- [ ] 声明的端点类型和 ID 在链接存储前通过应用/领域验证解析。
- [ ] 转换元数据往返而不改变任一端点实体。
- [ ] 每次成功创建/结束都会原子性地产生匹配的来源记录。
- [ ] 结束保留谱系行，重复结束遵循共享显式合同。
- [ ] 替换/修正谱系保留旧行并创建新行，而不是重写历史。

## 测试

- 对代表性的 Idea-to-Goal、Goal-to-Task、Record-to-entity 和其他允许谱系链接进行集成测试，包括元数据往返。
- 测试无效端点、不允许的类型/方向/基数组合、格式错误元数据和循环，且无部分写入。
- 测试结束、重复结束和替换历史以及关系变更记录载荷。
- 注入关系/来源失败并断言原子回滚。

## 依赖

- 父功能 #8。
- 任务：定义来源和转换关系策略。
- #65 — 任务：原子性地审计关系创建和结束。

## 范围外

- 自动发现或推断来源。
- 作为副作用更新来源或派生核心实体。
- 深度遍历或可视化。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| create | 创建 | Applications can create validated origin/transformation links. |
| end | 结束 | Applications can end validated origin/transformation links. |
| preserve | 保留 | ...while preserving transformation context, endpoint integrity, and temporal history. |
| validate | 验证 | Validate policy, source and derivative logical references before persistence. |
| delegate | 委托 | Delegate persistence and audit to the atomic relation create/end services. |
| append | 追加 | ...appending structured relation-change Records. |
| expose | 公开 | Expose an explicit end-link operation. |
| ensure | 确保 | Ensure replacement or correction is represented as end-old plus create-new. |
| connect | 连接 | Valid lineage links can connect every endpoint combination allowed. |
| resolve | 解析 | Both declared endpoint types and IDs resolve through application/domain validation. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| lineage links | 谱系链接 | 表示来源或派生关系的链接 |
| provenance preservation | 来源保留 | 保留来源信息 |
| transformation context | 转换上下文 | 描述转换的背景 |
| endpoint integrity | 端点完整性 | 端点数据不被破坏 |
| temporal history | 时间历史 | 带时间戳的历史 |
| relation-change provenance | 关系变更来源 | 关系变更的来源记录 |
| framework-neutral commands | 与框架无关的命令 | 不依赖特定框架的命令 |
| semantic-relation boundary | 语义关系边界 | 语义关系的接口 |
| logical references | 逻辑引用 | 通过 ID 和类型引用 |
| cycle constraints | 循环约束 | 防止循环的限制 |
| atomic services | 原子服务 | 不可分割执行的服务 |

### 值得模仿的句式
1. **“Applications can create and end validated origin/transformation links while preserving transformation context, endpoint integrity, temporal history, and exactly matching relation-change provenance.”** — 应用可以在保留转换上下文、端点完整性、时间历史和完全匹配的关系变更来源的同时，创建和结束经过验证的来源/转换链接。 — 例句：The service can create and end validated sessions while preserving session context and audit history.
2. **“...delegate persistence and audit to the atomic relation create/end services.”** — ...将持久化和审计委托给原子关系创建/结束服务。 — 例句：Delegate persistence and audit to the shared transaction service.
3. **“...replacement or correction of a lineage link is represented as end-old plus create-new rather than mutation of historical endpoints.”** — ...谱系链接的替换或修正表示为结束旧链接加创建新链接，而不是变更历史端点。 — 例句：A correction is represented as end-old plus create-new rather than mutation of historical data.

### 领域词汇
| English | 中文 |
|---|---|
| Lineage link | 谱系链接 |
| Endpoint integrity | 端点完整性 |
| Temporal history | 时间历史 |
| Relation-change provenance | 关系变更来源 |
| Framework-neutral | 与框架无关的 |
| Logical reference | 逻辑引用 |
| Cycle constraint | 循环约束 |
| Atomic service | 原子服务 |
| End-link operation | 结束链接操作 |
| Historical endpoint | 历史端点 |

---

## 4. 小练习

1. Applications can create and end validated origin/transformation links while preserving transformation context, endpoint ______, and temporal history.
2. We validate policy, source and derivative logical references, metadata, cardinality, and cycle ______ before persistence.
3. We delegate persistence and audit to the atomic relation create/______ services.
4. Each successful create/end produces the matching provenance Record ______.
5. Replacing/correcting lineage preserves the old row and creates a new row instead of ______ history.

<details>
<summary>点击查看答案</summary>

1. integrity
2. constraints
3. end
4. atomically
5. rewriting

</details>
