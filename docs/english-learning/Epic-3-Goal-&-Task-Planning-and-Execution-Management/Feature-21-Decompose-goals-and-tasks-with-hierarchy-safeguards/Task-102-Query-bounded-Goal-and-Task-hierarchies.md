# Issue #102: Task: Query bounded Goal and Task hierarchies

**Labels:** task  
**State:** CLOSED  
**Parent:** #21: Feature: Decompose goals and tasks with hierarchy safeguards

---

## 1. Original English

Parent Feature: #21 — Feature: Decompose goals and tasks with hierarchy safeguards

## Outcome

Callers can deterministically inspect parents, children, ancestors, and descendants for a Project hierarchy in current or historical scope without infinite traversal or silent corruption.

## Implementation plan

1. Define Project-scoped hierarchy projections that retain typed node identity, edge type/direction, Project context, and relation validity timestamps.
2. Implement direct parent/child queries from applicable decomposition relations with current and historical/as-of filters.
3. Implement bounded ancestor/descendant traversal with deterministic neighbor ordering, a visited set, configurable depth/node limits, and explicit truncation metadata.
4. Detect and report cycles, cross-project edges, missing/mistyped endpoints, and duplicate/cardinality anomalies rather than dropping or recursively following them forever.

## Acceptance criteria

- [ ] Direct queries return the correct Goal and Task parents/children for each supported edge type.
- [ ] Ancestor and descendant traversal returns deterministic results for trees and directed acyclic graphs.
- [ ] Traversal cannot loop indefinitely and reports configured bound truncation explicitly.
- [ ] Current views exclude ended relations; historical/as-of views can include prior hierarchy with validity timestamps.
- [ ] Cycles, missing endpoints, cross-project violations, and duplicate/cardinality anomalies are surfaced as integrity findings.
- [ ] Querying from a child never reverses or loses the canonical parent-to-child relation direction.

## Tests

- Query tests for Goal→Goal, Goal→Task, Task→Task, multiple roots, leaves, diamonds, and disconnected nodes.
- Determinism tests with shuffled persistence order and equal timestamps/IDs.
- Bound, cycle, malformed endpoint, cross-project, duplicate, active, ended, and as-of history tests.
- Contract tests for truncation metadata and anomaly payloads.

## Dependencies

- Parent Feature: #21.
- Depends on Task: Implement cycle-safe decomposition mutations.
- Depends on #19 current/historical relation query semantics.

---

## 2. 中文翻译

父级 Feature：#21 —— 在层级保护下分解目标与任务

## 结果

调用方可以确定性检查项目层级中的父级、子级、祖先和后代，范围可以是当前或历史，且不会无限遍历或静默损坏。

## 实施计划

1. 定义项目范围层级投影，保留带类型的节点标识、边类型/方向、项目上下文和关系有效时间戳。
2. 根据适用的分解关系实现直接父级/子级查询，带有当前和历史/截至筛选器。
3. 实现有界的祖先/后代遍历，具有确定性邻居排序、访问集合、可配置深度/节点限制和明确的截断元数据。
4. 检测并报告循环、跨项目边、缺失/类型错误端点以及重复/基数异常，而不是永远丢弃或递归跟随它们。

## 验收标准

- [ ] 直接查询为每种支持的边类型返回正确的 Goal 和 Task 父级/子级。
- [ ] 祖先和后代遍历为树和有向无环图返回确定性结果。
- [ ] 遍历不能无限循环，并明确报告配置的边界截断。
- [ ] 当前视图排除已结束关系；历史/截至视图可以包含带有有效时间戳的先前层级。
- [ ] 循环、缺失端点、跨项目违反和重复/基数异常会作为完整性发现呈现。
- [ ] 从子级查询永远不会反转或丢失规范的父到子关系方向。

## 测试

- 针对 Goal→Goal、Goal→Task、Task→Task、多根、叶子、菱形和断开节点的查询测试。
- 使用打乱持久化顺序和相等时间戳/ID 的确定性测试。
- 边界、循环、格式错误端点、跨项目、重复、活动、已结束和截至历史测试。
- 针对截断元数据和异常负载的约定测试。

## 依赖

- 父级 Feature：#21。
- 依赖任务：实现防循环分解变更。
- 依赖 #19 当前/历史关系查询语义。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查 | inspect parents, children, ancestors, and descendants |
| retain | 保留 | retain typed node identity |
| implement | 实现 | Implement bounded ancestor/descendant traversal |
| loop | 循环 | Traversal cannot loop indefinitely |
| report | 报告 | detect and report cycles |
| surface | 呈现 | surfaced as integrity findings |
| reverse | 反转 | never reverses the canonical direction |
| follow | 跟随 | recursively following them forever |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| bounded traversal | 有界遍历 | bounded ancestor/descendant traversal |
| directed acyclic graph | 有向无环图 | directed acyclic graphs |
| neighbor ordering | 邻居排序 | deterministic neighbor ordering |
| visited set | 访问集合 | a visited set |
| depth/node limits | 深度/节点限制 | configurable depth/node limits |
| truncation metadata | 截断元数据 | explicit truncation metadata |
| cross-project violation | 跨项目违反 | cross-project violations |
| parent-to-child direction | 父到子方向 | canonical parent-to-child relation direction |

### 值得模仿的句式
1. **"Callers can deterministically inspect A, B, C, and D for E in F or G scope."** — 调用方可以在 F 或 G 范围内确定性检查 E 的 A、B、C 和 D。 — Callers can deterministically inspect parents, children, ancestors, and descendants for a Project hierarchy in current or historical scope.
2. **"A cannot loop indefinitely and reports B explicitly."** — A 不能无限循环，并明确报告 B。 — Traversal cannot loop indefinitely and reports configured bound truncation explicitly.
3. **"A are surfaced as B rather than C or D forever."** — A 被呈现为 B，而不是永远 C 或 D。 — Cycles, missing endpoints, cross-project violations, and duplicate/cardinality anomalies are surfaced as integrity findings rather than dropping or recursively following them forever.

### 领域词汇
| English | 中文 |
|---|---|
| Ancestor | 祖先 |
| Descendant | 后代 |
| Traversal | 遍历 |
| Directed acyclic graph | 有向无环图 |
| Truncation | 截断 |
| Metadata | 元数据 |
| Integrity finding | 完整性发现 |
| Cardinality anomaly | 基数异常 |
| Cross-project violation | 跨项目违反 |

---

## 4. 小练习

1. Callers can inspect parents, children, ancestors, and ______ for a Project hierarchy.
2. Implement bounded ancestor/descendant traversal with deterministic neighbor ordering and a ______ set.
3. Traversal cannot ______ indefinitely.
4. Cycles and cross-project violations are surfaced as integrity ______.
5. Querying from a child never reverses the canonical ______-to-child direction.

<details>
<summary>点击查看答案</summary>

1. descendants
2. visited
3. loop
4. findings
5. parent
</details>
