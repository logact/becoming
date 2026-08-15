# Issue #53: Task: Establish the Record domain model and persistence

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Record occurrences as first-class domain data (#6)

---

## 1. Original English

Parent Feature: #6 — Feature: Record occurrences as first-class domain data

## Outcome

A Record can be created and retrieved through framework-neutral domain and application boundaries, backed by the independent `records` core table and validated consistently before persistence.

## Implementation plan

1. Define the Record domain model and value contracts for description, record type, occurred-at, recorded-at, optional actor, optional title, and structured JSON payload; make the supported record-type policy explicit and extensible.
2. Define application commands/queries and repository, clock, and ID-generation ports for creating and retrieving Records without coupling the domain to a web framework or ORM.
3. Add the `records` persistence mapping exactly as specified in `Table-definetion.txt`, including archival and audit timestamps, with no `entities` table and no database foreign keys.
4. Implement application/domain validation and explicit errors for missing required values, unsupported record types, malformed/non-serializable payloads, and unknown Record IDs.

## Acceptance criteria

- [ ] `records` is an independent core table with the documented columns and no entity, label, relation, lifecycle, or resource fields added to it.
- [ ] Creating a Record requires a non-empty description, supported record type, occurred-at time, and recorded-at time.
- [ ] Occurred-at and recorded-at are persisted independently and returned unchanged.
- [ ] Optional actor and structured payload values round-trip without loss.
- [ ] Invalid record types and malformed payloads produce explicit domain errors before persistence.
- [ ] The application-facing create/read behavior is usable without selecting an HTTP, UI, or serialization framework.

## Tests

- Unit-test required-field, record-type, timestamp, and payload validation.
- Repository contract-test create/get round trips, including independent timestamps, optional actor, nested JSON payload, and unknown IDs.
- Schema/migration-test the exact table shape and absence of database foreign keys or an `entities` table dependency.

## Dependencies

- Parent Feature #6.
- The repository foundation must select language, migration, and test tooling before implementation; this task defines framework-neutral boundaries and does not select a web framework.

## Out of scope

- Record corrections and archival behavior.
- Labels, semantic relation creation, and entity timeline aggregation.
- Automatic provenance capture for mutations.

---

## 2. 中文翻译

父功能：#6 — 功能：将发生记录作为一等领域数据

## 成果

记录可以通过与框架无关的领域和应用边界进行创建和检索，由独立的 `records` 核心表支持，并在持久化前经过一致验证。

## 实施计划

1. 为描述、记录类型、发生时间、记录时间、可选行为者、可选标题和结构化 JSON 载荷定义记录领域模型和价值约定；使支持的记录类型策略显式且可扩展。
2. 定义应用命令/查询以及仓库、时钟和 ID 生成端口，用于创建和检索记录，而不将领域与 Web 框架或 ORM 耦合。
3. 严格按照 `Table-definetion.txt` 添加 `records` 持久化映射，包括归档和审计时间戳，不使用 `entities` 表和数据库外键。
4. 为缺失必填值、不支持的记录类型、格式错误/不可序列化的载荷以及未知记录 ID 实现应用/领域验证和显式错误。

## 验收标准

- [ ] `records` 是独立的核心表，具有文档化的列，且不向其添加实体、标签、关系、生命周期或资源字段。
- [ ] 创建记录需要非空描述、支持的记录类型、发生时间和记录时间。
- [ ] 发生时间和记录时间被独立持久化并原样返回。
- [ ] 可选的行为者和结构化载荷值往返无丢失。
- [ ] 无效记录类型和格式错误载荷在持久化前产生显式领域错误。
- [ ] 应用层面的创建/读取行为无需选择 HTTP、UI 或序列化框架即可使用。

## 测试

- 对必填字段、记录类型、时间戳和载荷验证进行单元测试。
- 对创建/获取往返进行仓库合同测试，包括独立时间戳、可选行为者、嵌套 JSON 载荷和未知 ID。
- 对精确表形状以及不存在数据库外键或 `entities` 表依赖进行模式/迁移测试。

## 依赖

- 父功能 #6。
- 仓库基础必须首先选择语言、迁移和测试工具；本任务定义与框架无关的边界，不选择 Web 框架。

## 范围外

- 记录修正和归档行为。
- 标签、语义关系创建和实体时间线聚合。
- 变更的自动来源捕获。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| establish | 建立 | Establish the Record domain model and persistence. |
| define | 定义 | Define the Record domain model and value contracts. |
| back | 支持 | Backed by the independent `records` core table. |
| validate | 验证 | Validated consistently before persistence. |
| persist | 持久化 | Occurred-at and recorded-at are persisted independently. |
| return | 返回 | ...and returned unchanged. |
| reject | 拒绝 | Invalid record types and malformed payloads produce explicit domain errors. |
| cover | 覆盖 | Repository contract-test create/get round trips. |
| couple | 耦合 | ...without coupling the domain to a web framework or ORM. |
| implement | 实现 | Implement application/domain validation and explicit errors. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| Record domain model | 记录领域模型 | 记录实体的领域层模型 |
| persistence boundary | 持久化边界 | 领域与持久化之间的接口 |
| value contracts | 值约定 | 对值类型的约束和约定 |
| record type | 记录类型 | 记录的分类 |
| occurred-at / recorded-at | 发生时间 / 记录时间 | 时间戳字段 |
| framework-neutral | 与框架无关的 | 不依赖特定框架 |
| web framework | Web 框架 | 用于构建 Web 应用的框架 |
| ORM | 对象关系映射 | Object-Relational Mapping |
| persistence mapping | 持久化映射 | 领域对象到数据库表的映射 |
| archival timestamp | 归档时间戳 | 归档时间字段 |
| audit timestamp | 审计时间戳 | 审计时间字段 |
| required-field validation | 必填字段验证 | 验证必填字段 |
| malformed payload | 格式错误的载荷 | 不符合格式的数据载荷 |

### 值得模仿的句式
1. **“A Record can be created and retrieved through framework-neutral domain and application boundaries...”** — 记录可以通过与框架无关的领域和应用边界进行创建和检索... — 例句：A task can be created and retrieved through framework-neutral domain and application boundaries.
2. **“...backed by the independent `records` core table...”** — ...由独立的 `records` 核心表支持... — 例句：The service is backed by the independent `events` core table.
3. **“...without coupling the domain to a web framework or ORM.”** — ...而不将领域与 Web 框架或 ORM 耦合。 — 例句：Design ports without coupling the domain to a web framework or ORM.

### 领域词汇
| English | 中文 |
|---|---|
| Domain model | 领域模型 |
| Persistence boundary | 持久化边界 |
| Value contract | 值约定 |
| Framework-neutral | 与框架无关的 |
| ORM | 对象关系映射 |
| Persistence mapping | 持久化映射 |
| Audit timestamp | 审计时间戳 |
| Archival timestamp | 归档时间戳 |
| Round-trip | 往返 |
| Schema/migration test | 模式/迁移测试 |

---

## 4. 小练习

1. A Record can be created and retrieved through framework-neutral domain and application ______.
2. The Record is backed by the independent `records` core ______.
3. We define application commands/queries without coupling the domain to a web framework or ______.
4. Invalid record types and malformed payloads produce explicit ______ errors before persistence.
5. The schema/migration test verifies the absence of database foreign keys or an `entities` table ______.

<details>
<summary>点击查看答案</summary>

1. boundaries
2. table
3. ORM
4. domain
5. dependency

</details>
