# Issue #94: Task: Implement Task domain, persistence, and mutations

**Labels:** task  
**State:** CLOSED  
**Parent:** #18: Feature: Manage tasks and project membership

---

## 1. Original English

Parent Feature: #18 — Feature: Manage tasks and project membership

## Outcome

A framework-neutral Task domain model and application operations persist only intrinsic executable-work data and create, update, archive, read, and list Tasks with provenance.

## Implementation plan

1. Define Task identity and intrinsic fields for required title and target description; optional description, exit criteria, and priority; and create/update/archive timestamps.
2. Define and enforce the application-level priority contract when supplied, without embedding transport-specific parsing in the domain.
3. Add the `tasks` persistence mapping, repository, and query ports with no project, goal, workflow, state, label, deadline, budget, allocation, dependency, or resource columns and no database foreign keys.
4. Implement validated create/update/archive plus active/archived listing, preserving timestamp semantics and emitting structured mutation provenance atomically.

## Acceptance criteria

- [ ] Title and target description are required; invalid values persist nothing.
- [ ] Description, exit criteria, and priority are optional and round-trip without loss when valid.
- [ ] Updates preserve `created_at` and advance `updated_at`; archive sets `archived_at` without deletion.
- [ ] Active lists exclude archived Tasks while explicit historical/all queries can include them.
- [ ] The Task table has no membership, lifecycle, workflow, label, deadline, budget, dependency, allocation, or resource columns.
- [ ] Important create, update, and archive mutations emit structured provenance in the same unit of work.
- [ ] All logical validation is application/domain-owned and the schema declares no database foreign keys.

## Tests

- Domain/command tests for required fields, every optional field, priority boundaries, update, archive, and repeated archive.
- Repository/query contract tests for minimal/full and active/archived round trips.
- Timestamp and transaction rollback tests, including provenance failure.
- Schema tests for exact Task columns and absence of forbidden fields/foreign keys.

## Dependencies

- Parent Feature: #18.
- Depends on Task: Define Goal domain and persistence boundary for timestamp and validation conventions.

---

## 2. 中文翻译

父级 Feature：#18 —— 管理任务与项目成员关系

## 结果

一个与框架无关的 Task 领域模型和应用操作仅持久化内在的可执行工作数据，并使用来源追溯创建、更新、归档、读取和列出 Task。

## 实施计划

1. 定义 Task 的标识以及内在字段：必需的标题和目标描述；可选的描述、退出条件和优先级；以及创建/更新/归档时间戳。
2. 定义并在提供时强制执行应用层优先级约定，同时避免在领域层嵌入特定传输层的解析逻辑。
3. 添加 `tasks` 持久化映射、仓库和查询端口，不包含项目、目标、工作流、状态、标签、截止日期、预算、分配、依赖或资源列，也不包含数据库外键。
4. 实现经过验证的创建/更新/归档以及活动/已归档列表，保留时间戳语义并原子化地发出结构化变更来源追溯。

## 验收标准

- [ ] 标题和目标描述为必填项；无效值不会持久化任何内容。
- [ ] 描述、退出条件和优先级为可选字段，有效时往返不丢失。
- [ ] 更新保留 `created_at` 并推进 `updated_at`；归档设置 `archived_at` 而不删除。
- [ ] 活动列表排除已归档 Task，而明确的历史/所有查询可以包含它们。
- [ ] Task 表没有成员关系、生命周期、工作流、标签、截止日期、预算、依赖、分配或资源列。
- [ ] 重要的创建、更新和归档变更在同一工作单元中发出结构化来源追溯。
- [ ] 所有逻辑验证由应用/领域层拥有，模式不声明数据库外键。

## 测试

- 针对必填字段、每个可选字段、优先级边界、更新、归档和重复归档的领域/命令测试。
- 针对最小/完整以及活动/已归档往返的仓库/查询约定测试。
- 时间戳和事务回滚测试，包括来源追溯失败。
- 针对精确 Task 列以及禁止字段/外键缺失的模式测试。

## 依赖

- 父级 Feature：#18。
- 依赖任务：定义 Goal 领域和持久化边界（获取时间戳和验证约定）。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| persist | 持久化 | persist only intrinsic executable-work data |
| enforce | 强制执行 | enforce the application-level priority contract |
| embed | 嵌入 | without embedding transport-specific parsing |
| emit | 发出 | emitting structured mutation provenance atomically |
| preserve | 保留 | preserving timestamp semantics |
| exclude | 排除 | Active lists exclude archived Tasks |
| declare | 声明 | the schema declares no database foreign keys |
| validate | 验证 | validated create/update/archive |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral | 与框架无关的 | A framework-neutral Task domain model |
| intrinsic data | 内在数据 | intrinsic executable-work data |
| executable-work data | 可执行工作数据 | executable-work data |
| application-level contract | 应用层约定 | application-level priority contract |
| transport-specific parsing | 特定传输层解析 | transport-specific parsing |
| database foreign keys | 数据库外键 | no database foreign keys |
| forbidden fields | 禁止字段 | absence of forbidden fields |
| priority boundaries | 优先级边界 | priority boundaries |

### 值得模仿的句式
1. **"A and B persist only C and D with E."** — A 和 B 仅持久化 C 和 D，并带有 E。 — A framework-neutral Task domain model and application operations persist only intrinsic executable-work data and create, update, archive, read, and list Tasks with provenance.
2. **"All logical validation is ...-owned and the schema declares no ..."** — 所有逻辑验证由……拥有，且模式不声明…… — All logical validation is application/domain-owned and the schema declares no database foreign keys.
3. **"Active lists exclude A while explicit B can include them."** — 活动列表排除 A，而明确的 B 可以包含它们。 — Active lists exclude archived Tasks while explicit historical/all queries can include them.

### 领域词汇
| English | 中文 |
|---|---|
| Task | 任务 |
| Domain model | 领域模型 |
| Repository | 仓库 |
| Persistence mapping | 持久化映射 |
| Priority | 优先级 |
| Exit criteria | 退出条件 |
| Timestamp | 时间戳 |
| Foreign key | 外键 |
| Provenance | 来源追溯 |

---

## 4. 小练习

1. The Task domain model persists only intrinsic ______-work data.
2. Define and enforce the application-level ______ contract when supplied.
3. The tasks mapping has no project, goal, or ______ columns.
4. Updates preserve created_at and ______ updated_at.
5. All logical validation is application/______-owned.

<details>
<summary>点击查看答案</summary>

1. executable
2. priority
3. resource
4. advance
5. domain
</details>
