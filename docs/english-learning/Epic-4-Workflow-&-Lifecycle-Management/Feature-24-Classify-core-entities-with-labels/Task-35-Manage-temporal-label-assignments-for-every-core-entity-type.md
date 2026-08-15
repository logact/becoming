# Issue #35: Task: Manage temporal label assignments for every core entity type

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Classify core entities with labels (#24)

---

## 1. Original English

Parent Feature: #24

## Outcome

All eight core entity types can receive and end Label assignments with logical-reference validation and preserved history.

## Implementation plan

1. Implement the `entity_labels` repository with active and historical reads keyed by entity type/ID and label ID, retaining `created_at` and optional `ended_at`.
2. Create a core-entity resolver registry for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record so logical references are validated in the application layer.
3. Implement assign and end commands that reject unsupported/missing entities, missing or archived labels, duplicate active assignments, and invalid end requests.
4. Enforce one active assignment per entity/label under concurrency using a storage constraint or transactional locking while preserving ended rows.

## Acceptance criteria

- [ ] Each of the eight supported core types can receive a valid active Label assignment.
- [ ] Archived labels cannot be newly assigned, while previous assignments remain resolvable.
- [ ] A duplicate active assignment is rejected even under concurrent requests.
- [ ] Ending an assignment sets `ended_at` and never deletes its row.
- [ ] Ending an already-ended assignment follows a documented idempotency/conflict contract.
- [ ] Unsupported types and missing logical references return explicit domain errors.

## Tests

- Table-driven unit tests across all eight entity types and all logical-reference failures.
- Repository tests for active uniqueness, temporal history, and historical archived-label resolution.
- Concurrency integration test for duplicate assignment and transaction test for end operations.

## Dependencies

- `Task: Implement label definitions and archive-safe lookup`.
- Core entity repositories/resolver ports from their owning features.

## Out of scope

- Semantic relations for classification.
- A label hierarchy.
- State-machine creation as a side effect of assignment.

---

## 2. 中文翻译

父特性：#24

## 预期成果

全部八种核心实体类型都可以接收和结束标签分配，并进行逻辑引用验证及保留历史。

## 实现计划

1. 实现 `entity_labels` 仓库，支持按实体类型/ID 和标签 ID 进行活跃和历史读取，保留 `created_at` 和可选的 `ended_at`。
2. 为核心实体类型（任务、目标、项目、想法、理念、工作流、资源、记录）创建核心实体解析注册表，以便在应用层验证逻辑引用。
3. 实现分配和结束命令：拒绝不支持/缺失的实体、缺失或已归档的标签、重复活跃分配以及无效的结束请求。
4. 在并发下使用存储约束或事务锁强制每个实体/标签只能有一个活跃分配，同时保留已结束行。

## 验收标准

- [ ] 八种受支持核心类型中的每一种都可以接收有效的活跃标签分配。
- [ ] 已归档标签不能被新分配，而之前的分配仍可解析。
- [ ] 即使在并发请求下，重复活跃分配也会被拒绝。
- [ ] 结束分配会设置 `ended_at`，且从不删除其行。
- [ ] 结束已结束的分配遵循文档化的幂等/冲突契约。
- [ ] 不支持的类型和缺失的逻辑引用返回显式领域错误。

## 测试

- 跨全部八种实体类型及所有逻辑引用失败的表驱动单元测试。
- 活跃唯一性、时态历史以及已归档标签历史解析的仓库测试。
- 重复分配并发集成测试和结束操作事务测试。

## 依赖

- 任务：实现标签定义和归档安全查找。
- 各拥有特性提供的核心实体仓库/解析器端口。

## 范围外

- 用于分类的语义关系。
- 标签层级。
- 将状态机创建作为分配的副作用。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| reference | 引用 | All eight core entity types can receive and end Label assignments with logical-reference validation and preserved history. |
| reject | 拒绝 | Implement assign and end commands that reject unsupported/missing entities, missing or archived labels, duplicate active assignments, and invalid end requests. |
| archive | 归档 | Archive obsolete workflow versions safely. |
| enforce | 强制执行 | Enforce one active assignment per entity/label under concurrency using a storage constraint or transactional locking while preserving ended rows. |
| record | 记录 | Create a core-entity resolver registry for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record so logical references are validated in the application layer. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| assign | 分配 | Implement assign and end commands that reject unsupported/missing entities, missing or archived labels, duplicate active assignments, and invalid end requests. |
| end | 结束 | All eight core entity types can receive and end Label assignments with logical-reference validation and preserved history. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| archive-safe lookup | 归档安全查找 | Archive-safe label lookup remains resolvable. |
| semantic relations | 语义关系 | Semantic relations for classification. |
| logical references | 逻辑引用 | Create a core-entity resolver registry for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record so logical references are validated in the application layer. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Acceptance criteria | 验收标准 |
| Archive-safe | 归档安全的 |
| Label | 标签 |
| Idempotency | 幂等性 |

---

## 4. 小练习

1. Concurrent requests require _______ controls to avoid duplicate active rows.
2. Archiving a Workflow must not invalidate historical project _______.
3. All eight core entity types can receive and end _______ assignments.
4. A duplicate active assignment is _______ even under concurrent requests.
5. Archived labels cannot be _______ while previous assignments remain resolvable.

<details>
<summary>点击查看答案</summary>

1. concurrency
2. execution
3. Label
4. rejected
5. newly assigned

</details>
