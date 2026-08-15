# Issue #81: Task: Query durable lifecycle audit history

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Audit lifecycle state transitions (#9)

---

## 1. Original English

Parent Feature: #9 — Feature: Audit lifecycle state transitions

## Outcome

Consumers can retrieve a project's or entity's chronological lifecycle audit trail, including actor, transition time, states, and evaluation evidence, even after related definitions change.

## Implementation plan

1. Add framework-neutral application queries for state-transition Records by project, managed entity, management label, state/transition reference, actor, and time window.
2. Return the payload's immutable state/machine snapshots alongside live logical references when those references still resolve.
3. Define deterministic chronological ordering and an archive-visibility contract suitable for later entity-timeline composition.
4. Degrade gracefully when a referenced Workflow, Project State, Label, or entity has been archived or changed, using stored audit context rather than failing the history result.
5. Return explicit errors for invalid entity-type/filter inputs while treating legitimately missing live definitions as historical reference status, not data loss.

## Acceptance criteria

- [ ] Transition time and actor are independently queryable and returned for each result.
- [ ] Project, entity, label, from-state, and to-state filters can be combined with deterministic ordering.
- [ ] Results expose condition/exit-criteria outcomes without leaking filtered sensitive inputs.
- [ ] Historical entries remain understandable after workflow or project-machine changes or archival.
- [ ] Archived historical Records remain available according to the caller's authorization/archive-visibility context.
- [ ] Invalid filters return explicit errors without hiding otherwise valid history.

## Tests

- Repository/application contract-test combined filters, stable ordering, actor/time queries, and archive inclusion.
- Modify/archive referenced project-machine definitions after a transition and assert stored snapshots still produce meaningful results.
- Test unresolved live references are reported gracefully rather than dropping the event.
- Test invalid entity types and filters.

## Dependencies

- Parent Feature #9.
- Task: Commit state history and transition audit atomically.
- #57 — Task: Query, classify, and link occurrence Records, for shared Record filtering/archive visibility.

## Out of scope

- Generic aggregation of mutation, relation, lineage, and lifecycle events (Feature #10).
- Definition or execution of lifecycle rules.
- Audit-history UI.

---

## 2. 中文翻译

父功能：#9 — 功能：审计生命周期状态转换

## 成果

消费者可以检索项目或实体按时间顺序排列的生命周期审计线索，包括行为者、转换时间、状态和评估证据，即使在相关定义变更后。

## 实施计划

1. 添加按项目、管理实体、管理标签、状态/转换引用、行为者和时间窗口查询状态转换记录的与框架无关的应用查询。
2. 当这些引用仍能解析时，返回载荷的不可变状态/机器快照以及实时逻辑引用。
3. 定义确定性时间顺序排序和适合后续实体时间线组合的归档可见性合同。
4. 当引用的工作流、项目状态、标签或实体已归档或变更时，使用存储的审计上下文优雅降级，而不是使历史结果失败。
5. 对无效实体类型/过滤器输入返回显式错误，同时将合法缺失的实时定义视为历史引用状态，而不是数据丢失。

## 验收标准

- [ ] 转换时间和行为者可独立查询，并为每个结果返回。
- [ ] 项目、实体、标签、源状态和目标状态过滤器可以组合，并带有确定性排序。
- [ ] 结果暴露条件/退出标准结果，而不泄露被过滤的敏感输入。
- [ ] 历史条目在工作流或项目机器变更或归档后仍然可理解。
- [ ] 归档历史记录根据调用者的授权/归档可见性上下文保持可用。
- [ ] 无效过滤器返回显式错误，而不隐藏其他有效历史。

## 测试

- 仓库/应用合同测试组合过滤器、稳定排序、行为者/时间查询和归档包含。
- 在转换后修改/归档引用的项目机器定义，并断言存储快照仍能产生有意义的结果。
- 测试未解析的实时引用被优雅报告，而不是丢弃事件。
- 测试无效实体类型和过滤器。

## 依赖

- 父功能 #9。
- 任务：原子性地提交状态历史和转换审计。
- #57 — 任务：查询、分类和链接发生记录，用于共享记录过滤/归档可见性。

## 范围外

- 变更、关系、谱系和生命周期事件的通用聚合（功能 #10）。
- 生命周期规则的定义或执行。
- 审计历史 UI。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| retrieve | 检索 | Consumers can retrieve a project's or entity's chronological lifecycle audit trail. |
| expose | 暴露 | Results expose condition/exit-criteria outcomes. |
| degrade | 降级 | Degrade gracefully when referenced definitions have been archived or changed. |
| resolve | 解析 | Return live logical references when those references still resolve. |
| report | 报告 | Unresolved live references are reported gracefully. |
| drop | 丢弃 | ...rather than dropping the event. |
| hide | 隐藏 | Invalid filters return explicit errors without hiding otherwise valid history. |
| combine | 组合 | Project, entity, label, from-state, and to-state filters can be combined. |
| remain | 保持 | Historical entries remain understandable after workflow changes. |
| leak | 泄露 | ...without leaking filtered sensitive inputs. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| durable lifecycle audit history | 持久的生命周期审计历史 | 长期保存的审计记录 |
| chronological audit trail | 按时间顺序的审计线索 | 时间线形式的审计记录 |
| state-transition Records | 状态转换记录 | 记录状态转换的实体 |
| immutable snapshots | 不可变快照 | 不可更改的历史副本 |
| live logical references | 实时逻辑引用 | 仍能解析的当前引用 |
| deterministic chronological ordering | 确定性时间顺序排序 | 稳定的时间排序 |
| archive-visibility contract | 归档可见性合同 | 归档数据可见性的约定 |
| graceful degradation | 优雅降级 | 失败时仍能部分工作 |
| historical reference status | 历史引用状态 | 对历史引用的描述状态 |
| data loss | 数据丢失 | 历史数据的丢失 |

### 值得模仿的句式
1. **“Consumers can retrieve a project's or entity's chronological lifecycle audit trail...”** — 消费者可以检索项目或实体按时间顺序排列的生命周期审计线索... — 例句：Consumers can retrieve a user's chronological login audit trail.
2. **“...degrade gracefully when referenced definitions have been archived or changed.”** — ...当引用的定义已归档或变更时优雅降级。 — 例句：The UI degrades gracefully when referenced images are missing.
3. **“...treating legitimately missing live definitions as historical reference status, not data loss.”** — ...将合法缺失的实时定义视为历史引用状态，而不是数据丢失。 — 例句：Treat missing live definitions as historical reference status, not data loss.

### 领域词汇
| English | 中文 |
|---|---|
| Audit trail | 审计线索 |
| Immutable snapshot | 不可变快照 |
| Live reference | 实时引用 |
| Archive-visibility contract | 归档可见性合同 |
| Graceful degradation | 优雅降级 |
| Historical reference status | 历史引用状态 |
| Evaluation evidence | 评估证据 |
| State/transition reference | 状态/转换引用 |
| Chronological ordering | 时间顺序排序 |
| Authorization context | 授权上下文 |

---

## 4. 小练习

1. Consumers can retrieve a project's or entity's chronological lifecycle audit ______.
2. Return the payload's immutable state/machine snapshots alongside live logical ______.
3. Define deterministic chronological ordering and an archive-visibility ______ suitable for later entity-timeline composition.
4. Degrade ______ when a referenced Workflow or Project State has been archived or changed.
5. Treat legitimately missing live definitions as historical reference status, not ______.

<details>
<summary>点击查看答案</summary>

1. trail
2. references
3. contract
4. gracefully
5. data loss

</details>
