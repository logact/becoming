# Issue #2: Epic: Resource & Budget Management

**Labels:** Epic  
**State:** OPEN  
**Parent:** None

---

## 1. Original English

## Purpose

Represent limited resources, allocate them to planned work, and track actual consumption.

## Scope

- Define Resource Types such as time, money, AI tokens, compute, and energy.
- Define available Resource pools.
- Set Project budgets.
- Allocate resource budgets to Tasks.
- Record consumption with project, task, time, and amount associations.
- Calculate consumed and remaining resources.
- Compare planned consumption with actual consumption.
- Provide a foundation for detecting resource exhaustion.

Example: a Project may have 100 hours, ¥20,000, and 10M AI tokens, with portions allocated to individual Tasks.

## Non-goals

- General accounting or billing.
- Resource scheduling beyond the initial allocation model.
- Automated exhaustion remediation in the first iteration.

## Acceptance criteria

- Resource types support appropriate units and precision.
- Projects can define budgets from available resource pools.
- Tasks can receive explicit allocations.
- Consumption records can be attributed to a Project and, where applicable, a Task.
- The system calculates consumed and remaining amounts.
- Planned versus actual usage is queryable.
- Over-allocation and exhausted budgets are surfaced clearly.

## Dependencies

- Goal & Task Planning and Execution Management for Task associations.
- Data Provenance & History for budget and consumption records.

This issue is labeled Epic.

---

## 2. 中文翻译

## 目的

表示有限资源，将其分配给计划内的工作，并跟踪实际消耗。

## 范围

- 定义资源类型，例如时间、金钱、AI token、计算能力和精力。
- 定义可用的资源池。
- 设置项目预算。
- 将资源预算分配给任务。
- 记录与项目、任务、时间和金额相关联的消耗。
- 计算已消耗和剩余资源。
- 对比计划消耗与实际消耗。
- 为检测资源耗尽提供基础。

示例：一个项目可能拥有 100 小时、¥20,000 和 1000 万 AI token，其中一部分会分配给单个任务。

## 非目标

- 通用会计或计费。
- 超出初始分配模型的资源调度。
- 在第一轮迭代中自动修复资源耗尽问题。

## 验收标准

- 资源类型支持合适的单位和精度。
- 项目可以从可用资源池中定义预算。
- 任务可以获得明确的分配。
- 消耗记录可以归属于某个项目，并在适用时归属于某个任务。
- 系统计算已消耗和剩余金额。
- 计划用量与实际用量可被查询。
- 超额分配和预算耗尽会被清晰地暴露出来。

## 依赖

- 目标与任务规划及执行管理，用于任务关联。
- 数据来源与历史记录，用于预算和消耗记录。

本 issue 标记为 Epic。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| represent | 表示、表征 | Represent limited resources in the domain model. |
| allocate | 分配 | Allocate resource budgets to Tasks. |
| track | 跟踪 | Track actual consumption over time. |
| define | 定义 | Define Resource Types such as time and money. |
| calculate | 计算 | Calculate consumed and remaining amounts. |
| compare | 对比 | Compare planned consumption with actual consumption. |
| provide | 提供 | Provide a foundation for detecting resource exhaustion. |
| surface | 暴露、呈现 | Over-allocation and exhausted budgets are surfaced clearly. |
| attribute | 归因、归属 | Consumption records can be attributed to a Project. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| limited resources | 有限资源 | limited resources that must be planned carefully |
| planned work | 计划内工作 | allocate resources to planned work |
| actual consumption | 实际消耗 | track actual consumption against the budget |
| resource pools | 资源池 | define budgets from available resource pools |
| project budgets | 项目预算 | set Project budgets at the start |
| amount associations | 金额关联 | record time and amount associations |
| resource exhaustion | 资源耗尽 | detect resource exhaustion early |
| over-allocation | 超额分配 | surface over-allocation to the user |
| acceptance criteria | 验收标准 | list the acceptance criteria clearly |
| planned versus actual | 计划 vs 实际 | compare planned versus actual usage |

### 值得模仿的句式
1. **“Represent X, allocate Y to Z, and track W.”** — “表示 X，将 Y 分配给 Z，并跟踪 W。” — *Represent limited resources, allocate them to planned work, and track actual consumption.*
2. **“Provide a foundation for doing something.”** — “为做某事奠定基础。” — *Provide a foundation for detecting resource exhaustion.*
3. **“X is surfaced clearly.”** — “X 被清晰地暴露/呈现出来。” — *Over-allocation and exhausted budgets are surfaced clearly.*
4. **“Planned versus actual usage is queryable.”** — “计划用量与实际用量是可查询的。” — *Planned versus actual usage is queryable.*

### 领域词汇
| English | 中文 |
|---|---|
| Resource Types | 资源类型 |
| Resource pools | 资源池 |
| Project budgets | 项目预算 |
| Task allocations | 任务分配 |
| consumption record | 消耗记录 |
| planned consumption | 计划消耗 |
| actual consumption | 实际消耗 |
| resource exhaustion | 资源耗尽 |
| over-allocation | 超额分配 |
| acceptance criteria | 验收标准 |

---

## 4. 小练习

1. The system must ______ limited resources, allocate them to planned work, and ______ actual consumption.
2. A Project may have 100 hours, ¥20,000, and 10M AI tokens, with portions ______ to individual Tasks.
3. We need to compare ______ consumption with ______ consumption.
4. Over-allocation and exhausted budgets should be ______ clearly.
5. Resource types must support appropriate units and ______.

<details>
<summary>点击查看答案</summary>

1. represent, track  
2. allocated  
3. planned, actual  
4. surfaced  
5. precision

</details>
