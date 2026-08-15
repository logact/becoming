# Issue #86: Task: Compose complete entity timeline queries

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Query entity timelines and history (#10)

---

## 1. Original English

Parent Feature: #10 — Feature: Query entity timelines and history

## Outcome

A valid core entity can be queried for a complete, de-duplicated chronological stream of all supported event categories that directly or indirectly concern it.

## Implementation plan

1. Implement an application timeline query that first validates the declared type/ID against its independent core repository, including archived entities when authorized.
2. Compose candidate Record IDs from direct occurrence/provenance entity identity, semantic relations where the entity is either endpoint, lineage links, lifecycle payloads, and correction/origin/transformation references.
3. Fetch Records in batches, apply the unified event adapters, de-duplicate by immutable Record ID, and apply combined record-type/category and occurrence-time filters.
4. Sort by the contract's total order and project related logical references and historical archive status without requiring referenced current-state rows to remain active.
5. Define explicit errors for unknown entities, unsupported types, invalid time windows, and unsupported filters.

## Acceptance criteria

- [ ] A timeline can be requested using each valid core entity type and ID.
- [ ] Results include every supported mutation, relationship, lifecycle, origin/transformation, correction, and occurrence event that concerns the entity.
- [ ] Events discovered through multiple paths appear exactly once.
- [ ] Record-type/category and occurrence-time-window filters can be combined.
- [ ] Ordering follows the deterministic occurrence/recording/ID contract.
- [ ] Archived historical Records and archived related entities remain visible according to authorization rules.
- [ ] Unknown entities and invalid filters return explicit errors.

## Tests

- Build mixed-history integration fixtures for each of the eight core types spanning all supported event categories.
- Assert completeness, no duplicates, reference projection, combined filters, stable ordering, and archive visibility.
- Test unknown/archived entities under allowed and denied archive contexts, invalid types, and inverted/invalid time windows.
- Repository contract-test that batch composition avoids per-event lookup behavior where the selected persistence implementation can measure calls.

## Dependencies

- Parent Feature #10.
- Task: Define the unified entity timeline event contract.
- #60 — Task: Capture update, archive, and restoration provenance.
- #66 — Task: Query endpoint relationship history and replacements.
- #72 — Task: Query immediate sources and derivatives safely.
- #81 — Task: Query durable lifecycle audit history.

## Out of scope

- Cursor pagination, addressed by the next task.
- Arbitrary deep lineage analytics and cross-system event ingestion.
- UI-specific grouping or rendering.

---

## 2. 中文翻译

父功能：#10 — 功能：查询实体时间线和历史

## 成果

可以为有效核心实体查询完整、去重的、按时间顺序排列的所有支持事件类别流，这些事件直接或间接涉及该实体。

## 实施计划

1. 实现应用时间线查询，首先针对独立核心仓库验证声明的类型/ID，在授权时包括归档实体。
2. 从直接发生/来源实体标识、实体为任一端点的语义关系、谱系链接、生命周期载荷以及修正/来源/转换引用中组合候选记录 ID。
3. 批量获取记录，应用统一事件适配器，按不可变记录 ID 去重，并应用组合的记录类型/类别和发生时间过滤。
4. 按合同的总顺序排序，并投影相关逻辑引用和历史归档状态，而不要求引用的当前状态行保持活动。
5. 为未知实体、不支持的类型、无效时间窗口和不支持的过滤器定义显式错误。

## 验收标准

- [ ] 可以使用每个有效的核心实体类型和 ID 请求时间线。
- [ ] 结果包括涉及实体的每个支持的变更、关系、生命周期、来源/转换、修正和发生事件。
- [ ] 通过多条路径发现的事件只出现一次。
- [ ] 记录类型/类别和发生时间窗口过滤器可以组合。
- [ ] 排序遵循确定性的发生/记录/ID 合同。
- [ ] 根据授权规则，归档历史记录和归档相关实体保持可见。
- [ ] 未知实体和无效过滤器返回显式错误。

## 测试

- 为八种核心类型构建跨越所有支持事件类别的混合历史集成夹具。
- 断言完整性、无重复、引用投影、组合过滤器、稳定排序和归档可见性。
- 在允许和拒绝的归档上下文中测试未知/归档实体、无效类型和反向/无效时间窗口。
- 仓库合同测试批量组合避免每次事件查找行为，前提是所选持久化实现可以测量调用。

## 依赖

- 父功能 #10。
- 任务：定义统一实体时间线事件合同。
- #60 — 任务：捕获更新、归档和恢复来源。
- #66 — 任务：查询端点关系历史和替换。
- #72 — 任务：安全查询直接来源和派生。
- #81 — 任务：查询持久的生命周期审计历史。

## 范围外

- 游标分页，由下一任务解决。
- 任意深度谱系分析和跨系统事件摄取。
- UI 特定的分组或渲染。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| compose | 组合 | Compose complete entity timeline queries. |
| validate | 验证 | Validate the declared type/ID against its independent core repository. |
| include | 包含 | Including archived entities when authorized. |
| fetch | 获取 | Fetch Records in batches. |
| apply | 应用 | Apply the unified event adapters. |
| deduplicate | 去重 | De-duplicate by immutable Record ID. |
| sort | 排序 | Sort by the contract's total order. |
| project | 投影 | Project related logical references and historical archive status. |
| require | 要求 | ...without requiring referenced current-state rows to remain active. |
| span | 跨越 | Fixtures spanning all supported event categories. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| complete entity timeline queries | 完整实体时间线查询 | 查询实体的全部历史 |
| chronological stream | 按时间顺序的流 | 时间序列数据流 |
| de-duplicated | 去重的 | 移除重复项 |
| candidate Record IDs | 候选记录 ID | 可能相关的记录标识符 |
| semantic relations | 语义关系 | 带有业务含义的关系 |
| lineage links | 谱系链接 | 来源/派生链接 |
| lifecycle payloads | 生命周期载荷 | 生命周期事件的数据 |
| unified event adapters | 统一事件适配器 | 将记录转换为时间线事件的适配器 |
| total order | 总排序 | 完全确定的顺序 |
| logical references | 逻辑引用 | 通过 ID/类型引用 |
| historical archive status | 历史归档状态 | 记录是否已归档 |
| mixed-history fixtures | 混合历史夹具 | 包含多种事件类型的测试数据 |

### 值得模仿的句式
1. **“A valid core entity can be queried for a complete, de-duplicated chronological stream of all supported event categories...”** — 可以为有效核心实体查询完整、去重的、按时间顺序排列的所有支持事件类别流... — 例句：A valid order can be queried for a complete, de-duplicated chronological stream of status changes.
2. **“...events discovered through multiple paths appear exactly once.”** — ...通过多条路径发现的事件只出现一次。 — 例句：Events discovered through multiple paths appear exactly once in the result.
3. **“...without requiring referenced current-state rows to remain active.”** — ...而不要求引用的当前状态行保持活动。 — 例句：The query works without requiring referenced current-state rows to remain active.

### 领域词汇
| English | 中文 |
|---|---|
| Timeline query | 时间线查询 |
| Candidate record | 候选记录 |
| Event adapter | 事件适配器 |
| De-duplication | 去重 |
| Total order | 总排序 |
| Logical reference | 逻辑引用 |
| Archive status | 归档状态 |
| Integration fixture | 集成夹具 |
| Occurrence-time filter | 发生时间过滤器 |
| Reference projection | 引用投影 |

---

## 4. 小练习

1. A valid core entity can be queried for a complete, de-duplicated chronological ______ of all supported event categories.
2. We compose candidate Record IDs from direct occurrence identity, semantic relations, lineage links, and lifecycle ______.
3. Fetch Records in batches, apply unified event adapters, and de-duplicate by immutable Record ______.
4. Sort by the contract's total order and project related logical references and historical ______ status.
5. Cursor pagination is addressed by the next ______.

<details>
<summary>点击查看答案</summary>

1. stream
2. payloads
3. ID
4. archive
5. task

</details>
