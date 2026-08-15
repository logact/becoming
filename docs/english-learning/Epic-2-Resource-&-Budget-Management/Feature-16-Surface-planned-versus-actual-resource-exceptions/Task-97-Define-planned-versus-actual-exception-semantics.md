# Issue #97: Task: Define planned-versus-actual exception semantics

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Surface planned versus actual resource exceptions (#16)

---

## 1. Original English

## Outcome

Define precise, informational planned-versus-actual exception categories and boundaries over the unit-safe balance results from Feature #15.

Parent Feature: #16

## Implementation plan

1. Define Project over-allocation when `allocated > budgeted`, Project exhaustion when `consumed >= budgeted`, and Task over-consumption when attributed `consumed > allocated`.
2. Specify exact-zero behavior: a Project with zero remaining is exhausted, while equal allocation/budget and equal Task consumption/allocation are not over exceptions.
3. Define a transport-neutral exception value containing type/status, Resource, unit, Project, optional Task, planned amount, actual/comparison amount, signed variance, evaluated/as-of time, and contributor trace IDs.
4. Define stable exception identity and active/resolved evaluation semantics without requiring a mutable exception table; retain support for later explicit rejection policies at command boundaries.
5. Require exact decimal/unit partitioning and explicit integrity errors for incompatible inputs; keep V1 detection informational.

## Acceptance criteria

- [ ] The three required exception types have exact formulas and unambiguous equality boundaries.
- [ ] Each exception contains planned, actual/comparison, signed variance, unit, affected Project/optional Task, and supporting trace IDs.
- [ ] Exactly zero Project remaining is exhausted; equality alone is not over-allocation or Task over-consumption.
- [ ] Exception identity and active/resolved semantics work with derived current and historical results.
- [ ] Incompatible units are never compared.
- [ ] V1 detection is informational and introduces no automated remediation, financial reporting, or database foreign keys.

## Tests

- Add table-driven tests immediately below, at, and above every threshold.
- Test fractional exact values, signed variance, identity stability, and incompatible units.
- Test the explicit zero-budget/zero-consumption policy and document any integrity preconditions inherited from Feature #15.

## Dependencies

- Feature #15, Calculate resource usage and remaining balances (tasks #82-#84).

## Out of scope

- Query/read-model implementation.
- Automated remediation/reallocation, notifications, forecasting, general financial reporting, accounting, and billing.

---

## 2. 中文翻译

## 成果

基于 Feature #15 的单位安全余额结果，定义精确且信息性的计划与实际异常类别和边界。

父 Feature：#16

## 实施计划

1. 定义项目超额分配：`allocated > budgeted`；项目耗尽：`consumed >= budgeted`；任务超消耗：归属的 `consumed > allocated`。
2. 指定精确的零值行为：剩余为零的项目视为耗尽，而分配等于预算、任务消耗等于分配并不算超额异常。
3. 定义一个与传输无关的异常值，包含类型/状态、资源、单位、项目、可选任务、计划金额、实际/比较金额、带符号方差、评估/截至某个时间点时间以及贡献者跟踪 ID。
4. 在不依赖可变异常表的情况下定义稳定的异常标识和活跃/已解决评估语义；保留后续在命令边界处支持显式拒绝策略的能力。
5. 要求精确的十进制/单位分区，并对不兼容输入给出明确的完整性错误；保持 V1 检测为信息性。

## 验收标准

- [ ] 三种必需的异常类型具有精确的公式和明确的相等边界。
- [ ] 每个异常包含计划、实际/比较、带符号方差、单位、受影响的项目/可选任务以及支持的跟踪 ID。
- [ ] 项目剩余正好为零即为耗尽；仅相等并不算超额分配或任务超消耗。
- [ ] 异常标识和活跃/已解决语义适用于派生的当前和历史结果。
- [ ] 不兼容单位永远不会被比较。
- [ ] V1 检测是信息性的，不引入自动修复、财务报告或数据库外键。

## 测试

- 在每个阈值下方、正好位于阈值处和上方添加表驱动测试。
- 测试分数精确值、带符号方差、标识稳定性和不兼容单位。
- 测试明确的零预算/零消耗策略，并记录从 Feature #15 继承的所有完整性前提条件。

## 依赖

- Feature #15：计算资源使用和剩余余额（任务 #82-#84）。

## 排除范围

- 查询/只读模型实现。
- 自动修复/重新分配、通知、预测、通用财务报告、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define precise exception categories and boundaries. |
| specify | 指定 | Specify exact-zero behavior. |
| contain | 包含 | The exception value contains type/status and amounts. |
| retain | 保留 | Retain support for later rejection policies. |
| require | 要求 | Require exact decimal/unit partitioning. |
| compare | 比较 | Incompatible units are never compared. |
| introduce | 引入 | Introduce no automated remediation. |
| document | 记录 | Document integrity preconditions. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| planned-versus-actual exception | 计划与实际异常 | define planned-versus-actual exception categories |
| unit-safe balance | 单位安全余额 | over the unit-safe balance results |
| Project over-allocation | 项目超额分配 | define Project over-allocation |
| Project exhaustion | 项目耗尽 | define Project exhaustion |
| Task over-consumption | 任务超消耗 | define Task over-consumption |
| exact-zero behavior | 精确零值行为 | specify exact-zero behavior |
| transport-neutral exception value | 与传输无关的异常值 | define a transport-neutral exception value |
| signed variance | 带符号方差 | include signed variance |
| evaluated/as-of time | 评估/截至某个时间点时间 | evaluated/as-of time |
| contributor trace IDs | 贡献者跟踪 ID | contributor trace IDs |
| stable exception identity | 稳定的异常标识 | define stable exception identity |
| active/resolved semantics | 活跃/已解决语义 | active/resolved evaluation semantics |

### 值得模仿的句式
1. **“Define precise, informational planned-versus-actual exception categories and boundaries over the unit-safe balance results from Feature #15.”** — “基于 Feature #15 的单位安全余额结果，定义精确且信息性的计划与实际异常类别和边界。” — *Define precise, informational planned-versus-actual exception categories and boundaries over the unit-safe balance results from Feature #15.*
2. **“Exactly zero Project remaining is exhausted; equality alone is not over-allocation or Task over-consumption.”** — “项目剩余正好为零即为耗尽；仅相等并不算超额分配或任务超消耗。” — *Exactly zero Project remaining is exhausted; equality alone is not over-allocation or Task over-consumption.*
3. **“Require exact decimal/unit partitioning and explicit integrity errors for incompatible inputs; keep V1 detection informational.”** — “要求精确的十进制/单位分区，并对不兼容输入给出明确的完整性错误；保持 V1 检测为信息性。” — *Require exact decimal/unit partitioning and explicit integrity errors for incompatible inputs; keep V1 detection informational.*

### 领域词汇
| English | 中文 |
|---|---|
| planned-versus-actual exception | 计划与实际异常 |
| exception category | 异常类别 |
| unit-safe balance | 单位安全余额 |
| over-allocation | 超额分配 |
| exhaustion | 耗尽 |
| over-consumption | 超消耗 |
| exact-zero behavior | 精确零值行为 |
| transport-neutral value | 与传输无关的值 |
| signed variance | 带符号方差 |
| trace ID | 跟踪 ID |
| exception identity | 异常标识 |
| active/resolved semantics | 活跃/已解决语义 |
| rejection policy | 拒绝策略 |

---

## 4. 小练习

1. We define precise, informational planned-versus-actual exception categories over the ______ balance results.
2. Project exhaustion is defined when `consumed >= ______`.
3. A transport-neutral exception value includes planned amount, actual/comparison amount, signed ______, and trace IDs.
4. Exactly zero Project remaining is ______; equality alone is not over-allocation.
5. V1 detection should remain ______ and not introduce automated remediation.

<details>
<summary>点击查看答案</summary>

1. unit-safe  
2. budgeted  
3. variance  
4. exhausted  
5. informational

</details>
