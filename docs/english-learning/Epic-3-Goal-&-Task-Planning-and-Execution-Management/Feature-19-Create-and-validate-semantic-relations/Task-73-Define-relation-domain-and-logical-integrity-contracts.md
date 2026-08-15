# Issue #73: Task: Define relation domain and logical integrity contracts

**Labels:** task  
**State:** CLOSED  
**Parent:** #19: Feature: Create and validate semantic relations

---

## 1. Original English

Parent Feature: #19 — Feature: Create and validate semantic relations

## Outcome

A framework-neutral Relation domain contract and persistence boundary represent directed, time-bounded semantic links among the eight core concepts without adding database foreign keys or relation fields to entity tables.

## Implementation plan

1. Define Relation identifiers, endpoint types, relation type, metadata, `created_at`, and nullable `ended_at` as domain values, preserving source-to-target direction exactly.
2. Add the `relations` persistence mapping and repository port for create/get operations using the schema in `Table-definetion.txt`; use logical UUID references only and no database foreign keys.
3. Define an endpoint-resolver registry for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record so the application/domain layer can prove an ID exists in its declared type.
4. Define a relation-policy registry that declares allowed endpoint pairs, direction, cardinality, and metadata validation per relation type without coupling policies to an HTTP framework, ORM, or database product.

## Acceptance criteria

- [ ] Only the eight supported core entity types can appear as endpoints.
- [ ] Source type/ID, relation type, target type/ID, metadata, and timestamps round-trip without direction changes.
- [ ] Both endpoint IDs are resolved through application/domain ports before a relation can be accepted.
- [ ] Relation policies can express allowed direction, endpoint types, active cardinality, and relation-specific metadata rules.
- [ ] The persistence mapping contains no database foreign keys and entity tables gain no relationship columns.
- [ ] Archived or missing endpoints produce explicit logical-validation errors rather than storage constraint errors.

## Tests

- Unit tests for endpoint-type parsing, direction preservation, policy selection, and invalid endpoint types.
- Repository contract tests for full metadata/direction/timestamp round trips.
- Schema tests proving no foreign keys and no relationship columns in entity tables.

## Dependencies

- Parent Feature: #19.
- Depends on persistence conventions established by V1 domain/bootstrap tasks.

---

## 2. 中文翻译

父级 Feature：#19 —— 创建并验证语义关系

## 结果

一个与框架无关的 Relation 领域约定和持久化边界表示八个核心概念之间定向、有时间边界的语义链接，且不会向实体表添加数据库外键或关系字段。

## 实施计划

1. 将 Relation 标识符、端点类型、关系类型、元数据、`created_at` 和可空的 `ended_at` 定义为领域值，并精确保留从源到目标的方向。
2. 根据 `Table-definetion.txt` 中的模式，添加 `relations` 持久化映射和用于创建/获取操作的仓库端口；仅使用逻辑 UUID 引用，不包含数据库外键。
3. 为 Task、Goal、Project、Idea、Philosophy、Workflow、Resource 和 Record 定义端点解析器注册表，使应用/领域层能够证明某个 ID 在其声明类型中存在。
4. 定义关系策略注册表，声明每种关系类型允许的端点对、方向、基数和元数据验证，且策略不与 HTTP 框架、ORM 或数据库产品耦合。

## 验收标准

- [ ] 只有八种支持的核心实体类型可以作为端点出现。
- [ ] 源类型/ID、关系类型、目标类型/ID、元数据和时间戳往返时不改变方向。
- [ ] 在关系被接受之前，两个端点 ID 都通过应用/领域端口解析。
- [ ] 关系策略可以表达允许的方向、端点类型、活动基数和关系特定的元数据规则。
- [ ] 持久化映射不包含数据库外键，实体表不增加关系列。
- [ ] 已归档或缺失的端点产生明确的逻辑验证错误，而不是存储约束错误。

## 测试

- 针对端点类型解析、方向保留、策略选择和无效端点类型的单元测试。
- 针对完整元数据/方向/时间戳往返的仓库约定测试。
- 证明实体表中没有外键和关系列的模式测试。

## 依赖

- 父级 Feature：#19。
- 依赖 V1 领域/引导任务建立的持久化约定。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| represent | 表示 | represent directed, time-bounded semantic links |
| preserve | 保留 | preserving source-to-target direction exactly |
| resolve | 解析 | endpoint IDs are resolved through application/domain ports |
| declare | 声明 | declares allowed endpoint pairs |
| couple | 耦合 | without coupling policies to an HTTP framework |
| produce | 产生 | produce explicit logical-validation errors |
| prove | 证明 | prove an ID exists in its declared type |
| gain | 获得、增加 | entity tables gain no relationship columns |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| logical integrity contract | 逻辑完整性约定 | logical integrity contracts |
| directed link | 定向链接 | directed semantic links |
| time-bounded | 有时间边界的 | time-bounded semantic links |
| source-to-target direction | 源到目标方向 | preserving source-to-target direction |
| endpoint resolver | 端点解析器 | endpoint-resolver registry |
| relation policy | 关系策略 | relation-policy registry |
| active cardinality | 活动基数 | active cardinality |
| storage constraint error | 存储约束错误 | storage constraint errors |

### 值得模仿的句式
1. **"A represent B among C without adding D to E."** — A 表示 C 之间的 B，且不会向 E 添加 D。 — A framework-neutral Relation domain contract and persistence boundary represent directed, time-bounded semantic links among the eight core concepts without adding database foreign keys or relation fields to entity tables.
2. **"A can prove B exists in its declared C."** — A 可以证明 B 在其声明的 C 中存在。 — The application/domain layer can prove an ID exists in its declared type.
3. **"A produce B rather than C."** — A 产生 B 而不是 C。 — Archived or missing endpoints produce explicit logical-validation errors rather than storage constraint errors.

### 领域词汇
| English | 中文 |
|---|---|
| Relation | 关系 |
| Endpoint | 端点 |
| Registry | 注册表 |
| Cardinality | 基数 |
| Metadata | 元数据 |
| Resolver | 解析器 |
| Logical validation | 逻辑验证 |
| Storage constraint | 存储约束 |
| Direction | 方向 |

---

## 4. 小练习

1. A framework-neutral Relation domain contract represents directed, ______-bounded semantic links.
2. Preserve source-to-______ direction exactly.
3. The endpoint-resolver registry can prove an ID exists in its declared ______.
4. Relation policies declare allowed endpoint pairs, direction, cardinality, and ______ validation.
5. Archived endpoints produce explicit ______-validation errors rather than storage constraint errors.

<details>
<summary>点击查看答案</summary>

1. time
2. target
3. type
4. metadata
5. logical
</details>
