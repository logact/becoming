# Issue #52: Task: Build the Project transition validation engine

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Execute project-scoped lifecycle transitions (#29)

---

## 1. Original English

Parent Feature: #29

## Outcome

Requested lifecycle changes are authorized only by an active matching Project transition whose conditions and required source exit criteria pass explicit evaluator contracts.

## Implementation plan

1. Define a transition request/result model and resolve current state plus the exact active edge in the matching Project/entity-type/Label machine.
2. Define injectable condition and exit-criteria evaluator interfaces with structured inputs/results; keep free-text/template management separate from runtime execution.
3. Validate active endpoints, target identity, condition result, and source exit criteria when required, returning stable rejection reasons.
4. Ensure validation is side-effect free so every rejected request leaves current state and history untouched.

## Acceptance criteria

- [ ] Only an active matching source-to-destination Project transition can authorize movement.
- [ ] Conditions and required exit criteria are evaluated through explicit domain contracts.
- [ ] All identity dimensions are checked against the current state and requested destination.
- [ ] Missing, ambiguous, archived, false, and evaluator-error outcomes are distinguishable.
- [ ] Every validation failure leaves the state repository unchanged.
- [ ] The validation contract can carry evaluation evidence to Feature #9 without defining its audit storage here.

## Tests

- Decision-table unit tests for all edge, endpoint, identity, condition, and exit-criteria outcomes.
- Spy tests proving rejected validation performs no writes.
- Contract tests for evaluator inputs, results, and error handling.

## Dependencies

- `Task: Persist entity state history and initialize current state safely`.
- Feature #28 Project transitions.

## Out of scope

- A general-purpose rules language.
- Executing transition actions/background jobs.
- Resource-driven transitions.

---

## 2. 中文翻译

父特性：#29

## 预期成果

请求的生命周期变更仅由活跃匹配的 project 转换授权，其条件和所需源退出条件通过显式求值器契约。

## 实现计划

1. 定义转换请求/结果模型，解析当前状态以及匹配的项目/实体类型/标签机器中的精确活跃边。
2. 定义可注入的条件和退出条件求值器接口，使用结构化输入/结果；将自由文本/模板管理与运行时执行分离。
3. 验证活跃端点、目标身份、条件结果以及所需源退出条件，返回稳定的拒绝原因。
4. 确保验证无副作用，因此每次被拒绝的请求都保持当前状态和历史不变。

## 验收标准

- [ ] 只有活跃匹配的源到目标项目转换才能授权移动。
- [ ] 条件和所需退出条件通过显式领域契约评估。
- [ ] 所有身份维度都针对当前状态和目标状态进行检查。
- [ ] 缺失、模糊、已归档、为假和求值器错误结果是可区分的。
- [ ] 每次验证失败都保持状态仓库不变。
- [ ] 验证契约可以将评估证据携带给特性 #9，而在此不定义其审计存储。

## 测试

- 所有边、端点、身份、条件和退出条件结果的决策表单元测试。
- 证明拒绝验证不执行写入的间谍测试。
- 求值器输入、结果和错误处理的契约测试。

## 依赖

- 任务：持久化实体状态历史并安全初始化当前状态。
- 特性 #28 项目转换。

## 范围外

- 通用规则语言。
- 执行转换动作/后台作业。
- 资源驱动的转换。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define a transition request/result model and resolve current state plus the exact active edge in the matching Project/entity-type/Label machine. |
| persist | 持久化 | Persist workflow state templates to storage. |
| initialize | 初始化 | Initialize independent Project machines from templates. |
| validate | 验证 | Validate active endpoints, target identity, condition result, and source exit criteria when required, returning stable rejection reasons. |
| authorize | 授权 | Only an active matching source-to-destination Project transition can authorize movement. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| exit criteria | 退出条件 | Requested lifecycle changes are authorized only by an active matching Project transition whose conditions and required source exit criteria pass explicit evaluator contracts. |
| current state | 当前状态 | Define a transition request/result model and resolve current state plus the exact active edge in the matching Project/entity-type/Label machine. |
| state history | 状态历史 | Persist entity state history atomically. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Exit criteria | 退出条件 |
| Current state | 当前状态 |
| State history | 状态历史 |

---

## 4. 小练习

1. The system enforces a single _______ per project/entity/label context.
2. Required source _______ must pass before a transition is authorized.
3. Transition conditions are evaluated through an explicit _______ contract.
4. It is important to _______ every transition before committing it.
5. The repository must _______ workflow state templates durably.

<details>
<summary>点击查看答案</summary>

1. current state
2. exit criteria
3. evaluator
4. validate
5. persist

</details>
