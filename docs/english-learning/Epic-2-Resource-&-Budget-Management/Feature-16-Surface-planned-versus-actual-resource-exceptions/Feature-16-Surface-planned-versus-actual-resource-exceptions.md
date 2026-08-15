# Issue #16: Feature: Surface planned versus actual resource exceptions

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can quickly identify over-allocation, exhausted budgets, and material differences between planned and actual resource use.

## Scope

- Compare Project budgets, Task allocations, and actual consumption.
- Derive over-allocated, exhausted, and over-consumed conditions.
- Expose status and supporting amounts through query interfaces.
- Keep detection informational in V1 unless a domain policy explicitly rejects an operation.

## Acceptance criteria

- A Project Resource is flagged when active Task allocations exceed its active budget.
- A Project Resource is flagged when actual consumption reaches or exceeds its budget.
- A Task Resource is flagged when attributed consumption exceeds its allocation.
- Each exception includes the planned amount, actual amount, variance, unit, and affected context.
- Boundary behavior at exactly zero remaining is explicitly tested.
- Consumers can query only active exceptions or include resolved historical exceptions.

## Dependencies

- Feature: Calculate resource usage and remaining balances.

## Out of scope

- Automated remediation or reallocation.
- General financial reporting.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以快速识别超额分配、预算耗尽以及计划与实际资源使用之间的显著差异。

## 范围

- 比较项目预算、任务分配和实际消耗。
- 推导出超额分配、耗尽和超消耗状态。
- 通过查询接口暴露状态和支持金额。
- 在 V1 中保持检测为信息性的，除非领域策略明确拒绝某个操作。

## 验收标准

- 当活跃任务分配超过活跃预算时，项目资源会被标记。
- 当实际消耗达到或超过预算时，项目资源会被标记。
- 当归属的消耗超过分配时，任务资源会被标记。
- 每个异常包含计划金额、实际金额、方差、单位和受影响的上下文。
- 正好剩余为零的边界行为会被明确测试。
- 消费者可以只查询活跃异常，或包含已解决的历史异常。

## 依赖

- Feature：计算资源使用和剩余余额。

## 排除范围

- 自动修复或重新分配。
- 通用财务报告。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| identify | 识别 | Identify over-allocation and exhausted budgets. |
| compare | 比较 | Compare Project budgets, Task allocations, and actual consumption. |
| derive | 推导 | Derive over-allocated, exhausted, and over-consumed conditions. |
| expose | 暴露、公开 | Expose status and supporting amounts. |
| flag | 标记 | A Project Resource is flagged. |
| exceed | 超出 | Allocations exceed the active budget. |
| reach | 达到 | Consumption reaches or exceeds its budget. |
| include | 包含 | Each exception includes planned and actual amounts. |
| query | 查询 | Consumers can query active or resolved exceptions. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| over-allocation | 超额分配 | identify over-allocation |
| exhausted budgets | 耗尽的预算 | identify exhausted budgets |
| material differences | 显著差异 | material differences between planned and actual |
| planned and actual resource use | 计划与实际资源使用 | compare planned and actual resource use |
| actual consumption | 实际消耗 | compare actual consumption with budgets |
| over-allocated condition | 超额分配状态 | derive over-allocated conditions |
| over-consumed condition | 超消耗状态 | derive over-consumed conditions |
| query interfaces | 查询接口 | expose status through query interfaces |
| informational detection | 信息性检测 | keep detection informational |
| domain policy | 领域策略 | unless a domain policy rejects an operation |
| resolved historical exceptions | 已解决的历史异常 | include resolved historical exceptions |

### 值得模仿的句式
1. **“Users can quickly identify over-allocation, exhausted budgets, and material differences between planned and actual resource use.”** — “用户可以快速识别超额分配、预算耗尽以及计划与实际资源使用之间的显著差异。” — *Users can quickly identify over-allocation, exhausted budgets, and material differences between planned and actual resource use.*
2. **“Keep detection informational in V1 unless a domain policy explicitly rejects an operation.”** — “在 V1 中保持检测为信息性的，除非领域策略明确拒绝某个操作。” — *Keep detection informational in V1 unless a domain policy explicitly rejects an operation.*
3. **“A Project Resource is flagged when active Task allocations exceed its active budget.”** — “当活跃任务分配超过活跃预算时，项目资源会被标记。” — *A Project Resource is flagged when active Task allocations exceed its active budget.*
4. **“Consumers can query only active exceptions or include resolved historical exceptions.”** — “消费者可以只查询活跃异常，或包含已解决的历史异常。” — *Consumers can query only active exceptions or include resolved historical exceptions.*

### 领域词汇
| English | 中文 |
|---|---|
| planned versus actual | 计划与实际 |
| resource exception | 资源异常 |
| over-allocation | 超额分配 |
| exhausted budget | 预算耗尽 |
| over-consumption | 超消耗 |
| material difference | 显著差异 |
| informational detection | 信息性检测 |
| domain policy | 领域策略 |
| active exception | 活跃异常 |
| resolved historical exception | 已解决的历史异常 |
| zero remaining boundary | 剩余为零边界 |

---

## 4. 小练习

1. Users can quickly identify over-allocation, exhausted budgets, and ______ differences between planned and actual resource use.
2. The system derives over-allocated, exhausted, and ______ conditions from balance data.
3. Detection should be kept ______ in V1 unless a domain policy explicitly rejects an operation.
4. A Project Resource is flagged when active Task allocations ______ its active budget.
5. Consumers can query only active exceptions or include ______ historical exceptions.

<details>
<summary>点击查看答案</summary>

1. material  
2. over-consumed  
3. informational  
4. exceed  
5. resolved

</details>
