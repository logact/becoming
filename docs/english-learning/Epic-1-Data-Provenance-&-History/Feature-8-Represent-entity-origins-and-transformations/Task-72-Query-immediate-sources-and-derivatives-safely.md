# Issue #72: Task: Query immediate sources and derivatives safely

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Represent entity origins and transformations (#8)

---

## 1. Original English

Parent Feature: #8 — Feature: Represent entity origins and transformations

## Outcome

Consumers can retrieve an entity's immediate active or historical sources and derivatives in either direction, with stable results and safe bounded traversal behavior.

## Implementation plan

1. Define application queries for immediate sources (incoming canonical lineage) and immediate derivatives (outgoing canonical lineage) by valid core entity type and ID.
2. Support filters for lineage relation type, active/historical status, and time window while returning endpoint references, relation temporal values, and transformation metadata.
3. Use stable ordering and a bounded traversal utility with a visited set for any shared traversal path, even though the V1 public result is immediate neighbors.
4. Return explicit errors for unknown entities, invalid limits/cursors if pagination is exposed, and policy-invalid query inputs.
5. Retain ended links in historical results and expose their relation-change audit references.

## Acceptance criteria

- [ ] A consumer can retrieve immediate sources and immediate derivatives for a valid supported core entity.
- [ ] Results preserve lineage direction and include related entity type/ID, relation type, metadata, `created_at`, and `ended_at`.
- [ ] Active/historical and relation-type filters can be combined with deterministic ordering.
- [ ] Ended lineage remains historically queryable from either endpoint.
- [ ] Traversal cannot loop indefinitely; bounded/visited-set behavior is tested against cyclic legacy data.
- [ ] Unknown entities and invalid query inputs return explicit application/domain errors.

## Tests

- Repository/application contract-test incoming/outgoing immediate queries, combined filters, stable ordering, and ended history.
- Test multiple sources and derivatives across supported types and exact metadata round trips.
- Seed cyclic legacy data and assert bounded, duplicate-safe termination.
- Test unknown entities and invalid bounds/cursors without partial effects.

## Dependencies

- Parent Feature #8.
- Task: Create and end lineage links with provenance.
- #66 — Task: Query endpoint relationship history and replacements.

## Out of scope

- Arbitrary-depth lineage analytics or transitive closure in V1.
- Timeline aggregation across event categories (Feature #10).
- Visualization.

---

## 2. 中文翻译

父功能：#8 — 功能：表示实体来源和转换

## 成果

消费者可以检索实体在任何方向的直接活动或历史来源和派生，具有稳定结果和安全的囿界遍历行为。

## 实施计划

1. 按有效的核心实体类型和 ID 定义直接来源（入向规范谱系）和直接派生（出向规范谱系）的应用查询。
2. 支持按谱系关系类型、活动/历史状态和时间窗口过滤，同时返回端点引用、关系时间值和转换元数据。
3. 使用稳定排序和囿界遍历工具，并带已访问集合，用于任何共享遍历路径，即使 V1 公共结果是直接邻居。
4. 对未知实体、无效限制/游标（如果暴露分页）和策略无效查询输入返回显式错误。
5. 在历史结果中保留已结束链接，并暴露其关系变更审计引用。

## 验收标准

- [ ] 消费者可以为有效的支持核心实体检索直接来源和直接派生。
- [ ] 结果保留谱系方向，并包含相关实体类型/ID、关系类型、元数据、`created_at` 和 `ended_at`。
- [ ] 活动/历史和关系类型过滤器可以组合，并带有确定性排序。
- [ ] 已结束谱系保持可从任一端点历史查询。
- [ ] 遍历不能无限循环；针对循环遗留数据测试囿界/已访问集合行为。
- [ ] 未知实体和无效查询输入返回显式应用/领域错误。

## 测试

- 仓库/应用合同测试入向/出向直接查询、组合过滤器、稳定排序和已结束历史。
- 测试跨支持类型的多个来源和派生以及精确的元数据往返。
- 播种循环遗留数据并断言囿界、去重终止。
- 测试未知实体和无效边界/游标，无部分影响。

## 依赖

- 父功能 #8。
- 任务：创建和结束带来源的谱系链接。
- #66 — 任务：查询端点关系历史和替换。

## 范围外

- V1 中的任意深度谱系分析或传递闭包。
- 跨事件类别的时间线聚合（功能 #10）。
- 可视化。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| retrieve | 检索 | Consumers can retrieve an entity's immediate sources and derivatives. |
| support | 支持 | Support filters for lineage relation type, active/historical status, and time window. |
| return | 返回 | Return endpoint references, relation temporal values, and transformation metadata. |
| preserve | 保留 | Results preserve lineage direction. |
| expose | 暴露 | Expose their relation-change audit references. |
| loop | 循环 | Traversal cannot loop indefinitely. |
| seed | 播种 | Seed cyclic legacy data and assert bounded termination. |
| terminate | 终止 | Assert bounded, duplicate-safe termination. |
| combine | 组合 | Active/historical and relation-type filters can be combined. |
| remain | 保持 | Ended lineage remains historically queryable. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| immediate sources | 直接来源 | 实体的直接上游 |
| immediate derivatives | 直接派生 | 实体的直接下游产物 |
| stable results | 稳定结果 | 一致、可重复的查询结果 |
| bounded traversal | 囿界遍历 | 限制深度的遍历 |
| visited set | 已访问集合 | 遍历时记录已访问节点 |
| incoming/outgoing lineage | 入向/出向谱系 | 来源/派生方向 |
| core entity type | 核心实体类型 | 支持的核心实体种类 |
| time window | 时间窗口 | 查询的时间范围 |
| endpoint references | 端点引用 | 关系端点的标识 |
| temporal values | 时间值 | 时间戳字段值 |
| cyclic legacy data | 循环遗留数据 | 历史上形成的循环数据 |

### 值得模仿的句式
1. **“Consumers can retrieve an entity's immediate active or historical sources and derivatives in either direction...”** — 消费者可以检索实体在任何方向的直接活动或历史来源和派生... — 例句：Consumers can retrieve a project's immediate active and historical tasks in either view.
2. **“...with stable results and safe bounded traversal behavior.”** — ...具有稳定结果和安全的囿界遍历行为。 — 例句：The query returns stable results and safe bounded traversal behavior.
3. **“Traversal cannot loop indefinitely; bounded/visited-set behavior is tested against cyclic legacy data.”** — 遍历不能无限循环；针对循环遗留数据测试囿界/已访问集合行为。 — 例句：Graph traversal cannot loop indefinitely; bounded behavior is tested against cyclic data.

### 领域词汇
| English | 中文 |
|---|---|
| Immediate source | 直接来源 |
| Immediate derivative | 直接派生 |
| Bounded traversal | 囿界遍历 |
| Visited set | 已访问集合 |
| Cyclic legacy data | 循环遗留数据 |
| Temporal values | 时间值 |
| Transformation metadata | 转换元数据 |
| Lineage direction | 谱系方向 |
| Transitive closure | 传递闭包 |
| Pagination | 分页 |

---

## 4. 小练习

1. Consumers can retrieve an entity's immediate active or historical sources and ______ in either direction.
2. We use stable ordering and a bounded traversal utility with a ______ set.
3. Active/historical and relation-type filters can be combined with ______ ordering.
4. Ended lineage remains historically queryable from either ______.
5. We seed cyclic legacy data and assert bounded, duplicate-safe ______.

<details>
<summary>点击查看答案</summary>

1. derivatives
2. visited
3. deterministic
4. endpoint
5. termination

</details>
