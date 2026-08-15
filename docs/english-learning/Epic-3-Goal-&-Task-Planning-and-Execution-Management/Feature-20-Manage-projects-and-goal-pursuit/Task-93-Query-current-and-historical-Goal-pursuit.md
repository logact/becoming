# Issue #93: Task: Query current and historical Goal pursuit

**Labels:** task  
**State:** CLOSED  
**Parent:** #20: Feature: Manage projects and goal pursuit

---

## 1. Original English

Parent Feature: #20 — Feature: Manage projects and goal pursuit

## Outcome

Callers can query a Project's pursued Goals and a Goal's pursuing Projects in current and historical views without losing archive or ended-relation context.

## Implementation plan

1. Define two framework-neutral read models: Goals pursued by a Project and Projects pursuing a Goal, retaining endpoint IDs, intrinsic summaries, and relationship validity timestamps.
2. Implement current views using active relations and the documented archive-visibility policy.
3. Implement historical/as-of views that can include ended pursuit relations and archived Projects/Goals without rewriting present entity data.
4. Surface dangling or mistyped logical endpoints as integrity anomalies and add deterministic ordering/pagination.

## Acceptance criteria

- [ ] A Project query returns all Goals connected by applicable active pursuit relations.
- [ ] A Goal query returns all Projects connected by applicable active pursuit relations.
- [ ] Current views exclude ended relations and apply a documented archived-entity policy.
- [ ] Historical views can include ended relations and archived Projects with relation create/end timestamps.
- [ ] Results preserve canonical relation direction even when queried from the target Goal.
- [ ] Logical-reference anomalies are surfaced rather than silently dropped, and ordering is deterministic.

## Tests

- Read-model tests for zero, one, and many Goals/Projects in both directions.
- Tests for active, ended, archived, and re-established pursuit histories.
- Tests for malformed/missing logical endpoints, direction preservation, ordering, and pagination.
- Point-in-time boundary tests where supported by #19 relation query semantics.

## Dependencies

- Parent Feature: #20.
- Depends on Task: Implement Project-to-Goal pursuit relations.
- Depends on #19 current/historical relation query support and #17 Goal queries.

## Out of scope

- Nested work, lifecycle state, progress, dependencies, resources, scheduling, or a preset visual presentation.

---

## 2. 中文翻译

父级 Feature：#20 —— 管理项目与目标追求

## 结果

调用方可以查询某个 Project 正在追求的 Goal 以及某个 Goal 的追求 Project，并在当前和历史视图中不丢失归档或已结束关系的上下文。

## 实施计划

1. 定义两个与框架无关的读模型：Project 追求的 Goal 和追求 Goal 的 Project，保留端点 ID、内在摘要和关系有效时间戳。
2. 使用活动关系和文档化的归档可见性策略实现当前视图。
3. 实现历史/截至视图，可以包含已结束的追求关系以及已归档的 Project/Goal，而无需重写当前实体数据。
4. 将悬空或类型错误的逻辑端点作为完整性异常呈现，并添加确定性排序/分页。

## 验收标准

- [ ] Project 查询返回通过适用活动追求关系连接的所有 Goal。
- [ ] Goal 查询返回通过适用活动追求关系连接的所有 Project。
- [ ] 当前视图排除已结束关系，并应用文档化的归档实体策略。
- [ ] 历史视图可以包含已结束关系以及带有关系创建/结束时间戳的已归档 Project。
- [ ] 即使从目标 Goal 查询，结果也保留规范的关系方向。
- [ ] 逻辑引用异常会被呈现而不是被默默丢弃，排序是确定性的。

## 测试

- 针对双向零个、一个和多个 Goal/Project 的读模型测试。
- 针对活动、已结束、已归档和重新建立追求历史的测试。
- 针对格式错误/缺失逻辑端点、方向保留、排序和分页的测试。
- 在 #19 关系查询语义支持的范围内进行时间点边界测试。

## 依赖

- 父级 Feature：#20。
- 依赖任务：实现 Project-to-Goal 追求关系。
- 依赖 #19 当前/历史关系查询支持和 #17 Goal 查询。

## 超出范围

- 嵌套工作、生命周期状态、进度、依赖、资源、调度或预设的视觉展示。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| pursue | 追求 | Goals pursued by a Project |
| retain | 保留 | retaining endpoint IDs, intrinsic summaries |
| exclude | 排除 | Current views exclude ended relations |
| include | 包含 | Historical views can include ended relations |
| preserve | 保留 | preserve canonical relation direction |
| surface | 呈现 | Logical-reference anomalies are surfaced |
| drop | 丢弃 | rather than silently dropped |
| rewrite | 重写 | without rewriting present entity data |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| current view | 当前视图 | current and historical views |
| historical view | 历史视图 | current and historical views |
| archive-visibility policy | 归档可见性策略 | documented archive-visibility policy |
| ended-relation context | 已结束关系上下文 | without losing archive or ended-relation context |
| relationship validity | 关系有效性 | relationship validity timestamps |
| dangling endpoint | 悬空端点 | dangling or mistyped logical endpoints |
| point-in-time boundary | 时间点边界 | Point-in-time boundary tests |
| preset visual presentation | 预设视觉展示 | preset visual presentation |

### 值得模仿的句式
1. **"Callers can query A and B in C and D views without losing E."** — 调用方可以查询 A 和 B 的 C 和 D 视图，而不会丢失 E。 — Callers can query a Project's pursued Goals and a Goal's pursuing Projects in current and historical views without losing archive or ended-relation context.
2. **"A is preserved even when B."** — 即使 B，A 也会保留。 — Results preserve canonical relation direction even when queried from the target Goal.
3. **"A are surfaced rather than silently B."** — A 会被呈现，而不是被默默 B。 — Logical-reference anomalies are surfaced rather than silently dropped.

### 领域词汇
| English | 中文 |
|---|---|
| Pursuit | 追求 |
| Read model | 读模型 |
| Archive visibility | 归档可见性 |
| Ended relation | 已结束关系 |
| Intrinsic summary | 内在摘要 |
| Validity timestamp | 有效时间戳 |
| Dangling endpoint | 悬空端点 |
| Anomaly | 异常 |
| Pagination | 分页 |

---

## 4. 小练习

1. Callers can query a Project's pursued Goals and a Goal's ______ Projects.
2. Current views exclude ______ relations.
3. Historical views can include ended relations and archived Projects with relation create/______ timestamps.
4. Results preserve canonical relation direction even when queried from the ______ Goal.
5. Logical-reference anomalies are surfaced rather than silently ______.

<details>
<summary>点击查看答案</summary>

1. pursuing
2. ended
3. end
4. target
5. dropped
</details>
