# Issue #10: Feature: Query entity timelines and history

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users and other capabilities can retrieve an understandable chronological history for any supported core entity.

## Scope

- Query Records directly or indirectly related to an entity.
- Include mutation, relationship, lifecycle, origin, and transformation events.
- Order events deterministically by occurrence and recording time.
- Support pagination and filters for event type and time window.
- Expose enough references for consumers to inspect related entities.

## Acceptance criteria

- A timeline can be requested by valid entity type and ID.
- Results include all supported event categories that concern the entity.
- Ordering is deterministic when multiple events share a timestamp.
- Time-window and record-type filters can be combined.
- Pagination does not omit or duplicate events.
- Archived historical data remains visible according to authorization rules.
- Unknown entities and invalid cursors return explicit errors.

## Dependencies

- Feature: Capture provenance for core entity mutations.
- Feature: Track relationship changes over time.
- Feature: Represent entity origins and transformations.
- Feature: Audit lifecycle state transitions.

## Out of scope

- Every possible audit-history user interface.
- Cross-system analytics.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户和其他能力可以检索任何支持的核心实体可理解的时间顺序历史。

## 范围

- 查询直接或间接与实体相关的记录。
- 包括变更、关系、生命周期、来源和转换事件。
- 按发生时间和记录时间确定性排序事件。
- 支持事件类型和时间窗口的分页和过滤。
- 暴露足够的引用，供消费者检查相关实体。

## 验收标准

- 可以通过有效的实体类型和 ID 请求时间线。
- 结果包括涉及实体的所有支持事件类别。
- 当多个事件共享时间戳时，排序是确定性的。
- 时间窗口和记录类型过滤器可以组合。
- 分页不会遗漏或重复事件。
- 归档历史数据根据授权规则保持可见。
- 未知实体和无效游标返回显式错误。

## 依赖

- 功能：为核心实体变更捕获来源信息。
- 功能：跟踪关系随时间的变化。
- 功能：表示实体来源和转换。
- 功能：审计生命周期状态转换。

## 范围外

- 所有可能的审计历史用户界面。
- 跨系统分析。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| retrieve | 检索 | Retrieve an understandable chronological history. |
| query | 查询 | Query Records directly or indirectly related to an entity. |
| include | 包含 | Include mutation, relationship, lifecycle, origin, and transformation events. |
| order | 排序 | Order events deterministically by occurrence and recording time. |
| support | 支持 | Support pagination and filters for event type and time window. |
| expose | 暴露 | Expose enough references for consumers to inspect related entities. |
| request | 请求 | A timeline can be requested by valid entity type and ID. |
| combine | 组合 | Time-window and record-type filters can be combined. |
| omit | 遗漏 | Pagination does not omit or duplicate events. |
| duplicate | 重复 | Pagination does not omit or duplicate events. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| entity timelines | 实体时间线 | 单个实体的历史时间线 |
| chronological history | 按时间顺序的历史 | 时间序列形式的历史 |
| event categories | 事件类别 | 不同类型的事件 |
| occurrence time | 发生时间 | 事件实际发生的时间 |
| recording time | 记录时间 | 事件被写入系统的时间 |
| deterministic ordering | 确定性排序 | 稳定、可重复的排序 |
| time-window filter | 时间窗口过滤器 | 按时间范围过滤 |
| record-type filter | 记录类型过滤器 | 按记录类型过滤 |
| pagination | 分页 | 将大量结果分成多页 |
| archive visibility | 归档可见性 | 归档数据是否可见 |
| explicit errors | 显式错误 | 明确的错误信息 |

### 值得模仿的句式
1. **“Users and other capabilities can retrieve an understandable chronological history for any supported core entity.”** — 用户和其他能力可以检索任何支持的核心实体可理解的时间顺序历史。 — 例句：Users can retrieve an understandable chronological history for any supported transaction.
2. **“Ordering is deterministic when multiple events share a timestamp.”** — 当多个事件共享时间戳时，排序是确定性的。 — 例句：Sorting is deterministic when multiple rows share the same score.
3. **“Pagination does not omit or duplicate events.”** — 分页不会遗漏或重复事件。 — 例句：Cursor pagination does not omit or duplicate records.

### 领域词汇
| English | 中文 |
|---|---|
| Entity timeline | 实体时间线 |
| Chronological history | 按时间顺序的历史 |
| Event category | 事件类别 |
| Deterministic ordering | 确定性排序 |
| Time-window filter | 时间窗口过滤器 |
| Record-type filter | 记录类型过滤器 |
| Pagination | 分页 |
| Archive visibility | 归档可见性 |
| Mutation event | 变更事件 |
| Cross-system analytics | 跨系统分析 |

---

## 4. 小练习

1. Users and other capabilities can retrieve an understandable chronological ______ for any supported core entity.
2. We query Records directly or indirectly ______ to an entity.
3. Events are ordered ______ by occurrence and recording time.
4. Time-window and record-type filters can be ______.
5. Pagination does not ______ or duplicate events.

<details>
<summary>点击查看答案</summary>

1. history
2. related
3. deterministically
4. combined
5. omit

</details>
