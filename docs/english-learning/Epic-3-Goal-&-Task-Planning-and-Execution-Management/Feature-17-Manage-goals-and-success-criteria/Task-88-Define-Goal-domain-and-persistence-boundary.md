# Issue #88: Task: Define Goal domain and persistence boundary

**Labels:** task  
**State:** CLOSED  
**Parent:** #17: Feature: Manage goals and success criteria

---

## 1. Original English

Parent Feature: #17 — Feature: Manage goals and success criteria

## Outcome

A framework-neutral Goal domain model and persistence boundary store only intrinsic Goal data with explicit validation and archive timestamps.

## Implementation plan

1. Define Goal identity and fields for title, optional description, target state, optional success criteria, `created_at`, `updated_at`, and nullable `archived_at`.
2. Enforce non-empty title and target state through domain constructors/update values while preserving optional text verbatim.
3. Add the `goals` persistence mapping and repository contract for insert, get, update, and archive using logical UUIDs and the schema in `Table-definetion.txt`.
4. Keep project membership, hierarchy, workflow, lifecycle state, labels, resources, and target dates outside the Goal aggregate and table.

## Acceptance criteria

- [ ] A Goal cannot be constructed or persisted without a valid title and target state.
- [ ] Description and success criteria are optional and round-trip without trimming or lossy transformation beyond the documented input contract.
- [ ] The Goal mapping contains exactly intrinsic Goal fields and no project, hierarchy, workflow, state, label, or resource columns.
- [ ] `created_at`, `updated_at`, and nullable `archived_at` are represented explicitly.
- [ ] Repository operations use application/domain validation and declare no database foreign keys.
- [ ] The contract is independent of an HTTP framework, ORM, or database product.

## Tests

- Unit tests for required fields, optional values, and update-value validation.
- Repository contract tests for complete and minimal Goal round trips.
- Schema/migration tests for exact columns, timestamp nullability, and absence of forbidden columns and database foreign keys.

## Dependencies

- Parent Feature: #17.
- Use the repository's selected language and persistence conventions when established; this task does not select a framework.

---

## 2. 中文翻译

父级 Feature：#17 —— 管理目标与成功标准

## 结果

一个与框架无关的 Goal 领域模型和持久化边界，仅存储 Goal 的内在数据，并包含明确的验证和归档时间戳。

## 实施计划

1. 定义 Goal 的标识以及标题、可选描述、目标状态、可选成功标准、`created_at`、`updated_at` 和可空的 `archived_at` 等字段。
2. 通过领域构造函数/更新值强制要求非空标题和目标状态，同时保留可选文本原样。
3. 根据 `Table-definetion.txt` 中的模式，添加 `goals` 持久化映射和仓库约定，使用逻辑 UUID 进行插入、获取、更新和归档。
4. 将项目成员关系、层级结构、工作流、生命周期状态、标签、资源以及目标日期保持在 Goal 聚合和表之外。

## 验收标准

- [ ] Goal 没有有效标题和目标状态时无法构造或持久化。
- [ ] 描述和成功标准是可选的，除文档化的输入约定外，不会经过裁剪或破坏性转换。
- [ ] Goal 映射仅包含 Goal 内在字段，不包含项目、层级、工作流、状态、标签或资源列。
- [ ] `created_at`、`updated_at` 和可空的 `archived_at` 被显式表示。
- [ ] 仓库操作使用应用/领域验证，不声明数据库外键。
- [ ] 该约定独立于 HTTP 框架、ORM 或数据库产品。

## 测试

- 对必填字段、可选值和更新值验证进行单元测试。
- 对完整和最小 Goal 往返进行仓库约定测试。
- 对精确列、时间戳可空性以及禁止列和数据库外键缺失情况进行模式/迁移测试。

## 依赖

- 父级 Feature：#17。
- 使用仓库选定的语言和持久化约定（如果已确定）；本任务不选择框架。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define Goal identity and fields |
| enforce | 强制执行 | Enforce non-empty title and target state |
| preserve | 保留 | preserving optional text verbatim |
| add | 添加 | Add the goals persistence mapping |
| keep | 保持、使……不进入 | Keep project membership outside the Goal aggregate |
| construct | 构造 | A Goal cannot be constructed without a valid title |
| round-trip | 往返 | Description and success criteria round-trip without trimming |
| declare | 声明 | declare no database foreign keys |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral | 与框架无关的 | A framework-neutral Goal domain model |
| persistence boundary | 持久化边界 | persistence boundary store only intrinsic Goal data |
| archive timestamps | 归档时间戳 | explicit validation and archive timestamps |
| non-empty title | 非空标题 | Enforce non-empty title and target state |
| domain constructors | 领域构造函数 | through domain constructors/update values |
| logical UUIDs | 逻辑 UUID | using logical UUIDs |
| database foreign keys | 数据库外键 | no database foreign keys |
| input contract | 输入约定 | documented input contract |

### 值得模仿的句式
1. **"A framework-neutral X domain model and Y boundary store only ..."** — 一个与框架无关的 X 领域模型和 Y 边界仅存储…… — A framework-neutral Goal domain model and persistence boundary store only intrinsic Goal data.
2. **"A cannot be constructed or persisted without ..."** — 没有……就不能构造或持久化 A。 — A Goal cannot be constructed or persisted without a valid title and target state.
3. **"All logical validation is ...-owned and the schema declares no ..."** — 所有逻辑验证由……拥有，且模式不声明…… — Repository operations use application/domain validation and declare no database foreign keys.

### 领域词汇
| English | 中文 |
|---|---|
| Domain model | 领域模型 |
| Persistence boundary | 持久化边界 |
| Repository | 仓库 |
| UUID | 通用唯一识别码 |
| Aggregate | 聚合 |
| Schema | 模式/Schema |
| Foreign key | 外键 |
| ORM | 对象关系映射 |
| Unit of work | 工作单元 |

---

## 4. 小练习

1. A ______-neutral Goal domain model stores only intrinsic Goal data.
2. Enforce a non-empty title and target state through domain ______.
3. Repository operations use application/domain validation and declare no database foreign ______.
4. The goals mapping uses logical ______ and the schema in Table-definetion.txt.
5. Keep project membership, hierarchy, and workflow ______ the Goal aggregate.

<details>
<summary>点击查看答案</summary>

1. framework
2. constructors
3. keys
4. UUIDs
5. outside
</details>
