# Issue #75: Task: Query current and historical semantic relations

**Labels:** task  
**State:** CLOSED  
**Parent:** #19: Feature: Create and validate semantic relations

---

## 1. Original English

Parent Feature: #19 — Feature: Create and validate semantic relations

## Outcome

Callers can inspect active and historical semantic relationships from either endpoint with deterministic filters and explicit temporal semantics.

## Implementation plan

1. Define a framework-neutral relation query port and result contract that preserves typed source, relation type, typed target, metadata, `created_at`, and `ended_at`.
2. Implement filters for source endpoint, target endpoint, relation type, active/ended status, and a documented point-in-time or time-range predicate.
3. Provide current helpers that select rows with `ended_at IS NULL` and historical helpers that retain ended rows; do not infer state by deleting or rewriting relations.
4. Add deterministic ordering and pagination/tie-breaking so the same relation set cannot produce unstable traversal inputs.

## Acceptance criteria

- [ ] Queries work from either a typed source or typed target and preserve relation direction in results.
- [ ] Source, target, relation type, active status, and time filters can be combined.
- [ ] Current queries include only active rows, while historical queries can include ended rows and their original metadata.
- [ ] Point-in-time semantics use `created_at` and `ended_at` consistently and are documented at boundary timestamps.
- [ ] Query results are deterministically ordered and do not promote relationship metadata into entity fields.
- [ ] Missing logical endpoints or malformed stored endpoint types are surfaced as integrity anomalies where hydration requires them.

## Tests

- Repository/query contract tests for every filter alone and in representative combinations.
- Boundary tests at exact create/end timestamps and tests for active, ended, and replaced relationships.
- Direction tests querying the same row from source and target.
- Ordering and pagination stability tests with equal timestamps.

## Dependencies

- Parent Feature: #19.
- Depends on Task: Implement policy-validated relation create and end operations.

---

## 2. 中文翻译

父级 Feature：#19 —— 创建并验证语义关系

## 结果

调用方可以从任一端点检查活动和历史的语义关系，具有确定性的筛选器和明确的时间语义。

## 实施计划

1. 定义与框架无关的关系查询端口和结果约定，保留带类型的源、关系类型、带类型的目标、元数据、`created_at` 和 `ended_at`。
2. 实现针对源端点、目标端点、关系类型、活动/已结束状态以及文档化的时间点或时间范围谓词的筛选器。
3. 提供选择 `ended_at IS NULL` 行的当前辅助函数，以及保留已结束行的历史辅助函数；不要通过删除或重写关系来推断状态。
4. 添加确定性排序和分页/断点，使同一关系集不会产生不稳定的遍历输入。

## 验收标准

- [ ] 查询可以从带类型的源或目标进行，并在结果中保留关系方向。
- [ ] 源、目标、关系类型、活动状态和时间筛选器可以组合使用。
- [ ] 当前查询仅包含活动行，而历史查询可以包含已结束行及其原始元数据。
- [ ] 时间点语义一致使用 `created_at` 和 `ended_at`，并在边界时间戳上形成文档。
- [ ] 查询结果是确定性排序的，不会将关系元数据提升到实体字段。
- [ ] 缺失的逻辑端点或格式错误的存储端点类型会在需要水合时被呈现为完整性异常。

## 测试

- 针对每个单独筛选器及其代表性组合的仓库/查询约定测试。
- 在精确创建/结束时间戳处的边界测试，以及活动、已结束和已替换关系的测试。
- 从源和目标查询同一行的方向测试。
- 时间戳相等时的排序和分页稳定性测试。

## 依赖

- 父级 Feature：#19。
- 依赖任务：实现策略验证的关系创建和结束操作。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查 | inspect active and historical semantic relationships |
| preserve | 保留 | preserve relation direction in results |
| combine | 组合 | filters can be combined |
| retain | 保留 | historical helpers that retain ended rows |
| infer | 推断 | do not infer state by deleting or rewriting |
| promote | 提升 | do not promote relationship metadata into entity fields |
| surface | 呈现 | surfaced as integrity anomalies |
| hydrate | 水合 | where hydration requires them |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| temporal semantics | 时间语义 | explicit temporal semantics |
| point-in-time | 时间点 | point-in-time predicate |
| time-range predicate | 时间范围谓词 | time-range predicate |
| active/ended status | 活动/已结束状态 | active/ended status filters |
| boundary timestamp | 边界时间戳 | documented at boundary timestamps |
| pagination tie-breaking | 分页断点 | pagination/tie-breaking |
| integrity anomaly | 完整性异常 | integrity anomalies |
| representative combination | 代表性组合 | representative combinations |

### 值得模仿的句式
1. **"Callers can inspect A and B from either C with D and E."** — 调用方可以从任一 C 检查 A 和 B，并带有 D 和 E。 — Callers can inspect active and historical semantic relationships from either endpoint with deterministic filters and explicit temporal semantics.
2. **"Do not infer A by B or C."** — 不要通过 B 或 C 来推断 A。 — Do not infer state by deleting or rewriting relations.
3. **"A are surfaced as B where C requires them."** — 在需要 C 的地方，A 会被呈现为 B。 — Missing logical endpoints or malformed stored endpoint types are surfaced as integrity anomalies where hydration requires them.

### 领域词汇
| English | 中文 |
|---|---|
| Semantic relationship | 语义关系 |
| Temporal semantics | 时间语义 |
| Predicate | 谓词 |
| Hydration | 水合 |
| Anomaly | 异常 |
| Pagination | 分页 |
| Tie-breaking | 断点 |
| Boundary timestamp | 边界时间戳 |
| Source/Target | 源/目标 |

---

## 4. 小练习

1. Callers can inspect active and historical semantic relationships from either ______.
2. Current helpers select rows with ended_at IS ______.
3. Do not infer state by deleting or ______ relations.
4. Query results are deterministically ______.
5. Missing logical endpoints are surfaced as integrity ______.

<details>
<summary>点击查看答案</summary>

1. endpoint
2. NULL
3. rewriting
4. ordered
5. anomalies
</details>
