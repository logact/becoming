# Issue #39: Task: Complete workflow state history and provenance coverage

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define reusable workflow state templates (#25)

---

## 1. Original English

Parent Feature: #25

## Outcome

Template state lifecycle is queryable and auditable without losing definitions used by historical Workflow versions.

## Implementation plan

1. Add active and historical machine query services exposing category, initial/terminal semantics, order, and entry/exit criteria.
2. Integrate state create/update/reorder/archive with mutation provenance in the same transaction, using relevant before/after fields.
3. Define historical resolution behavior for archived Workflows, Labels, and States so past versions remain meaningful.
4. Build feature-level acceptance tests across multiple workflow/entity-type/label machines.

## Acceptance criteria

- [ ] Active queries omit archived states while historical queries resolve them.
- [ ] Initial and terminal states can be discovered without reinterpreting free text.
- [ ] State mutations emit exactly the expected provenance or roll back together.
- [ ] Historical Workflow versions keep their archived states resolvable.
- [ ] Tests cover isolation between machines sharing a Workflow, entity type, or Label dimension.

## Tests

- Query contract tests for active/historical modes and initial/terminal/category filters.
- Provenance integration tests for create, update, reorder, and archive.
- Multi-machine acceptance test and archived-version regression test.

## Dependencies

- The preceding Feature #25 tasks.
- Feature #30 mutation provenance.
- Feature #10 consumes historical records.

## Out of scope

- Transition template execution.
- A workflow visualization UI.

---

## 2. 中文翻译

父特性：#25

## 预期成果

模板状态生命周期可查询、可审计，且不会丢失被历史工作流版本使用的定义。

## 实现计划

1. 添加活跃和历史机器查询服务，暴露类别、初始/终止语义、排序以及准入/退出条件。
2. 将状态创建/更新/排序/归档与同一事务中的变更溯源集成，使用相关的变更前/后字段。
3. 定义已归档工作流、标签和状态的历史解析行为，使过去版本保持有意义。
4. 构建跨多个工作流/实体类型/标签机器的特性级验收测试。

## 验收标准

- [ ] 活跃查询排除已归档状态，而历史查询可以解析它们。
- [ ] 初始和终止状态可以不通过重新解释自由文本来发现。
- [ ] 状态变更发出预期的溯源记录，否则一起回滚。
- [ ] 历史工作流版本使其已归档状态保持可解析。
- [ ] 测试覆盖共享工作流、实体类型或标签维度的机器之间的隔离。

## 测试

- 活跃/历史模式和初始/终止/类别过滤的查询契约测试。
- 创建、更新、排序和归档的溯源集成测试。
- 多机器验收测试和已归档版本回归测试。

## 依赖

- 特性 #25 的前置任务。
- 特性 #30 变更溯源。
- 特性 #10 消费历史记录。

## 范围外

- 转换模板执行。
- 工作流可视化界面。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define historical resolution behavior for archived Workflows, Labels, and States so past versions remain meaningful. |
| archive | 归档 | Integrate state create/update/reorder/archive with mutation provenance in the same transaction, using relevant before/after fields. |
| query | 查询 | Add active and historical machine query services exposing category, initial/terminal semantics, order, and entry/exit criteria. |
| emit | 产生/发出 | State mutations emit exactly the expected provenance or roll back together. |
| roll back | 回滚 | State mutations emit exactly the expected provenance or roll back together. |
| integrate | 集成 | Integrate state create/update/reorder/archive with mutation provenance in the same transaction, using relevant before/after fields. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| add | 添加 | Add active and historical machine query services exposing category, initial/terminal semantics, order, and entry/exit criteria. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| exit criteria | 退出条件 | Add active and historical machine query services exposing category, initial/terminal semantics, order, and entry/exit criteria. |
| historical resolution | 历史解析 | Define historical resolution behavior for archived Workflows, Labels, and States so past versions remain meaningful. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Exit criteria | 退出条件 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Archiving a Workflow must not invalidate historical project _______.
3. Required source _______ must pass before a transition is authorized.
4. Consumers can _______ active Workflows by type and version.
5. Mutations should _______ provenance recording in the same transaction.

<details>
<summary>点击查看答案</summary>

1. provenance
2. execution
3. exit criteria
4. query
5. integrate

</details>
