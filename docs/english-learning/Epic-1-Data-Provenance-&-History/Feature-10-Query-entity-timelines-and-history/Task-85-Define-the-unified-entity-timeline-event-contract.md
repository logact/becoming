# Issue #85: Task: Define the unified entity timeline event contract

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Query entity timelines and history (#10)

---

## 1. Original English

Parent Feature: #10 — Feature: Query entity timelines and history

## Outcome

Consumers receive one stable, framework-neutral timeline event model that normalizes mutation, relationship, lineage, lifecycle, origin/transformation, correction, and other supported occurrence Records without collapsing the underlying append-oriented history.

## Implementation plan

1. Define a versioned timeline event result with Record ID/type, occurrence and recording times, actor, summary, affected entity reference, related entity/relation/state references, archive status, and category-specific payload.
2. Define the category mapping from the structured Records produced by mutation provenance, relation changes, lineage operations, lifecycle transitions, corrections, and directly captured occurrences.
3. Define inclusion rules for events directly linked to an entity and events concerning it through either endpoint or structured affected-entity identity, avoiding double-counting when multiple paths identify the same Record.
4. Define deterministic total ordering using `occurred_at`, `recorded_at`, and immutable Record ID as tie-breakers, plus category and archive visibility semantics.
5. Define explicit valid entity-type resolution across the eight independent core tables using application/domain logical validation, with no `entities` table or database foreign keys.

## Acceptance criteria

- [ ] The event contract represents mutation, relation, lineage/origin/transformation, lifecycle, correction, and direct occurrence categories.
- [ ] Each event exposes enough logical references for a consumer to inspect related supported entities.
- [ ] Inclusion and Record-ID de-duplication rules are explicit and testable.
- [ ] Ordering is a deterministic total order even when occurrence and recording timestamps match.
- [ ] Archived historical data follows an explicit caller authorization/archive-visibility contract.
- [ ] Entity resolution spans Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record without a polymorphic core table or database foreign keys.

## Tests

- Unit-test every category adapter, reference projection, archive semantics, and malformed/unknown category fallback behavior.
- Test de-duplication when one Record concerns the entity through multiple relation/payload paths.
- Test total ordering for identical timestamps and stable Record-ID tie-breaking.
- Contract-test logical resolution for all eight entity types and explicit unknown/invalid-type errors.

## Dependencies

- Parent Feature #10.
- #58 — Task: Define the atomic core-mutation provenance contract.
- #64 — Task: Define the relation-change provenance contract.
- #70 — Task: Define origin and transformation relation policies.
- #77 — Task: Define the lifecycle-transition audit payload.

## Out of scope

- Timeline storage as a new table or rewriting source Records.
- User-interface design and cross-system analytics.
- Authorization-policy definition beyond consuming an archive-visibility decision.

---

## 2. 中文翻译

父功能：#10 — 功能：查询实体时间线和历史

## 成果

消费者收到一个稳定的、与框架无关的时间线事件模型，该模型规范了变更、关系、谱系、生命周期、来源/转换、修正和其他支持的发生记录，而不会折叠底层的追加导向历史。

## 实施计划

1. 定义版本化的时间线事件结果，包含记录 ID/类型、发生和记录时间、行为者、摘要、受影响实体引用、相关实体/关系/状态引用、归档状态和类别特定载荷。
2. 定义从变更来源、关系变更、谱系操作、生命周期转换、修正和直接捕获的发生所产生的结构化记录的类别映射。
3. 定义直接链接到实体的事件和通过任一端点或结构化受影响实体标识涉及实体的事件的包含规则，当多条路径识别同一记录时避免重复计数。
4. 使用 `occurred_at`、`recorded_at` 和不可变记录 ID 作为决胜定义确定性总排序，加上类别和归档可见性语义。
5. 使用应用/领域逻辑验证定义跨八个独立核心表的有效实体类型解析，没有 `entities` 表或数据库外键。

## 验收标准

- [ ] 事件合同表示变更、关系、谱系/来源/转换、生命周期、修正和直接发生类别。
- [ ] 每个事件暴露足够的逻辑引用，供消费者检查相关支持实体。
- [ ] 包含和记录 ID 去重规则是显式且可测试的。
- [ ] 排序是确定性总顺序，即使发生和记录时间戳相同。
- [ ] 归档历史数据遵循显式调用者授权/归档可见性合同。
- [ ] 实体解析跨越任务、目标、项目、想法、理念、工作流、资源和记录，没有多态核心表或数据库外键。

## 测试

- 单元测试每个类别适配器、引用投影、归档语义和格式错误/未知类别回退行为。
- 测试当一条记录通过多条关系/载荷路径涉及实体时的去重。
- 测试相同时间戳和稳定记录 ID 决胜的总排序。
- 合同测试所有八种实体类型的逻辑解析以及显式的未知/无效类型错误。

## 依赖

- 父功能 #10。
- #58 — 任务：定义原子核心变更来源合同。
- #64 — 任务：定义关系变更来源合同。
- #70 — 任务：定义来源和转换关系策略。
- #77 — 任务：定义生命周期转换审计载荷。

## 范围外

- 将时间线存储为新表或重写源记录。
- 用户界面设计和跨系统分析。
- 除消费归档可见性决策之外的授权策略定义。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| normalize | 规范化 | ...normalizes mutation, relationship, lineage, lifecycle... Records. |
| collapse | 折叠 | ...without collapsing the underlying append-oriented history. |
| avoid | 避免 | Avoiding double-counting when multiple paths identify the same Record. |
| define | 定义 | Define a versioned timeline event result. |
| span | 跨越 | Entity resolution spans Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record. |
| expose | 暴露 | Each event exposes enough logical references. |
| deduplicate | 去重 | Inclusion and Record-ID de-duplication rules. |
| resolve | 解析 | Define explicit valid entity-type resolution. |
| match | 匹配 | ...even when occurrence and recording timestamps match. |
| consume | 消费 | ...beyond consuming an archive-visibility decision. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| unified entity timeline event contract | 统一实体时间线事件合同 | 时间线事件的标准格式 |
| framework-neutral timeline event model | 与框架无关的时间线事件模型 | 不依赖框架的模型 |
| category mapping | 类别映射 | 从记录类型到事件类别的映射 |
| occurrence Records | 发生记录 | 记录实际事件的实体 |
| affected entity reference | 受影响实体引用 | 被事件影响的实体 |
| related entity references | 相关实体引用 | 与事件相关的其他实体 |
| archive status | 归档状态 | 记录是否归档 |
| category-specific payload | 类别特定载荷 | 不同类别特有的数据 |
| total ordering | 总排序 | 所有事件都有确定顺序 |
| tie-breakers | 决胜规则 | 时间相同时决定顺序的规则 |
| polymorphic core table | 多态核心表 | 存放多种实体类型的通用表 |

### 值得模仿的句式
1. **“Consumers receive one stable, framework-neutral timeline event model that normalizes ... without collapsing the underlying append-oriented history.”** — 消费者收到一个稳定的、与框架无关的时间线事件模型，该模型规范了...而不会折叠底层的追加导向历史。 — 例句：The API returns one stable model that normalizes responses without collapsing the underlying data.
2. **“...avoiding double-counting when multiple paths identify the same Record.”** — ...当多条路径识别同一记录时避免重复计数。 — 例句：Avoid double-counting when multiple paths identify the same event.
3. **“...spanning Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record without a polymorphic core table or database foreign keys.”** — ...跨越任务、目标、项目、想法、理念、工作流、资源和记录，没有多态核心表或数据库外键。 — 例句：The query spans multiple entity types without a polymorphic core table.

### 领域词汇
| English | 中文 |
|---|---|
| Unified contract | 统一合同 |
| Timeline event | 时间线事件 |
| Category mapping | 类别映射 |
| Affected entity | 受影响实体 |
| Archive status | 归档状态 |
| Total ordering | 总排序 |
| Tie-breaker | 决胜规则 |
| Polymorphic table | 多态表 |
| Logical validation | 逻辑验证 |
| Reference projection | 引用投影 |

---

## 4. 小练习

1. Consumers receive one stable, framework-neutral timeline event ______ that normalizes multiple Record categories.
2. We must avoid double-______ when multiple paths identify the same Record.
3. Total ordering uses `occurred_at`, `recorded_at`, and immutable Record ID as tie-______.
4. Entity resolution spans eight independent core tables using application/domain logical ______.
5. The design avoids a polymorphic core table and database foreign ______.

<details>
<summary>点击查看答案</summary>

1. model
2. counting
3. breakers
4. validation
5. keys

</details>
