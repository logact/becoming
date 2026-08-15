# Issue #57: Task: Query, classify, and link occurrence Records

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Record occurrences as first-class domain data (#6)

---

## 1. Original English

Parent Feature: #6 — Feature: Record occurrences as first-class domain data

## Outcome

Consumers can list occurrence Records by their independent event and recording times, include archived history when authorized, and use shared classification and semantic-relation capabilities without adding Record-specific relationship columns.

## Implementation plan

1. Add repository/application queries with deterministic ordering and filters for occurred-at ranges, recorded-at ranges, record type, actor, and archive visibility.
2. Integrate Record classification through the shared `labels`/`entity_labels` application boundary using `entity_type = record`, including application-level validation of the logical Record and Label references.
3. Integrate Record-to-core-concept linking through the shared `relations` application boundary, validating both endpoint types and IDs across the eight independent core tables.
4. Keep archived Records visible to authorized history callers while default operational queries follow an explicit archive-inclusion contract.

## Acceptance criteria

- [ ] Occurred-at and recorded-at ranges can be queried independently and combined with record-type filtering.
- [ ] Query ordering is deterministic and documented.
- [ ] Archived Records remain queryable when archive visibility is authorized.
- [ ] A Record can be classified through `entity_labels` and linked to any supported core concept through `relations`.
- [ ] Classification and relation links use logical application/domain validation, not database foreign keys or an `entities` table.
- [ ] Record storage is not extended with label IDs or entity-specific link columns.

## Tests

- Repository contract-test independent and combined time filters, record-type filters, stable ordering, and archive inclusion/exclusion.
- Integration-test assigning a Label to a Record and linking a Record to each supported endpoint type through shared services.
- Test unknown Record, Label, and relation endpoint errors and confirm no partial assignment/link remains.

## Dependencies

- Parent Feature #6.
- Task: Establish the Record domain model and persistence.
- Task: Preserve Record corrections and archival history.
- Feature #19 — Create and validate semantic relations.
- Feature #24 — Classify core entities with labels.

## Out of scope

- Cross-entity timeline aggregation and cursor pagination (Feature #10).
- Domain-specific relation semantics beyond the shared relation policy.
- Label hierarchy or label-based authorization.

---

## 2. 中文翻译

父功能：#6 — 功能：将发生记录作为一等领域数据

## 成果

消费者可以按独立的事件时间和记录时间列出发生记录，在授权时包含归档历史，并使用共享的分类和语义关系能力，而不添加特定于记录的关系列。

## 实施计划

1. 添加具有确定性排序的仓库/应用查询，并支持按发生时间范围、记录时间范围、记录类型、行为者和归档可见性过滤。
2. 通过共享的 `labels`/`entity_labels` 应用边界对记录进行分类，使用 `entity_type = record`，包括对逻辑记录和标签引用的应用级验证。
3. 通过共享的 `relations` 应用边界将记录链接到核心概念，验证八个独立核心表中的两个端点类型和 ID。
4. 使归档记录对授权历史调用者可见，同时默认操作查询遵循显式的归档包含合同。

## 验收标准

- [ ] 发生时间和记录时间范围可以独立查询，并与记录类型过滤组合。
- [ ] 查询排序是确定性的且有文档记录。
- [ ] 在授权归档可见性时，归档记录保持可查询。
- [ ] 记录可以通过 `entity_labels` 分类，并通过 `relations` 链接到任何支持的核心概念。
- [ ] 分类和关系链接使用逻辑应用/领域验证，而不是数据库外键或 `entities` 表。
- [ ] 记录存储不扩展标签 ID 或特定于实体的链接列。

## 测试

- 仓库合同测试独立和组合时间过滤、记录类型过滤、稳定排序以及归档包含/排除。
- 集成测试为记录分配标签，并通过共享服务将记录链接到每个支持的端点类型。
- 测试未知记录、标签和关系端点错误，并确认没有部分分配/链接残留。

## 依赖

- 父功能 #6。
- 任务：建立记录领域模型和持久化。
- 任务：保留记录修正和归档历史。
- 功能 #19 — 创建并验证语义关系。
- 功能 #24 — 用标签分类核心实体。

## 范围外

- 跨实体时间线聚合和游标分页（功能 #10）。
- 超出共享关系策略的领域特定关系语义。
- 标签层次结构或基于标签的授权。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| list | 列出 | Consumers can list occurrence Records by their independent event and recording times. |
| classify | 分类 | Integrate Record classification through the shared `labels` boundary. |
| link | 链接 | Link a Record to each supported endpoint type through shared services. |
| include | 包含 | Include archived history when authorized. |
| filter | 过滤 | Filters for occurred-at ranges, recorded-at ranges, record type, actor, and archive visibility. |
| validate | 验证 | Application-level validation of the logical Record and Label references. |
| remain | 保持 | Archived Records remain queryable when archive visibility is authorized. |
| combine | 组合 | Occurred-at and recorded-at ranges can be queried independently and combined. |
| extend | 扩展 | Record storage is not extended with label IDs or entity-specific link columns. |
| assign | 分配 | Assigning a Label to a Record. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| occurrence Records | 发生记录 | 记录实际发生事件的实体 |
| event time | 事件时间 | 事件发生的时间 |
| recording time | 记录时间 | 被写入系统的时间 |
| archive visibility | 归档可见性 | 归档数据是否可见 |
| deterministic ordering | 确定性排序 | 稳定、可重复的排序 |
| record type | 记录类型 | 记录的分类 |
| entity_labels | 实体标签关联表 | 标签与实体的关联 |
| entity_type = record | 实体类型为记录 | 指定标签关联的实体类型 |
| semantic relation | 语义关系 | 带有业务含义的关系 |
| logical validation | 逻辑验证 | 在应用/领域层进行的验证 |
| database foreign keys | 数据库外键 | 数据库级的外键约束 |

### 值得模仿的句式
1. **“Consumers can list occurrence Records by their independent event and recording times...”** — 消费者可以按独立的事件时间和记录时间列出发生记录... — 例句：Consumers can list tasks by their independent start and due times.
2. **“...without adding Record-specific relationship columns.”** — ...而不添加特定于记录的关系列。 — 例句：Keep the design clean without adding feature-specific relationship columns.
3. **“...validated in the application/domain layer rather than through database foreign keys.”** — ...在应用/领域层验证，而不是通过数据库外键。 — 例句：References are validated in the application layer rather than through database foreign keys.

### 领域词汇
| English | 中文 |
|---|---|
| Occurrence record | 发生记录 |
| Event time | 事件时间 |
| Recording time | 记录时间 |
| Archive visibility | 归档可见性 |
| Deterministic ordering | 确定性排序 |
| Entity label | 实体标签 |
| Semantic relation | 语义关系 |
| Logical validation | 逻辑验证 |
| Payload | 载荷 |
| Core concept | 核心概念 |

---

## 4. 小练习

1. Consumers can ______ occurrence Records by their independent event and recording times.
2. We integrate Record ______ through the shared `labels`/`entity_labels` application boundary.
3. Record-to-core-concept linking uses the shared `relations` application ______.
4. Classification and relation links use logical application/domain ______, not database foreign keys.
5. Record storage is not ______ with label IDs or entity-specific link columns.

<details>
<summary>点击查看答案</summary>

1. list
2. classification
3. boundary
4. validation
5. extended

</details>
