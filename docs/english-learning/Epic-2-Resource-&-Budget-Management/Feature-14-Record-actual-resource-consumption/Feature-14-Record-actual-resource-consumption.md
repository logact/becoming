# Issue #14: Feature: Record actual resource consumption

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can record actual resource use against a Project and, when applicable, a Task at a specific time.

## Scope

- Create resource-usage Records.
- Link usage to the consumed Resource and relevant Project and Task.
- Store amount, unit, occurrence time, actor, and optional execution context.
- Validate project/task/resource consistency.

## Acceptance criteria

- Usage always identifies a Project, Resource, amount, unit, and occurrence time.
- Task attribution is optional, but an attributed Task must belong to the Project context.
- Amounts use unit-compatible decimal precision.
- Correcting a usage entry preserves an inspectable correction trail.
- Usage can be queried by Project, Task, Resource, and time window.
- Recording usage does not rewrite the planned budget or allocation.

## Dependencies

- Feature: Record occurrences as first-class domain data.
- Feature: Define resource catalogs and available capacity.
- Feature: Budget resources to projects.
- Feature: Manage tasks and project membership.

## Out of scope

- Invoicing and payment reconciliation.
- Automated collection from external providers.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以记录针对某个项目、并在适用时针对某个特定时间点的任务的实际资源使用情况。

## 范围

- 创建资源使用记录。
- 将使用与消耗的资源以及相关的项目和任务关联起来。
- 存储金额、单位、发生时间、执行者和可选的执行上下文。
- 验证项目/任务/资源之间的一致性。

## 验收标准

- 使用记录始终标识项目、资源、金额、单位和发生时间。
- 任务归属是可选的，但被归属的任务必须属于该项目上下文。
- 金额使用单位兼容的小数精度。
- 更正使用记录会保留可审查的更正轨迹。
- 可以按项目、任务、资源和时间窗口查询使用记录。
- 记录使用不会重写计划预算或分配。

## 依赖

- Feature：将发生记录作为一等领域数据。
- Feature：定义资源目录和可用容量。
- Feature：为项目预算资源。
- Feature：管理任务和项目成员资格。

## 排除范围

- 开票和付款对账。
- 从外部提供方自动采集。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| record | 记录 | Record actual resource use against a Project. |
| link | 关联 | Link usage to the consumed Resource. |
| store | 存储 | Store amount, unit, occurrence time, and actor. |
| validate | 验证 | Validate project/task/resource consistency. |
| identify | 标识 | Usage always identifies a Project and Resource. |
| attribute | 归属 | Task attribution is optional. |
| correct | 更正 | Correcting a usage entry preserves a correction trail. |
| query | 查询 | Usage can be queried by Project, Task, Resource, and time window. |
| rewrite | 重写 | Recording usage does not rewrite the planned budget. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| actual resource use | 实际资源使用 | record actual resource use |
| resource-usage Records | 资源使用记录 | create resource-usage Records |
| consumed Resource | 消耗的资源 | link usage to the consumed Resource |
| occurrence time | 发生时间 | store occurrence time |
| execution context | 执行上下文 | optional execution context |
| project/task/resource consistency | 项目/任务/资源一致性 | validate consistency |
| Task attribution | 任务归属 | Task attribution is optional |
| decimal precision | 小数精度 | unit-compatible decimal precision |
| correction trail | 更正轨迹 | preserve an inspectable correction trail |
| time window | 时间窗口 | query by time window |

### 值得模仿的句式
1. **“Users can record actual resource use against a Project and, when applicable, a Task at a specific time.”** — “用户可以记录针对某个项目、并在适用时针对某个特定时间点的任务的实际资源使用情况。” — *Users can record actual resource use against a Project and, when applicable, a Task at a specific time.*
2. **“Correcting a usage entry preserves an inspectable correction trail.”** — “更正使用记录会保留可审查的更正轨迹。” — *Correcting a usage entry preserves an inspectable correction trail.*
3. **“Recording usage does not rewrite the planned budget or allocation.”** — “记录使用不会重写计划预算或分配。” — *Recording usage does not rewrite the planned budget or allocation.*
4. **“Task attribution is optional, but an attributed Task must belong to the Project context.”** — “任务归属是可选的，但被归属的任务必须属于该项目上下文。” — *Task attribution is optional, but an attributed Task must belong to the Project context.*

### 领域词汇
| English | 中文 |
|---|---|
| resource usage Record | 资源使用记录 |
| consumed Resource | 消耗的资源 |
| occurrence time | 发生时间 |
| execution context | 执行上下文 |
| project/task/resource consistency | 项目/任务/资源一致性 |
| Task attribution | 任务归属 |
| decimal precision | 小数精度 |
| correction trail | 更正轨迹 |
| time window | 时间窗口 |
| planned budget | 计划预算 |
| allocation | 分配 |

---

## 4. 小练习

1. Users can record actual resource ______ against a Project and, when applicable, a Task.
2. Usage should be linked to the consumed ______ and relevant Project and Task.
3. Task ______ is optional, but an attributed Task must belong to the Project context.
4. Correcting a usage entry preserves an inspectable ______ trail.
5. Recording usage does not ______ the planned budget or allocation.

<details>
<summary>点击查看答案</summary>

1. use  
2. Resource  
3. attribution  
4. correction  
5. rewrite

</details>
