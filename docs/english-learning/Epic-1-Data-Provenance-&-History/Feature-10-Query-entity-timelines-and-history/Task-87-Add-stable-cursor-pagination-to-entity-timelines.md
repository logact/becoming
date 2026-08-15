# Issue #87: Task: Add stable cursor pagination to entity timelines

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Query entity timelines and history (#10)

---

## 1. Original English

Parent Feature: #10 — Feature: Query entity timelines and history

## Outcome

Entity timelines can be paged forward and backward across a filtered deterministic order without omissions or duplicates, and invalid or mismatched cursors fail explicitly.

## Implementation plan

1. Define an opaque, versioned cursor containing the full order key (`occurred_at`, `recorded_at`, Record ID), traversal direction, and a fingerprint of entity/filter/archive-visibility scope.
2. Implement keyset pagination over the composed timeline with explicit `first`/`after` and, if supported, `last`/`before` contracts and bounded page sizes.
3. Apply entity, category/record-type, time-window, and archive filters before the keyset boundary so page composition remains stable.
4. Reject malformed, unsupported-version, wrong-entity, wrong-filter, expired-by-contract, and incompatible-direction cursors with explicit application errors.
5. Return page metadata sufficient for consumers to continue without exposing database-specific offsets or framework types.

## Acceptance criteria

- [ ] Pagination uses the complete deterministic order key and does not rely on unstable offset pagination.
- [ ] Traversing all pages returns each matching event exactly once with no omissions or duplicates.
- [ ] Time-window and record-type/category filters remain combinable while paging.
- [ ] A cursor is bound to its entity, filter, ordering, and archive-visibility scope.
- [ ] Malformed, unsupported, or scope-mismatched cursors return explicit errors.
- [ ] Page-size limits and continuation metadata are documented and tested.

## Tests

- Property/integration-test multi-page traversal with identical timestamps, mixed categories, archived events, and page sizes of one and boundary maximum.
- Test combined filters across page boundaries and verify concatenated pages equal the unpaged deterministic result.
- Test insertion at order boundaries according to the documented consistency contract.
- Test tampered, truncated, wrong-version, wrong-entity, changed-filter, and wrong-direction cursors.

## Dependencies

- Parent Feature #10.
- Task: Compose complete entity timeline queries.

## Out of scope

- Snapshot isolation across indefinitely long interactive sessions unless the selected persistence architecture already provides it.
- Offset/page-number pagination.
- Timeline UI, exports, and cross-system analytics.

---

## 2. 中文翻译

父功能：#10 — 功能：查询实体时间线和历史

## 成果

实体时间线可以在过滤后的确定性顺序中前后分页，不会遗漏或重复，无效或不匹配的游标会显式失败。

## 实施计划

1. 定义一个不透明的、版本化的游标，包含完整排序键（`occurred_at`、`recorded_at`、记录 ID）、遍历方向以及实体/过滤器/归档可见性范围的指纹。
2. 在组合时间线上实现键集分页，使用显式的 `first`/`after` 以及（如果支持）`last`/`before` 合同和有界页面大小。
3. 在键集边界之前应用实体、类别/记录类型、时间窗口和归档过滤器，以保持页面组成稳定。
4. 以显式应用错误拒绝格式错误、不支持的版本、错误实体、错误过滤器、按合同过期和不兼容方向的游标。
5. 返回足够的页面元数据，使消费者可以继续，而不暴露数据库特定的偏移量或框架类型。

## 验收标准

- [ ] 分页使用完整的确定性排序键，不依赖不稳定的偏移分页。
- [ ] 遍历所有页面会返回每个匹配事件恰好一次，无遗漏或重复。
- [ ] 时间窗口和记录类型/类别过滤器在分页时保持可组合。
- [ ] 游标绑定到其实体、过滤器、排序和归档可见性范围。
- [ ] 格式错误、不支持或范围不匹配的游标返回显式错误。
- [ ] 页面大小限制和继续元数据有文档记录并经过测试。

## 测试

- 对相同时间戳、混合类别、归档事件以及页面大小为一和边界最大值进行属性/集成测试多页遍历。
- 测试跨页面边界的组合过滤器，并验证连接的页面等于未分页的确定性结果。
- 根据文档化的一致性合同测试在排序边界处插入。
- 测试被篡改、截断、错误版本、错误实体、已更改过滤器、错误方向的游标。

## 依赖

- 父功能 #10。
- 任务：组合完整实体时间线查询。

## 范围外

- 除非所选持久化架构已经提供，否则跨无限长交互会话的快照隔离。
- 偏移/页码分页。
- 时间线 UI、导出和跨系统分析。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| paginate | 分页 | Add stable cursor pagination to entity timelines. |
| traverse | 遍历 | Traversing all pages returns each matching event exactly once. |
| bind | 绑定 | A cursor is bound to its entity, filter, ordering, and archive-visibility scope. |
| reject | 拒绝 | Reject malformed, unsupported-version, wrong-entity cursors. |
| expose | 暴露 | ...without exposing database-specific offsets or framework types. |
| tamper | 篡改 | Test tampered, truncated, wrong-version cursors. |
| truncate | 截断 | Test tampered, truncated cursors. |
| remain | 保持 | Filters remain combinable while paging. |
| rely | 依赖 | Does not rely on unstable offset pagination. |
| continue | 继续 | Page metadata sufficient for consumers to continue. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| stable cursor pagination | 稳定的游标分页 | 使用游标的稳定分页方式 |
| entity timelines | 实体时间线 | 单个实体的历史时间线 |
| opaque cursor | 不透明游标 | 内部结构不公开的游标 |
| versioned cursor | 版本化游标 | 带有版本信息的游标 |
| order key | 排序键 | 用于排序的字段组合 |
| traversal direction | 遍历方向 | 向前或向后遍历 |
| fingerprint | 指纹 | 范围的标识签名 |
| keyset pagination | 键集分页 | 基于排序键的分页 |
| first/after | 向后取若干 | 游标分页参数 |
| last/before | 向前取若干 | 游标分页参数 |
| bounded page sizes | 有界页面大小 | 限制每页数量 |
| page metadata | 页面元数据 | 分页相关信息 |
| continuation metadata | 继续元数据 | 用于继续分页的信息 |
| offset pagination | 偏移分页 | 基于偏移量的分页 |

### 值得模仿的句式
1. **“Entity timelines can be paged forward and backward across a filtered deterministic order without omissions or duplicates...”** — 实体时间线可以在过滤后的确定性顺序中前后分页，不会遗漏或重复... — 例句：Search results can be paged forward and backward without omissions or duplicates.
2. **“...reject malformed, unsupported-version, wrong-entity, wrong-filter, expired-by-contract, and incompatible-direction cursors...”** — ...拒绝格式错误、不支持的版本、错误实体、错误过滤器、按合同过期和不兼容方向的游标... — 例句：Reject malformed, wrong-version, and expired tokens with explicit errors.
3. **“...without exposing database-specific offsets or framework types.”** — ...而不暴露数据库特定的偏移量或框架类型。 — 例句：Return opaque tokens without exposing database-specific offsets.

### 领域词汇
| English | 中文 |
|---|---|
| Cursor pagination | 游标分页 |
| Keyset pagination | 键集分页 |
| Opaque cursor | 不透明游标 |
| Versioned cursor | 版本化游标 |
| Order key | 排序键 |
| Traversal direction | 遍历方向 |
| Fingerprint | 指纹 |
| Page size | 页面大小 |
| Continuation metadata | 继续元数据 |
| Snapshot isolation | 快照隔离 |

---

## 4. 小练习

1. Entity timelines can be paged forward and backward across a filtered deterministic order without ______ or duplicates.
2. Define an opaque, ______ cursor containing the full order key, traversal direction, and a fingerprint of scope.
3. Implement ______ pagination over the composed timeline with explicit `first`/`after` contracts.
4. A cursor is ______ to its entity, filter, ordering, and archive-visibility scope.
5. Return page metadata sufficient for consumers to continue without exposing database-specific ______.

<details>
<summary>点击查看答案</summary>

1. omissions
2. versioned
3. keyset
4. bound
5. offsets

</details>
