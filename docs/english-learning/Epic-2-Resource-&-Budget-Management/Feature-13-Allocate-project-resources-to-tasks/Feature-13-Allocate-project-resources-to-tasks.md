# Issue #13: Feature: Allocate project resources to tasks

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can plan how much of a Project's resource budget is available to an individual Task.

## Scope

- Represent Task-to-Resource allocation relationships.
- Associate allocations with the Project context that funds them.
- Validate amount, unit, task membership, and active Project budget.
- Support changing or ending allocations without erasing prior plans.

## Acceptance criteria

- A Task can receive explicit allocations for multiple Resources.
- An allocation identifies its Project context, Resource, amount, and unit.
- Allocations cannot silently draw from an unrelated Project budget.
- The total active allocation is calculable per Project and Resource.
- Over-allocation is rejected or clearly flagged according to an explicit policy.
- Allocation changes are historically inspectable.

## Dependencies

- Feature: Budget resources to projects.
- Feature: Manage tasks and project membership.
- Feature: Track relationship changes over time.

## Out of scope

- Resource scheduling.
- Automatic redistribution among Tasks.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以规划项目资源预算中有多少可用于单个任务。

## 范围

- 表示任务到资源的分配关系。
- 将分配与为其提供资金的项目上下文关联。
- 验证金额、单位、任务成员资格和活跃项目预算。
- 支持更改或结束分配，而不擦除先前的计划。

## 验收标准

- 一个任务可以获得多种资源的明确分配。
- 分配标明其项目上下文、资源、金额和单位。
- 分配不能静默地从不相关的项目预算中支取。
- 可以按项目和资源计算总活跃分配。
- 根据明确的策略，超额分配会被拒绝或清晰地标记。
- 分配变更是可以按历史审查的。

## 依赖

- Feature：为项目预算资源。
- Feature：管理任务和项目成员资格。
- Feature：跟踪关系随时间的变化。

## 排除范围

- 资源调度。
- 任务之间的自动重新分配。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| plan | 规划 | Plan how much of a budget is available to a Task. |
| represent | 表示 | Represent Task-to-Resource allocation relationships. |
| associate | 关联 | Associate allocations with the Project context. |
| validate | 验证 | Validate amount, unit, task membership, and active budget. |
| support | 支持 | Support changing or ending allocations. |
| receive | 接收 | A Task can receive explicit allocations. |
| identify | 标识 | An allocation identifies its Project context. |
| draw | 支取 | Allocations cannot silently draw from an unrelated budget. |
| calculate | 计算 | The total active allocation is calculable. |
| flag | 标记 | Over-allocation is clearly flagged. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| resource budget | 资源预算 | how much of a Project's resource budget |
| individual Task | 单个任务 | available to an individual Task |
| Task-to-Resource allocation | 任务到资源分配 | represent allocation relationships |
| Project context | 项目上下文 | associate allocations with the Project context |
| task membership | 任务成员资格 | validate task membership |
| active Project budget | 活跃项目预算 | validate against the active Project budget |
| explicit allocations | 明确分配 | receive explicit allocations |
| unrelated Project budget | 不相关的项目预算 | draw from an unrelated Project budget |
| total active allocation | 总活跃分配 | total active allocation per Project and Resource |
| explicit policy | 明确的策略 | according to an explicit policy |

### 值得模仿的句式
1. **“Users can plan how much of a Project's resource budget is available to an individual Task.”** — “用户可以规划项目资源预算中有多少可用于单个任务。” — *Users can plan how much of a Project's resource budget is available to an individual Task.*
2. **“Represent Task-to-Resource allocation relationships.”** — “表示任务到资源的分配关系。” — *Represent Task-to-Resource allocation relationships.*
3. **“Support changing or ending allocations without erasing prior plans.”** — “支持更改或结束分配，而不擦除先前的计划。” — *Support changing or ending allocations without erasing prior plans.*
4. **“Over-allocation is rejected or clearly flagged according to an explicit policy.”** — “根据明确的策略，超额分配会被拒绝或清晰地标记。” — *Over-allocation is rejected or clearly flagged according to an explicit policy.*

### 领域词汇
| English | 中文 |
|---|---|
| Task-to-Resource allocation | 任务到资源分配 |
| Project context | 项目上下文 |
| task membership | 任务成员资格 |
| active Project budget | 活跃项目预算 |
| explicit allocation | 明确分配 |
| total active allocation | 总活跃分配 |
| over-allocation | 超额分配 |
| explicit policy | 明确的策略 |
| historical inspectability | 历史可审查性 |
| redistribution | 重新分配 |

---

## 4. 小练习

1. Users can plan how much of a Project's ______ budget is available to an individual Task.
2. We need to represent Task-to-Resource ______ relationships.
3. Allocations must be associated with the ______ context that funds them.
4. Allocations cannot silently ______ from an unrelated Project budget.
5. Over-allocation is rejected or clearly ______ according to an explicit policy.

<details>
<summary>点击查看答案</summary>

1. resource  
2. allocation  
3. Project  
4. draw  
5. flagged

</details>
