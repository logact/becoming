# Issue #91: Task: Implement Project domain, persistence, and mutations

**Labels:** task  
**State:** CLOSED  
**Parent:** #20: Feature: Manage projects and goal pursuit

---

## 1. Original English

Parent Feature: #20 — Feature: Manage projects and goal pursuit

## Outcome

A framework-neutral Project model and application operations create, update, archive, read, and list Projects while keeping management relationships outside intrinsic storage.

## Implementation plan

1. Define Project identity and intrinsic fields for required title, optional description and purpose, `created_at`, `updated_at`, and nullable `archived_at`.
2. Add the `projects` persistence mapping and repository/query ports without goal, workflow, lifecycle, relation, resource, or progress columns and without database foreign keys.
3. Implement validated create/update/archive commands with injected clock/ID sources and explicit timestamp/idempotency behavior.
4. Integrate important Project mutations with #30 provenance in the same application unit of work and expose active versus archived/all list filters.

## Acceptance criteria

- [ ] Project title is required; description and purpose are optional and round-trip without loss.
- [ ] Updates preserve `created_at` and advance `updated_at`; archive sets `archived_at` without deletion.
- [ ] Active lists exclude archived Projects, while explicit historical queries retain access to them.
- [ ] The Project table has only intrinsic fields and no Goal, workflow, lifecycle, resource, relation, or progress columns.
- [ ] Create, update, and archive emit structured provenance atomically with the mutation.
- [ ] Validation occurs in the application/domain layer and the persistence schema declares no database foreign keys.

## Tests

- Domain and command tests for required/optional values, updates, archive, and repeated archive.
- Repository/query contract tests for minimal/full and active/archived Project round trips.
- Timestamp and transaction rollback tests, including provenance failure.
- Schema tests for exact Project columns and absence of forbidden fields/foreign keys.

## Dependencies

- Parent Feature: #20.
- Depends on Task: Define Goal domain and persistence boundary for conventions.

---

## 2. 中文翻译

父级 Feature：#20 —— 管理项目与目标追求

## 结果

一个与框架无关的 Project 模型和应用操作创建、更新、归档、读取和列出 Project，同时将管理关系保持在内在存储之外。

## 实施计划

1. 定义 Project 的标识以及内在字段：必需的标题，可选的描述和目的，`created_at`、`updated_at` 和可空的 `archived_at`。
2. 添加 `projects` 持久化映射以及仓库/查询端口，不包含 Goal、工作流、生命周期、关系、资源或进度列，也不包含数据库外键。
3. 实现经过验证的创建/更新/归档命令，使用注入的时钟/ID 源，并具有明确的时间戳/幂等性行为。
4. 在同一应用工作单元中将重要的 Project 变更与 #30 来源追溯集成，并公开活动与已归档/所有列表筛选器。

## 验收标准

- [ ] Project 标题为必填项；描述和目的为可选字段，且往返不丢失。
- [ ] 更新保留 `created_at` 并推进 `updated_at`；归档设置 `archived_at` 而不删除。
- [ ] 活动列表排除已归档 Project，而明确的历史查询保留对它们的访问。
- [ ] Project 表只有内在字段，没有 Goal、工作流、生命周期、资源、关系或进度列。
- [ ] 创建、更新和归档与变更原子化地发出结构化来源追溯。
- [ ] 验证发生在应用/领域层，持久化模式不声明数据库外键。

## 测试

- 针对必填/可选值、更新、归档和重复归档的领域和命令测试。
- 针对最小/完整以及活动/已归档 Project 往返的仓库/查询约定测试。
- 时间戳和事务回滚测试，包括来源追溯失败。
- 针对精确 Project 列以及禁止字段/外键缺失的模式测试。

## 依赖

- 父级 Feature：#20。
- 依赖任务：定义 Goal 领域和持久化边界（获取约定）。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| keep | 保持 | keeping management relationships outside intrinsic storage |
| define | 定义 | Define Project identity and intrinsic fields |
| add | 添加 | Add the projects persistence mapping |
| implement | 实现 | Implement validated create/update/archive commands |
| integrate | 集成 | Integrate important Project mutations with #30 provenance |
| expose | 公开 | expose active versus archived/all list filters |
| retain | 保留 | explicit historical queries retain access |
| occur | 发生 | Validation occurs in the application/domain layer |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral model | 与框架无关的模型 | A framework-neutral Project model |
| intrinsic storage | 内在存储 | outside intrinsic storage |
| nullable archived_at | 可空的 archived_at | nullable archived_at |
| persistence mapping | 持久化映射 | projects persistence mapping |
| database foreign keys | 数据库外键 | no database foreign keys |
| timestamp/idempotency behavior | 时间戳/幂等性行为 | explicit timestamp/idempotency behavior |
| list filters | 列表筛选器 | archived/all list filters |
| forbidden fields | 禁止字段 | absence of forbidden fields |

### 值得模仿的句式
1. **"A create, update, archive, read, and list B while keeping C outside D."** — A 创建、更新、归档、读取和列出 B，同时将 C 保持在 D 之外。 — A framework-neutral Project model and application operations create, update, archive, read, and list Projects while keeping management relationships outside intrinsic storage.
2. **"A occurs in the B layer and the C declares no D."** — A 发生在 B 层，且 C 不声明 D。 — Validation occurs in the application/domain layer and the persistence schema declares no database foreign keys.
3. **"Active lists exclude A, while explicit B retain access to them."** — 活动列表排除 A，而明确的 B 保留对它们的访问。 — Active lists exclude archived Projects, while explicit historical queries retain access to them.

### 领域词汇
| English | 中文 |
|---|---|
| Project | 项目 |
| Intrinsic storage | 内在存储 |
| Persistence schema | 持久化模式 |
| Repository | 仓库 |
| Idempotency | 幂等性 |
| Provenance | 来源追溯 |
| Foreign key | 外键 |
| Timestamp | 时间戳 |
| Validation | 验证 |

---

## 4. 小练习

1. A framework-neutral Project model keeps management relationships ______ intrinsic storage.
2. Project has a required title and optional description and ______.
3. Create, update, and archive emit structured provenance ______ with the mutation.
4. The persistence schema declares no database foreign ______.
5. Active lists exclude archived Projects, while explicit ______ queries retain access.

<details>
<summary>点击查看答案</summary>

1. outside
2. purpose
3. atomically
4. keys
5. historical
</details>
