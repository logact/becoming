# Issue #98: Task: Derive project and task resource exceptions

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Surface planned versus actual resource exceptions (#16)

---

## 1. Original English

## Outcome

Implement deterministic derivation of Project and Task Resource exceptions from current or as-of balance summaries.

Parent Feature: #16

## Implementation plan

1. Implement a framework-neutral exception evaluator consuming Feature #15 balance summaries and the rules from #97.
2. Derive Project over-allocation, Project exhausted/over-consumed, and Task over-consumed results independently so one Resource may report multiple applicable conditions.
3. Populate canonical exact amounts, signed variance, unit, contexts, evaluation instant, and contributing relation/Record identifiers.
4. Deduplicate by stable identity and return deterministic severity/type/Resource/Task ordering without storing or mutating source data.
5. Provide an optional domain-policy hook that command services may use to reject operations, while defaulting all V1 query detection to informational.

## Acceptance criteria

- [ ] Active Project allocations above budget produce an over-allocation exception.
- [ ] Project consumption equal to or above budget produces an exhausted exception with correct zero/negative remaining behavior.
- [ ] Attributed Task consumption above allocation produces a Task exception; equality does not.
- [ ] Every result has exact planned, actual/comparison, variance, unit, context, and supporting trace data.
- [ ] Evaluation does not mutate budgets, allocations, consumption, or derived history.
- [ ] Results are stable and deterministic for the same source snapshot.

## Tests

- Test all exception combinations, including simultaneous over-allocation and exhaustion for one Project Resource.
- Test equality, zero remaining, negative remaining, fractions, multiple Resources/Tasks, and incompatible-unit failure.
- Test deterministic identity/order and prove the evaluator performs no source writes.

## Dependencies

- #97, Task: Define planned-versus-actual exception semantics.
- Feature #15's current and historical balance query contracts.

## Out of scope

- Persisting exception rows, active/resolved query projection, alerts, remediation, accounting, billing, and financial reporting.

---

## 2. 中文翻译

## 成果

基于当前或截至某个时间点的余额汇总，实现项目和任务资源异常的确定性推导。

父 Feature：#16

## 实施计划

1. 实现一个与框架无关的异常评估器，消费 Feature #15 的余额汇总和 #97 的规则。
2. 独立推导项目超额分配、项目耗尽/超消耗以及任务超消耗结果，以便一种资源可以报告多个适用条件。
3. 填充规范精确金额、带符号方差、单位、上下文、评估时刻以及贡献关系/记录标识符。
4. 通过稳定标识去重，并返回确定性的严重度/类型/资源/任务排序，而不存储或修改源数据。
5. 提供一个可选的领域策略钩子，命令服务可使用它来拒绝操作，同时默认所有 V1 查询检测为信息性。

## 验收标准

- [ ] 超过预算的活跃项目分配会产生超额分配异常。
- [ ] 等于或高于预算的项目消耗会产生耗尽异常，并具有正确的零/负剩余行为。
- [ ] 超过分配的归属任务消耗会产生任务异常；相等则不会。
- [ ] 每个结果都包含精确的计划、实际/比较、方差、单位、上下文和支持的跟踪数据。
- [ ] 评估不会修改预算、分配、消耗或派生历史。
- [ ] 对于相同的源快照，结果是稳定且确定性的。

## 测试

- 测试所有异常组合，包括一个项目资源同时存在超额分配和耗尽的情况。
- 测试相等、零剩余、负剩余、分数、多资源/任务以及不兼容单位失败。
- 测试确定性标识/排序，并证明评估器不会执行源写入。

## 依赖

- #97，任务：定义计划与实际异常语义。
- Feature #15 的当前和历史余额查询契约。

## 排除范围

- 持久化异常行、活跃/已解决查询投影、告警、修复、会计、计费和财务报告。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| implement | 实现 | Implement deterministic derivation of exceptions. |
| derive | 推导 | Derive Project and Task Resource exceptions. |
| consume | 消费 | Consume balance summaries and rules. |
| populate | 填充 | Populate canonical exact amounts and signed variance. |
| deduplicate | 去重 | Deduplicate by stable identity. |
| return | 返回 | Return deterministic ordering. |
| provide | 提供 | Provide an optional domain-policy hook. |
| mutate | 修改 | Evaluation does not mutate source data. |
| prove | 证明 | Prove the evaluator performs no source writes. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| deterministic derivation | 确定性推导 | implement deterministic derivation |
| balance summaries | 余额汇总 | consume balance summaries |
| exception evaluator | 异常评估器 | framework-neutral exception evaluator |
| Project over-allocation | 项目超额分配 | derive Project over-allocation |
| Project exhausted/over-consumed | 项目耗尽/超消耗 | derive exhausted/over-consumed results |
| Task over-consumed | 任务超消耗 | derive Task over-consumed results |
| canonical exact amounts | 规范精确金额 | populate canonical exact amounts |
| signed variance | 带符号方差 | populate signed variance |
| stable identity | 稳定标识 | deduplicate by stable identity |
| domain-policy hook | 领域策略钩子 | provide a domain-policy hook |
| source snapshot | 源快照 | stable for the same source snapshot |

### 值得模仿的句式
1. **“Implement deterministic derivation of Project and Task Resource exceptions from current or as-of balance summaries.”** — “基于当前或截至某个时间点的余额汇总，实现项目和任务资源异常的确定性推导。” — *Implement deterministic derivation of Project and Task Resource exceptions from current or as-of balance summaries.*
2. **“Derive Project over-allocation, Project exhausted/over-consumed, and Task over-consumed results independently so one Resource may report multiple applicable conditions.”** — “独立推导项目超额分配、项目耗尽/超消耗以及任务超消耗结果，以便一种资源可以报告多个适用条件。” — *Derive Project over-allocation, Project exhausted/over-consumed, and Task over-consumed results independently so one Resource may report multiple applicable conditions.*
3. **“Provide an optional domain-policy hook that command services may use to reject operations, while defaulting all V1 query detection to informational.”** — “提供一个可选的领域策略钩子，命令服务可使用它来拒绝操作，同时默认所有 V1 查询检测为信息性。” — *Provide an optional domain-policy hook that command services may use to reject operations, while defaulting all V1 query detection to informational.*

### 领域词汇
| English | 中文 |
|---|---|
| exception evaluator | 异常评估器 |
| balance summary | 余额汇总 |
| over-allocation exception | 超额分配异常 |
| exhausted exception | 耗尽异常 |
| over-consumed exception | 超消耗异常 |
| canonical exact amount | 规范精确金额 |
| signed variance | 带符号方差 |
| stable identity | 稳定标识 |
| deterministic ordering | 确定性排序 |
| domain-policy hook | 领域策略钩子 |
| source snapshot | 源快照 |

---

## 4. 小练习

1. We implement deterministic ______ of Project and Task Resource exceptions from current or as-of balance summaries.
2. The exception evaluator ______ Feature #15 balance summaries and the rules from #97.
3. Project over-allocation, exhausted/over-consumed, and Task over-consumed results are derived ______ so one Resource may report multiple conditions.
4. Results are deduplicated by stable ______.
5. An optional domain-policy ______ lets command services reject operations while keeping V1 detection informational.

<details>
<summary>点击查看答案</summary>

1. derivation  
2. consumes  
3. independently  
4. identity  
5. hook

</details>
