# Issue #8: Feature: Represent entity origins and transformations

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users can trace where a domain entity came from and which earlier entities or events produced it.

## Scope

- Define origin and transformation relation semantics among core concepts.
- Link captured ideas, goals, tasks, records, and other supported entities to their sources.
- Store transformation context in relation metadata where needed.
- Support traversal in both source-to-result and result-to-source directions.

## Acceptance criteria

- The domain model can represent direct origin and transformation links without adding entity-specific origin columns.
- Links validate both endpoint types and IDs.
- A consumer can retrieve the immediate sources and immediate derivatives of an entity.
- Transformation metadata can describe the transformation without changing either endpoint.
- Ending a lineage link preserves its history.
- Cyclic lineage is either rejected where semantically invalid or returned safely using bounded traversal.

## Dependencies

- Feature: Create and validate semantic relations.
- Feature: Track relationship changes over time.

## Out of scope

- Automated inference of lineage.
- Arbitrary deep graph analytics in V1.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户可以追溯领域实体的来源，以及哪些早期实体或事件产生了它。

## 范围

- 定义核心概念之间的来源和转换关系语义。
- 将捕获的想法、目标、任务、记录和其他支持实体链接到其来源。
- 在需要时在关系元数据中存储转换上下文。
- 支持从来源到结果以及从结果到来源两个方向的遍历。

## 验收标准

- 领域模型可以表示直接的来源和转换链接，而不添加特定于实体的来源列。
- 链接验证两个端点类型和 ID。
- 消费者可以检索实体的直接来源和直接派生。
- 转换元数据可以描述转换，而不改变任一端点。
- 结束谱系链接会保留其历史。
- 循环谱系在语义上无效的地方被拒绝，或者通过有界遍历安全返回。

## 依赖

- 功能：创建并验证语义关系。
- 功能：跟踪关系随时间的变化。

## 范围外

- 谱系的自动推断。
- V1 中的任意深度图分析。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| trace | 追溯 | Users can trace where a domain entity came from. |
| define | 定义 | Define origin and transformation relation semantics. |
| link | 链接 | Link captured ideas, goals, tasks, and records to their sources. |
| store | 存储 | Store transformation context in relation metadata. |
| support | 支持 | Support traversal in both source-to-result and result-to-source directions. |
| represent | 表示 | The domain model can represent direct origin and transformation links. |
| validate | 验证 | Links validate both endpoint types and IDs. |
| retrieve | 检索 | A consumer can retrieve the immediate sources and immediate derivatives. |
| describe | 描述 | Transformation metadata can describe the transformation. |
| reject | 拒绝 | Cyclic lineage is either rejected where semantically invalid. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| entity origins | 实体来源 | 实体的起源 |
| transformation context | 转换上下文 | 描述转换的背景信息 |
| core concepts | 核心概念 | 系统中的核心领域概念 |
| origin links | 来源链接 | 指向来源的链接 |
| transformation links | 转换链接 | 表示转换的链接 |
| immediate sources | 直接来源 | 实体的直接上游来源 |
| immediate derivatives | 直接派生 | 实体的直接下游产物 |
| lineage link | 谱系链接 | 表示来源或派生关系的链接 |
| cyclic lineage | 循环谱系 | 形成闭环的谱系关系 |
| bounded traversal | 有界遍历 | 限制深度的遍历 |
| semantic relations | 语义关系 | 带有业务含义的关系 |

### 值得模仿的句式
1. **“Users can trace where a domain entity came from and which earlier entities or events produced it.”** — 用户可以追溯领域实体的来源，以及哪些早期实体或事件产生了它。 — 例句：Users can trace where a requirement came from and which earlier decisions produced it.
2. **“The domain model can represent direct origin and transformation links without adding entity-specific origin columns.”** — 领域模型可以表示直接的来源和转换链接，而不添加特定于实体的来源列。 — 例句：The model can represent direct references without adding entity-specific foreign-key columns.
3. **“Cyclic lineage is either rejected where semantically invalid or returned safely using bounded traversal.”** — 循环谱系在语义上无效的地方被拒绝，或者通过有界遍历安全返回。 — 例句：Cyclic dependencies are either rejected or returned safely using bounded traversal.

### 领域词汇
| English | 中文 |
|---|---|
| Origin | 来源 |
| Transformation | 转换 |
| Lineage | 谱系 |
| Immediate sources | 直接来源 |
| Immediate derivatives | 直接派生 |
| Cyclic lineage | 循环谱系 |
| Bounded traversal | 有界遍历 |
| Semantic relation | 语义关系 |
| Endpoint type | 端点类型 |
| Relation metadata | 关系元数据 |

---

## 4. 小练习

1. Users can ______ where a domain entity came from and which earlier entities or events produced it.
2. The domain model can represent direct origin and transformation links without adding entity-specific ______ columns.
3. A consumer can retrieve the immediate sources and immediate ______ of an entity.
4. Transformation metadata can describe the transformation without changing either ______.
5. Cyclic lineage is either rejected where semantically invalid or returned safely using ______ traversal.

<details>
<summary>点击查看答案</summary>

1. trace
2. origin
3. derivatives
4. endpoint
5. bounded

</details>
