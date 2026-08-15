# Issue #70: Task: Define origin and transformation relation policies

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Represent entity origins and transformations (#8)

---

## 1. Original English

Parent Feature: #8 — Feature: Represent entity origins and transformations

## Outcome

Origin and transformation are explicit semantic-relation policies over the eight independent core concepts, with validated direction, endpoints, metadata, cardinality, lifecycle, and cycle behavior rather than entity-specific origin columns.

## Implementation plan

1. Define the supported lineage relation types and canonical direction (source to derivative), documenting how consumers interpret immediate origins and transformations.
2. Define allowed source/target type combinations across Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record, plus any cardinality restrictions.
3. Define a structured, versionable metadata contract for transformation kind, rationale/context, actor/tool references, and optional source fragments, including validation and redaction rules.
4. Define endpoint existence checks through the shared core-entity resolver and choose explicit cycle policy: reject cycles for constrained lineage semantics and require bounded, visited-set-safe traversal for reads.
5. Define ending semantics through `relations.ended_at` and require relation-change provenance rather than physical deletion.

## Acceptance criteria

- [ ] Direct origin and transformation links use `relations` and add no entity-specific origin columns or `entities` table.
- [ ] Allowed endpoint types, canonical direction, relation types, and cardinality rules are explicit and application-validated.
- [ ] Metadata can describe the transformation without mutating either endpoint.
- [ ] Invalid endpoint IDs/types and malformed metadata produce explicit domain errors.
- [ ] Cycle behavior is explicit and safe: invalid cycles are rejected and reads remain bounded with a visited set.
- [ ] Ending lineage uses `ended_at` and preserves both relation and provenance history.

## Tests

- Unit-test the relation policy matrix, direction/cardinality rules, metadata schema, and redaction.
- Test invalid endpoint types/IDs and direct/indirect cycle cases against the documented policy.
- Contract-test that lineage maps only to independent `relations` rows with no database foreign keys or endpoint schema mutation.

## Dependencies

- Parent Feature #8.
- Feature #19 — Create and validate semantic relations.
- #64 — Task: Define the relation-change provenance contract.

## Out of scope

- Automatic lineage inference.
- Entity timeline aggregation and arbitrary deep graph analytics.
- Entity-specific source columns or database foreign keys.

---

## 2. 中文翻译

父功能：#8 — 功能：表示实体来源和转换

## 成果

来源和转换是八种独立核心概念之上的显式语义关系策略，具有验证过的方向、端点、元数据、基数、生命周期和循环行为，而不是特定于实体的来源列。

## 实施计划

1. 定义支持的谱系关系类型和规范方向（来源到派生），记录消费者如何解释直接来源和转换。
2. 定义跨任务、目标、项目、想法、理念、工作流、资源和记录的允许来源/目标类型组合，以及任何基数限制。
3. 定义可版本化的结构化元数据合同，用于转换种类、理由/上下文、行为者/工具引用和可选来源片段，包括验证和编辑规则。
4. 通过共享核心实体解析器定义端点存在性检查，并选择显式循环策略：对受约束的谱系语义拒绝循环，并要求读取时使用有界、已访问集合安全的遍历。
5. 通过 `relations.ended_at` 定义结束语义，并要求关系变更来源而非物理删除。

## 验收标准

- [ ] 直接来源和转换链接使用 `relations`，不添加特定于实体的来源列或 `entities` 表。
- [ ] 允许的端点类型、规范方向、关系类型和基数规则是显式的，并经过应用验证。
- [ ] 元数据可以描述转换，而不改变任一端点。
- [ ] 无效端点 ID/类型和格式错误元数据产生显式领域错误。
- [ ] 循环行为是显式且安全的：无效循环被拒绝，读取保持有界且使用已访问集合。
- [ ] 结束谱系使用 `ended_at` 并保留关系和来源历史。

## 测试

- 单元测试关系策略矩阵、方向/基数规则、元数据模式和编辑。
- 针对文档化策略测试无效端点类型/ID 和直接/间接循环情况。
- 合同测试谱系仅映射到独立的 `relations` 行，没有数据库外键或端点模式变更。

## 依赖

- 父功能 #8。
- 功能 #19 — 创建并验证语义关系。
- #64 — 任务：定义关系变更来源合同。

## 范围外

- 自动谱系推断。
- 实体时间线聚合和任意深度图分析。
- 特定于实体的来源列或数据库外键。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the supported lineage relation types and canonical direction. |
| document | 记录 | Document how consumers interpret immediate origins and transformations. |
| interpret | 解释 | Consumers interpret immediate origins and transformations. |
| restrict | 限制 | Define allowed source/target type combinations plus any cardinality restrictions. |
| validate | 验证 | Allowed endpoint types and cardinality rules are explicit and application-validated. |
| redact | 编辑 | Including validation and redaction rules in the metadata contract. |
| resolve | 解析 | Define endpoint existence checks through the shared core-entity resolver. |
| reject | 拒绝 | Reject cycles for constrained lineage semantics. |
| require | 要求 | Require bounded, visited-set-safe traversal for reads. |
| preserve | 保留 | Ending lineage preserves both relation and provenance history. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| origin and transformation | 来源和转换 | 描述实体来源与变化 |
| relation policies | 关系策略 | 管理关系类型的规则 |
| lineage relation types | 谱系关系类型 | 表示来源/派生的关系类型 |
| canonical direction | 规范方向 | 标准的方向定义 |
| endpoint type combinations | 端点类型组合 | 允许的来源/目标类型配对 |
| cardinality restrictions | 基数限制 | 关系数量上的约束 |
| metadata contract | 元数据合同 | 元数据结构和验证规则 |
| transformation kind | 转换种类 | 转换的类型 |
| rationale/context | 理由/上下文 | 转换的原因和背景 |
| actor/tool references | 行为者/工具引用 | 参与转换的行为者或工具 |
| cycle policy | 循环策略 | 处理循环谱系的规则 |
| bounded traversal | 有界遍历 | 限制深度的遍历 |
| visited set | 已访问集合 | 遍历时记录已访问节点 |

### 值得模仿的句式
1. **“Origin and transformation are explicit semantic-relation policies over the eight independent core concepts...”** — 来源和转换是八种独立核心概念之上的显式语义关系策略... — 例句：Access control is an explicit policy over the independent resource types.
2. **“...rather than entity-specific origin columns.”** — ...而不是特定于实体的来源列。 — 例句：Use shared tables rather than entity-specific columns.
3. **“...requiring bounded, visited-set-safe traversal for reads.”** — ...要求读取时使用有界、已访问集合安全的遍历。 — 例句：Implement bounded, visited-set-safe traversal for graph reads.

### 领域词汇
| English | 中文 |
|---|---|
| Lineage | 谱系 |
| Canonical direction | 规范方向 |
| Cardinality | 基数 |
| Metadata contract | 元数据合同 |
| Redaction | 编辑 |
| Cycle policy | 循环策略 |
| Visited set | 已访问集合 |
| Endpoint resolver | 端点解析器 |
| Source fragments | 来源片段 |
| Application-validated | 应用层验证的 |

---

## 4. 小练习

1. Origin and transformation are explicit semantic-relation ______ over the eight independent core concepts.
2. We define the supported lineage relation types and canonical ______ (source to derivative).
3. The metadata contract covers transformation kind, rationale/context, actor/tool references, and optional source ______.
4. We choose an explicit cycle policy: reject cycles and require bounded, ______-set-safe traversal for reads.
5. Ending lineage uses `ended_at` and preserves both relation and ______ history.

<details>
<summary>点击查看答案</summary>

1. policies
2. direction
3. fragments
4. visited
5. provenance

</details>
