# Issue #58: Task: Define the atomic core-mutation provenance contract

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Capture provenance for core entity mutations (#30)

---

## 1. Original English

Parent Feature: #30 — Feature: Capture provenance for core entity mutations

## Outcome

Every core-entity mutation can use one framework-neutral application contract to persist the current-state change and one structured provenance Record atomically, with consistent actor, time, action, entity identity, and change data.

## Implementation plan

1. Define a provenance payload schema for entity type, entity ID, action (`create`, `update`, `archive`, and optional `restore`/supported `delete`), actor, event time, and relevant before/after values across the eight independent core concepts.
2. Define per-entity field-selection/redaction policies so only material, allowed fields enter before/after data and secrets or unrelated values are excluded.
3. Introduce an application transaction/unit-of-work port that covers both the core repository mutation and appended Record creation without assuming a database library, ORM, or web framework.
4. Define recursion and failure semantics: a user-facing Record mutation is audited once, while the internal insertion of its provenance Record does not recursively produce infinite provenance.
5. Define explicit domain/application errors and rollback behavior for mutation validation, current-state persistence, and provenance persistence failures.

## Acceptance criteria

- [ ] The contract supports Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record without an `entities` table.
- [ ] Every provenance payload identifies entity type and ID, action, actor, and event time.
- [ ] Update payload construction can represent relevant before/after values through an explicit allowlist/redaction policy.
- [ ] The contract distinguishes archive from restoration and any supported deletion action.
- [ ] Current-state mutation and provenance append share one atomic application transaction boundary.
- [ ] Record mutations have a documented, finite audit behavior that does not recursively create provenance forever.
- [ ] Logical references are validated in the application/domain layer; no database foreign keys are added.

## Tests

- Unit-test payload schemas, action validation, field allowlists/redaction, timestamps, and all eight entity-type discriminators.
- Contract-test commit and rollback behavior with failing mutation and failing Record repositories.
- Test that a user-facing Record mutation creates exactly one provenance Record and terminates without recursive audit writes.

## Dependencies

- Parent Feature #30.
- #53 — Task: Establish the Record domain model and persistence.

## Out of scope

- Lifecycle-transition-specific audit payloads (Feature #9).
- Semantic-relation change audit payloads (Feature #5).
- Read-access auditing or an HTTP/API transport.

---

## 2. 中文翻译

父功能：#30 — 功能：为核心实体变更捕获来源信息

## 成果

每个核心实体变更都可以使用一个与框架无关的应用合同来持久化当前状态变更和一条结构化来源记录，具有一致的行为者、时间、操作、实体标识和变更数据。

## 实施计划

1. 为实体类型、实体 ID、操作（`create`、`update`、`archive` 和可选的 `restore`/支持的 `delete`）、行为者、事件时间以及跨八种独立核心概念的相关前后值定义来源载荷模式。
2. 定义每个实体的字段选择/编辑策略，以便只有实质的、允许的字段进入前后数据，排除机密或无关值。
3. 引入覆盖核心仓库变更和追加记录创建的应用事务/工作单元端口，不假设数据库库、ORM 或 Web 框架。
4. 定义递归和失败语义：用户面向的记录变更是审计一次，而其来源记录的内部插入不会递归产生无限来源。
5. 为变更验证、当前状态持久化和来源持久化失败定义显式应用/领域错误和回滚行为。

## 验收标准

- [ ] 该合同支持任务、目标、项目、想法、理念、工作流、资源和记录，没有 `entities` 表。
- [ ] 每个来源载荷标识实体类型和 ID、操作、行为者和事件时间。
- [ ] 更新载荷构建可以通过显式白名单/编辑策略表示相关前后值。
- [ ] 该合同区分归档与恢复以及任何支持的删除操作。
- [ ] 当前状态变更和来源追加共享一个原子应用事务边界。
- [ ] 记录变更具有文档化的、有限的审计行为，不会递归地永远创建来源。
- [ ] 逻辑引用在应用/领域层验证；不添加数据库外键。

## 测试

- 单元测试载荷模式、操作验证、字段白名单/编辑、时间戳和所有八种实体类型鉴别器。
- 使用失败的变更和失败的记录仓库对提交和回滚行为进行合同测试。
- 测试用户面向的记录变更创建恰好一条来源记录，并终止而不递归审计写入。

## 依赖

- 父功能 #30。
- #53 — 任务：建立记录领域模型和持久化。

## 范围外

- 生命周期转换特定审计载荷（功能 #9）。
- 语义关系变更审计载荷（功能 #5）。
- 读取访问审计或 HTTP/API 传输。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| persist | 持久化 | Persist the current-state change and one structured provenance Record. |
| identify | 标识 | Every provenance payload identifies entity type and ID, action, actor, and event time. |
| distinguish | 区分 | The contract distinguishes archive from restoration. |
| introduce | 引入 | Introduce an application transaction/unit-of-work port. |
| cover | 覆盖 | A port that covers both the core repository mutation and appended Record creation. |
| assume | 假设 | ...without assuming a database library, ORM, or web framework. |
| terminate | 终止 | ...terminates without recursive audit writes. |
| exclude | 排除 | Secrets or unrelated values are excluded. |
| validate | 验证 | Logical references are validated in the application/domain layer. |
| append | 追加 | Current-state mutation and provenance append share one atomic boundary. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| atomic core-mutation provenance contract | 原子核心变更来源合同 | 核心变更来源的标准约定 |
| framework-neutral application contract | 与框架无关的应用合同 | 不依赖框架的应用层约定 |
| current-state change | 当前状态变更 | 对当前状态的修改 |
| provenance payload schema | 来源载荷模式 | 来源数据的结构定义 |
| action create/update/archive/restore/delete | 创建/更新/归档/恢复/删除操作 | 支持的操作类型 |
| field-selection/redaction policy | 字段选择/编辑策略 | 决定保留哪些字段 |
| allowlist/redaction policy | 白名单/编辑策略 | 允许列表和隐藏规则 |
| unit-of-work port | 工作单元端口 | 事务边界的抽象接口 |
| recursion semantics | 递归语义 | 递归行为的约定 |
| finite audit behavior | 有限审计行为 | 不会无限循环的审计 |
| logical-reference validation | 逻辑引用验证 | 在应用层验证引用 |

### 值得模仿的句式
1. **“Every core-entity mutation can use one framework-neutral application contract to persist the current-state change and one structured provenance Record atomically...”** — 每个核心实体变更都可以使用一个与框架无关的应用合同来持久化当前状态变更和一条结构化来源记录... — 例句：Every payment can use one contract to persist the ledger entry and the audit log atomically.
2. **“...without assuming a database library, ORM, or web framework.”** — ...不假设数据库库、ORM 或 Web 框架。 — 例句：The port is defined without assuming a specific database library or ORM.
3. **“...does not recursively produce infinite provenance.”** — ...不会递归产生无限来源。 — 例句：The audit trigger does not recursively produce infinite audit records.

### 领域词汇
| English | 中文 |
|---|---|
| Core-mutation | 核心变更 |
| Provenance contract | 来源合同 |
| Payload schema | 载荷模式 |
| Redaction policy | 编辑策略 |
| Unit-of-work port | 工作单元端口 |
| Recursion semantics | 递归语义 |
| Finite audit | 有限审计 |
| Logical reference | 逻辑引用 |
| Discriminator | 鉴别器 |
| Current-state change | 当前状态变更 |

---

## 4. 小练习

1. Every core-entity mutation can use one framework-neutral application contract to persist the current-state change and one structured provenance Record ______.
2. Define per-entity field-selection/______ policies so only material, allowed fields enter before/after data.
3. The transaction/unit-of-work port covers both the core repository mutation and appended Record creation without assuming a database library, ______, or web framework.
4. A user-facing Record mutation is audited once, while its provenance Record insertion does not recursively produce infinite ______.
5. Logical references are validated in the application/domain layer; no database foreign ______ are added.

<details>
<summary>点击查看答案</summary>

1. atomically
2. redaction
3. ORM
4. provenance
5. keys

</details>
