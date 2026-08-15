# Issue #31: Task: Establish the workflow domain model and persistence boundary

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Manage reusable and versioned workflow definitions (#23)

---

## 1. Original English

Parent Feature: #23

## Outcome

The application has a durable Workflow aggregate and repository boundary matching the V1 schema, ready for versioning and provenance integration.

## Implementation plan

1. Define the Workflow identifier, supported workflow-type vocabulary, required-field rules, positive-version rule, timestamps, and archive semantics in the domain layer.
2. Add the `workflows` storage migration/schema exactly as documented, with no database foreign keys, plus repository ports for create, get, update, archive, and list operations.
3. Implement application commands that validate intrinsic data before persistence and return explicit not-found, validation, and archived-entity errors.
4. Document the transaction and clock/ID injection boundaries so later provenance recording can join the same application operation.

## Acceptance criteria

- [ ] Title, workflow type, and a positive version are required.
- [ ] Optional description, purpose, entry criteria, and exit criteria round-trip without loss.
- [ ] Create, read, update, archive, and list operations are exposed through framework-neutral application contracts.
- [ ] Archived definitions remain retrievable for historical consumers.
- [ ] The schema contains no database foreign keys and logical validation remains in the application/domain layer.

## Tests

- Domain unit tests for every supported workflow type, blank titles, and non-positive versions.
- Repository contract tests for persistence, optional fields, timestamps, list ordering, and archive filtering.
- Migration/schema verification tests for the documented columns and indexes.

## Dependencies

- Feature #23.
- Feature #30 supplies the atomic provenance implementation consumed by mutation commands.

## Out of scope

- Workflow states and transitions.
- Project-specific state machines.
- Runtime lifecycle transitions.

---

## 2. 中文翻译

父特性：#23

## 预期成果

应用拥有一个持久的工作流聚合根和与 V1 模式匹配的仓库边界，为版本管理和溯源集成做好准备。

## 实现计划

1. 在领域层定义工作流标识符、受支持的工作流类型词汇、必填字段规则、正版本号规则、时间戳以及归档语义。
2. 按照文档精确添加 `workflows` 存储迁移/模式，不包含数据库外键，并提供创建、获取、更新、归档和列出操作的仓库端口。
3. 实现应用命令，在持久化前验证内在数据，并返回明确的未找到、验证和已归档实体错误。
4. 记录事务以及时钟/ID 注入边界，以便后续溯源记录可以加入同一应用操作。

## 验收标准

- [ ] 标题、工作流类型和正版本号为必填项。
- [ ] 可选描述、用途、准入条件和退出条件可无损往返。
- [ ] 创建、读取、更新、归档和列出操作通过框架无关的应用契约暴露。
- [ ] 已归档定义对历史消费者保持可检索。
- [ ] 模式不包含数据库外键，逻辑验证保留在应用/领域层。

## 测试

- 针对每种受支持工作流类型、空标题和非正版本号的领域单元测试。
- 针对持久化、可选字段、时间戳、列表排序和归档过滤的仓库契约测试。
- 针对文档列和索引的迁移/模式验证测试。

## 依赖

- 特性 #23。
- 特性 #30 提供变更命令所使用的原子溯源实现。

## 范围外

- 工作流状态和转换。
- 项目特定状态机。
- 运行时生命周期转换。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the Workflow identifier, supported workflow-type vocabulary, required-field rules, positive-version rule, timestamps, and archive semantics in the domain layer. |
| archive | 归档 | Define the Workflow identifier, supported workflow-type vocabulary, required-field rules, positive-version rule, timestamps, and archive semantics in the domain layer. |
| validate | 验证 | Implement application commands that validate intrinsic data before persistence and return explicit not-found, validation, and archived-entity errors. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement application commands that validate intrinsic data before persistence and return explicit not-found, validation, and archived-entity errors. |
| add | 添加 | Add the workflows storage migration/schema exactly as documented, with no database foreign keys, plus repository ports for create, get, update, archive, and list operations. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| entry criteria | 准入条件 | Optional description, purpose, entry criteria, and exit criteria round-trip without loss. |
| exit criteria | 退出条件 | Optional description, purpose, entry criteria, and exit criteria round-trip without loss. |
| framework-neutral | 框架无关的 | Create, read, update, archive, and list operations are exposed through framework-neutral application contracts. |
| round-trip without loss | 无损往返 | Optional description, purpose, entry criteria, and exit criteria round-trip without loss. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Provenance | 溯源 |
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Entry criteria | 准入条件 |
| Exit criteria | 退出条件 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Every material mutation should emit structured _______ in the same transaction.
3. Archiving a Workflow must not invalidate historical project _______.
4. Required source _______ must pass before a transition is authorized.
5. It is important to _______ every transition before committing it.

<details>
<summary>点击查看答案</summary>

1. state machine
2. provenance
3. execution
4. exit criteria
5. validate

</details>
