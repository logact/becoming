# Issue #96: Task: Query Task membership and Project contexts

**Labels:** task  
**State:** CLOSED  
**Parent:** #18: Feature: Manage tasks and project membership

---

## 1. Original English

Parent Feature: #18 — Feature: Manage tasks and project membership

## Outcome

Callers can inspect a Project's active Tasks and a Task's Project contexts, with explicit current versus historical membership views.

## Implementation plan

1. Define framework-neutral read models for Tasks in a Project and Project contexts for a Task, retaining entity summaries and membership create/end timestamps.
2. Implement current views from active membership relations with a documented archived-entity visibility policy.
3. Implement historical/as-of views that include ended membership and archived endpoints when requested.
4. Surface missing or mistyped logical endpoints as integrity anomalies and provide deterministic ordering/pagination.

## Acceptance criteria

- [ ] A Project query returns its active member Tasks without reading a Task project column.
- [ ] A Task query returns every applicable active Project context.
- [ ] Current views exclude ended membership and follow a documented archived-entity policy.
- [ ] Historical views can include ended relations and archived Tasks/Projects with temporal context.
- [ ] Canonical relation direction is preserved in both query directions.
- [ ] Logical-reference anomalies are surfaced rather than silently ignored, and results are deterministically ordered.

## Tests

- Read-model tests for zero, one, and many Tasks/Projects in both directions.
- Tests for active, ended, archived, and re-established memberships.
- Tests for malformed/missing endpoints, direction, current/history filters, ordering, and pagination.
- Time-boundary tests aligned with #19 relation query semantics.

## Dependencies

- Parent Feature: #18.
- Depends on Task: Implement Task-to-Project membership relations.
- Depends on #19 current/historical relation queries and #20 Project query availability.

## Out of scope

- Nested work, lifecycle state, progress, dependencies, resources, scheduling, or a preset visual presentation.

---

## 2. 中文翻译

父级 Feature：#18 —— 管理任务与项目成员关系

## 结果

调用方可以检查项目的活动任务以及任务的项目上下文，并具有明确的当前与历史成员关系视图。

## 实施计划

1. 定义与框架无关的读模型：项目中的任务以及任务的项目上下文，保留实体摘要和成员关系创建/结束时间戳。
2. 从活动成员关系实现当前视图，并记录归档实体可见性策略。
3. 实现历史/截至视图，在请求时包含已结束的成员关系和已归档的端点。
4. 将缺失或类型错误的逻辑端点作为完整性异常呈现，并提供确定性排序/分页。

## 验收标准

- [ ] 项目查询返回其活动成员任务，而无需读取 Task 的项目列。
- [ ] 任务查询返回每个适用的活动项目上下文。
- [ ] 当前视图排除已结束的成员关系，并遵循文档化的归档实体策略。
- [ ] 历史视图可以包含已结束的关系以及带有时间上下文的已归档 Task/Project。
- [ ] 规范的关系方向在两种查询方向上都保留。
- [ ] 逻辑引用异常会被呈现而不是被默默忽略，结果是确定性排序的。

## 测试

- 针对双向零个、一个和多个 Task/Project 的读模型测试。
- 针对活动、已结束、已归档和重新建立的成员关系的测试。
- 针对格式错误/缺失端点、方向、当前/历史筛选器、排序和分页的测试。
- 与 #19 关系查询语义一致的时间边界测试。

## 依赖

- 父级 Feature：#18。
- 依赖任务：实现 Task-to-Project 成员关系。
- 依赖 #19 当前/历史关系查询和 #20 Project 查询可用性。

## 超出范围

- 嵌套工作、生命周期状态、进度、依赖、资源、调度或预设的视觉展示。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查 | Callers can inspect a Project's active Tasks |
| retain | 保留 | retaining entity summaries and timestamps |
| exclude | 排除 | Current views exclude ended membership |
| include | 包含 | Historical views can include ended relations |
| preserve | 保留 | Canonical relation direction is preserved |
| surface | 呈现、暴露 | Surface missing or mistyped logical endpoints |
| align | 对齐 | aligned with #19 relation query semantics |
| provide | 提供 | provide deterministic ordering/pagination |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| read model | 读模型 | framework-neutral read models |
| entity summary | 实体摘要 | retaining entity summaries |
| archived-entity visibility | 归档实体可见性 | documented archived-entity visibility policy |
| temporal context | 时间上下文 | with temporal context |
| integrity anomaly | 完整性异常 | integrity anomalies |
| canonical direction | 规范方向 | Canonical relation direction |
| logical-reference anomaly | 逻辑引用异常 | Logical-reference anomalies |
| time-boundary test | 时间边界测试 | Time-boundary tests |

### 值得模仿的句式
1. **"Callers can inspect A and B, with explicit C versus D views."** — 调用方可以检查 A 和 B，并具有明确的 C 与 D 视图。 — Callers can inspect a Project's active Tasks and a Task's Project contexts, with explicit current versus historical membership views.
2. **"A are surfaced rather than silently ignored."** — A 会被呈现出来，而不是被默默忽略。 — Logical-reference anomalies are surfaced rather than silently ignored.
3. **"Historical views can include A and B with C."** — 历史视图可以包含 A 和 B，并带有 C。 — Historical views can include ended relations and archived Tasks/Projects with temporal context.

### 领域词汇
| English | 中文 |
|---|---|
| Read model | 读模型 |
| Context | 上下文 |
| Membership | 成员关系 |
| Anomaly | 异常 |
| Integrity | 完整性 |
| Temporal | 时间的 |
| Canonical | 规范的 |
| Pagination | 分页 |
| Filter | 筛选器 |

---

## 4. 小练习

1. Callers can inspect a Project's active Tasks and a Task's Project ______.
2. Current views ______ ended membership.
3. Historical views can include ended relations and archived Tasks/Projects with ______ context.
4. ______ relation direction is preserved in both query directions.
5. Logical-reference anomalies are surfaced rather than silently ______.

<details>
<summary>点击查看答案</summary>

1. contexts
2. exclude
3. temporal
4. Canonical
5. ignored
</details>
