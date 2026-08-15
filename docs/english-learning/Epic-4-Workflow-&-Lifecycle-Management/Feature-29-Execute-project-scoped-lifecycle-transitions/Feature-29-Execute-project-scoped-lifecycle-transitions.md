# Issue #29: Feature: Execute project-scoped lifecycle transitions

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can place a managed entity into its Project lifecycle and move it only through allowed, valid transitions.

## Scope

- Initialize an entity in a Project machine's initial State.
- Resolve current state by project, entity type and ID, and management label.
- Validate requested Project transitions, conditions, and required exit criteria.
- Atomically end the active state period and create the new one.
- Enforce a single current state per project/entity/label context.

## Acceptance criteria

- Initialization uses a valid active initial Project State.
- A transition succeeds only when an active matching Project transition exists.
- Conditions and required source exit criteria are evaluated through an explicit domain contract.
- Invalid transitions leave current state unchanged.
- A successful transition closes the prior history row and opens exactly one new row atomically.
- The referenced Project State matches the row's project, entity type, and label.
- Concurrent transitions cannot create multiple active current-state rows.
- Current state and complete state history are queryable.

## Dependencies

- Feature: Customize project state machines independently.
- Feature: Classify core entities with labels.
- Feature: Record occurrences as first-class domain data provides the audit record primitive; lifecycle audit integration is delivered by the provenance epic.

## Out of scope

- Resource-driven automatic transitions.
- Background workflow automation.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以将受管实体放入其项目生命周期，并且只能通过允许的、有效的转换来移动它。

## 范围

- 将实体初始化到项目机器的初始状态。
- 按项目、实体类型/ID 和管理标签解析当前状态。
- 验证请求的项目转换、条件和所需退出条件。
- 原子地结束活跃状态周期并创建新周期。
- 强制每个项目/实体/标签上下文只有一个当前状态。

## 验收标准

- 初始化使用有效的活跃项目初始状态。
- 仅当存在活跃匹配的 project 转换时，转换才会成功。
- 通过显式领域契约评估条件和所需源退出条件。
- 无效转换保持当前状态不变。
- 成功的转换会关闭先前的历史行，并原子地恰好开启一个新行。
- 引用的项目状态与行的项目、实体类型和标签匹配。
- 并发转换不能创建多个活跃当前状态行。
- 当前状态和完整状态历史可查询。

## 依赖

- 特性：独立定制项目状态机。
- 特性：用标签对核心实体分类。
- 特性：将发生记录作为一等公民领域数据提供审计记录原语；生命周期审计集成由溯源史诗交付。

## 范围外

- 资源驱动的自动转换。
- 后台工作流自动化。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| enforce | 强制执行 | Enforce a single current state per project/entity/label context. |
| initialize | 初始化 | Initialize an entity in a Project machine's initial State. |
| validate | 验证 | Validate requested Project transitions, conditions, and required exit criteria. |
| classify | 分类 | Feature: Classify core entities with labels. |
| record | 记录 | Feature: Record occurrences as first-class domain data provides the audit record primitive; lifecycle audit integration is delivered by the provenance epic. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| end | 结束 | Atomically end the active state period and create the new one. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| invalid transitions | 无效的转换 | Invalid transitions leave current state unchanged. |
| first-class | 一等公民的 | Feature: Record occurrences as first-class domain data provides the audit record primitive; lifecycle audit integration is delivered by the provenance epic. |
| exit criteria | 退出条件 | Validate requested Project transitions, conditions, and required exit criteria. |
| current state | 当前状态 | Resolve current state by project, entity type and ID, and management label. |
| state history | 状态历史 | Current state and complete state history are queryable. |
| state period | 状态周期 | Atomically end the active state period and create the new one. |

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
| Exit criteria | 退出条件 |
| Current state | 当前状态 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Workflows should be _______, reusable domain entities.
3. Every material mutation should emit structured _______ in the same transaction.
4. Lifecycle transitions must be committed _______ to keep history consistent.
5. Users can classify core entities with _______ and preserve assignment history.

<details>
<summary>点击查看答案</summary>

1. state machine
2. first-class
3. provenance
4. atomically
5. labels

</details>
