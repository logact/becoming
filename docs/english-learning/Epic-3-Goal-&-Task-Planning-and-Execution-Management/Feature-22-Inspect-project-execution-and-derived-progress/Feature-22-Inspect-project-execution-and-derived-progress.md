# Issue #22: Feature: Inspect project execution and derived progress

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users can inspect a Project's work structure, current lifecycle state, and progress toward its Goals in one coherent view.

## Scope

- Return a Project's pursued Goals, nested work, and active Tasks.
- Include current project-scoped lifecycle states where configured.
- Derive progress from contained work using explicit terminal-state/category rules.
- Surface incomplete, blocked, and structurally invalid work.
- Keep derived progress separate from intrinsic Project fields.

## Acceptance criteria

- A Project execution query returns its relevant Goal and Task hierarchy.
- Each managed entity includes its current state for each applicable management label.
- Progress calculation has a documented denominator and terminal-state rule.
- Empty Projects and entities without a state machine produce defined results.
- Archived or ended relationships can be excluded from current views and included in historical views.
- Invalid hierarchy or multiple-current-state anomalies are surfaced rather than silently ignored.

## Dependencies

- Feature: Decompose goals and tasks with hierarchy safeguards.
- Feature: Execute project-scoped lifecycle transitions.

## Out of scope

- Resource consumption summaries.
- Predictive completion dates.
- A specific visual dashboard.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户可以在一个连贯的视图中检查项目的工作结构、当前生命周期状态以及朝着其目标的进展。

## 范围

- 返回项目追求的目标、嵌套工作和活动任务。
- 在配置的地方包含当前项目范围生命周期状态。
- 使用明确的终止状态/类别规则从包含的工作中派生进度。
- 呈现不完整、阻塞和结构无效的工作。
- 将派生进度与项目内在字段分开。

## 验收标准

- 项目执行查询返回其相关的目标和任务层级。
- 每个受管理实体包含每个适用管理标签的当前状态。
- 进度计算具有文档化的分母和终止状态规则。
- 空项目和没有状态机的实体产生定义的结果。
- 已归档或已结束的关系可以从当前视图中排除，并包含在历史视图中。
- 无效层级或多当前状态异常会被呈现，而不是被默默忽略。

## 依赖

- Feature：在层级保护下分解目标与任务。
- Feature：执行项目范围生命周期转换。

## 超出范围

- 资源消耗摘要。
- 预测完成日期。
- 特定的可视化仪表板。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| inspect | 检查 | inspect a Project's work structure |
| derive | 派生 | Derive progress from contained work |
| surface | 呈现 | Surface incomplete, blocked, and structurally invalid work |
| return | 返回 | Return a Project's pursued Goals |
| include | 包含 | Include current project-scoped lifecycle states |
| exclude | 排除 | excluded from current views |
| produce | 产生 | produce defined results |
| keep | 保持 | Keep derived progress separate |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| coherent view | 连贯视图 | in one coherent view |
| work structure | 工作结构 | Project's work structure |
| lifecycle state | 生命周期状态 | current lifecycle state |
| terminal-state rule | 终止状态规则 | terminal-state/category rules |
| management label | 管理标签 | applicable management label |
| derived progress | 派生进度 | derived progress separate from intrinsic fields |
| intrinsic fields | 内在字段 | intrinsic Project fields |
| visual dashboard | 可视化仪表板 | specific visual dashboard |

### 值得模仿的句式
1. **"Users can inspect A, B, and C in one D view."** — 用户可以在一个 D 视图中检查 A、B 和 C。 — Users can inspect a Project's work structure, current lifecycle state, and progress toward its Goals in one coherent view.
2. **"A has a documented B and C rule."** — A 具有文档化的 B 和 C 规则。 — Progress calculation has a documented denominator and terminal-state rule.
3. **"A are surfaced rather than silently B."** — A 会被呈现，而不是被默默 B。 — Invalid hierarchy or multiple-current-state anomalies are surfaced rather than silently ignored.

### 领域词汇
| English | 中文 |
|---|---|
| Execution | 执行 |
| Progress | 进度 |
| Lifecycle state | 生命周期状态 |
| Terminal state | 终止状态 |
| Denominator | 分母 |
| Management label | 管理标签 |
| Intrinsic field | 内在字段 |
| Anomaly | 异常 |
| Dashboard | 仪表板 |

---

## 4. 小练习

1. Users can inspect a Project's work structure, current lifecycle state, and ______ toward its Goals.
2. Derive progress from contained work using explicit terminal-state/______ rules.
3. Keep derived progress separate from ______ Project fields.
4. Empty Projects and entities without a state machine produce ______ results.
5. Archived relationships can be ______ from current views.

<details>
<summary>点击查看答案</summary>

1. progress
2. category
3. intrinsic
4. defined
5. excluded
</details>
