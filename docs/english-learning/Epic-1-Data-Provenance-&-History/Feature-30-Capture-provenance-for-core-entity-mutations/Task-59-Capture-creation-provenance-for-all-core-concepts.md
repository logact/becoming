# Issue #59: Task: Capture creation provenance for all core concepts

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Capture provenance for core entity mutations (#30)

---

## 1. Original English

Parent Feature: #30 — Feature: Capture provenance for core entity mutations

## Outcome

Creating any of the eight core concepts appends exactly one structured creation-provenance Record in the same successful application operation.

## Implementation plan

1. Wrap the create command handlers/services for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and user-facing Record creation with the shared provenance contract.
2. Build a creation payload from the persisted entity identity and material initial values, using the supplied actor and application clock event time.
3. Persist the new core row and appended provenance Record through the same unit of work; make both invisible on rollback if either write fails.
4. Ensure provenance Records remain ordinary rows in the independent `records` table and relate to affected entities through shared logical-reference mechanisms rather than entity-specific columns or database foreign keys.

## Acceptance criteria

- [ ] Successful creation of each of Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record creates exactly one creation-provenance Record.
- [ ] Each creation Record includes the affected entity type and ID, `create` action, actor, and event time.
- [ ] Material initial values follow the shared allowlist/redaction policy.
- [ ] A rejected/failed creation leaves no success provenance Record.
- [ ] A provenance write failure leaves no successfully created core entity.
- [ ] Record creation auditing follows the finite recursion contract and does not generate an unbounded chain.

## Tests

- Use a table-driven application test covering successful creation for all eight core types and asserting the structured Record contents.
- For every core type, test domain validation failure, core repository failure, and provenance repository failure with no partial committed state.
- Test actor/time propagation and sensitive/unrelated field omission.
- Test user-facing Record creation produces exactly one associated creation audit entry.

## Dependencies

- Parent Feature #30.
- Task: Define the atomic core-mutation provenance contract.
- The create application service for each relevant core concept; integrate as those Feature tasks land rather than inventing a framework.

## Out of scope

- Update, archive, restoration, relation, and lifecycle-transition provenance.
- Transport-level request identity or authentication design.

---

## 2. 中文翻译

父功能：#30 — 功能：为核心实体变更捕获来源信息

## 成果

创建八种核心概念中的任何一种都会在同一个成功的应用操作中追加恰好一条结构化创建来源记录。

## 实施计划

1. 为任务、目标、项目、想法、理念、工作流、资源和用户面向的记录创建，用共享来源合同包装创建命令处理程序/服务。
2. 从持久化的实体标识和实质初始值构建创建载荷，使用提供的行为者和应用时钟事件时间。
3. 通过相同的工作单元持久化新核心行和追加的来源记录；如果任一写入失败，两者在回滚时都不可见。
4. 确保来源记录仍然是独立 `records` 表中的普通行，并通过共享逻辑引用机制而非特定于实体的列或数据库外键与受影响实体相关。

## 验收标准

- [ ] 任务、目标、项目、想法、理念、工作流、资源和记录的成功创建各自创建恰好一条创建来源记录。
- [ ] 每条创建记录包括受影响实体类型和 ID、`create` 操作、行为者和事件时间。
- [ ] 实质初始值遵循共享白名单/编辑策略。
- [ ] 被拒绝/失败的创建不会留下成功来源记录。
- [ ] 来源写入失败不会留下成功创建的核心实体。
- [ ] 记录创建审计遵循有限递归合同，不会产生无界链。

## 测试

- 使用表驱动应用测试覆盖所有八种核心类型的成功创建，并断言结构化记录内容。
- 对每种核心类型，测试领域验证失败、核心仓库失败和来源仓库失败，无部分提交状态。
- 测试行为者/时间传播和敏感/无关字段省略。
- 测试用户面向的记录创建恰好产生一条关联创建审计条目。

## 依赖

- 父功能 #30。
- 任务：定义原子核心变更来源合同。
- 每个相关核心概念的创建应用服务；在这些功能任务落地时集成，而不是发明框架。

## 范围外

- 更新、归档、恢复、关系和生命周期转换来源。
- 传输级请求身份或认证设计。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| wrap | 包装 | Wrap the create command handlers with the shared provenance contract. |
| build | 构建 | Build a creation payload from the persisted entity identity. |
| persist | 持久化 | Persist the new core row and appended provenance Record. |
| ensure | 确保 | Ensure provenance Records remain ordinary rows in the independent `records` table. |
| relate | 关联 | Relate to affected entities through shared logical-reference mechanisms. |
| cover | 覆盖 | Cover successful creation for all eight core types. |
| omit | 省略 | Test sensitive/unrelated field omission. |
| land | 落地 | Integrate as those Feature tasks land. |
| generate | 产生 | Does not generate an unbounded chain. |
| associate | 关联 | ...produces exactly one associated creation audit entry. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| creation provenance | 创建来源 | 实体创建的来源记录 |
| core concepts | 核心概念 | 系统中的核心实体类型 |
| shared provenance contract | 共享来源合同 | 复用的来源约定 |
| create command handlers | 创建命令处理程序 | 处理创建命令的服务 |
| persisted entity identity | 持久化的实体标识 | 创建后实体的 ID 等 |
| material initial values | 实质初始值 | 有意义的初始字段值 |
| application clock | 应用时钟 | 应用层的时间源 |
| unit of work | 工作单元 | 一个事务范围 |
| logical-reference mechanisms | 逻辑引用机制 | 通过 ID/类型引用 |
| table-driven test | 表驱动测试 | 参数化表格形式的测试 |
| actor/time propagation | 行为者/时间传播 | 行为者和时间的传递 |

### 值得模仿的句式
1. **“Creating any of the eight core concepts appends exactly one structured creation-provenance Record in the same successful application operation.”** — 创建八种核心概念中的任何一种都会在同一个成功的应用操作中追加恰好一条结构化创建来源记录。 — 例句：Creating any account appends exactly one structured creation audit in the same operation.
2. **“...make both invisible on rollback if either write fails.”** — ...如果任一写入失败，两者在回滚时都不可见。 — 例句：Make both writes invisible on rollback if either fails.
3. **“...do not generate an unbounded chain.”** — ...不会产生无界链。 — 例句：The recursive call must not generate an unbounded chain.

### 领域词汇
| English | 中文 |
|---|---|
| Creation provenance | 创建来源 |
| Core concept | 核心概念 |
| Material initial value | 实质初始值 |
| Application clock | 应用时钟 |
| Logical-reference mechanism | 逻辑引用机制 |
| Table-driven test | 表驱动测试 |
| Actor/time propagation | 行为者/时间传播 |
| Finite recursion contract | 有限递归合同 |
| Unbounded chain | 无界链 |
| Transport-level identity | 传输级身份 |

---

## 4. 小练习

1. Creating any of the eight core concepts appends exactly one structured creation-provenance Record in the same successful application ______.
2. Build a creation payload from the persisted entity identity and material initial values, using the supplied actor and application ______ event time.
3. Persist the new core row and appended provenance Record through the same unit of ______.
4. Provenance Records relate to affected entities through shared logical-reference ______ rather than entity-specific columns.
5. Record creation auditing follows the finite recursion contract and does not generate an unbounded ______.

<details>
<summary>点击查看答案</summary>

1. operation
2. clock
3. work
4. mechanisms
5. chain

</details>
