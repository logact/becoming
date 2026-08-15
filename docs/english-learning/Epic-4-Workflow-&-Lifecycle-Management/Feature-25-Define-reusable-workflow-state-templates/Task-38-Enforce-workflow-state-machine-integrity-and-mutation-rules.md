# Issue #38: Task: Enforce workflow state machine integrity and mutation rules

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define reusable workflow state templates (#25)

---

## 1. Original English

Parent Feature: #25

## Outcome

Workflow state commands preserve title uniqueness and coherent initial/terminal semantics inside each reusable machine.

## Implementation plan

1. Document and implement the state-title normalization policy and reject duplicate active titles only within the same machine.
2. Define V1 initial/terminal semantics, including at most one active initial state, allowed initial-terminal combinations, and safe changes to these flags.
3. Implement create/update/reorder/archive commands transactionally so invariant checks consider the complete active machine.
4. Reject or explicitly coordinate mutations that would invalidate active transitions while retaining archived templates for history.

## Acceptance criteria

- [ ] Normalized active titles are unique per machine but may repeat in other machines.
- [ ] A machine has at most one active initial state.
- [ ] Initial and terminal flags follow a documented, tested rule and are queryable.
- [ ] Reordering cannot move a state into another machine or create nondeterministic ordering.
- [ ] Archival preserves the row and cannot leave structurally invalid active transitions.

## Tests

- Unit tests for normalization, per-machine scoping, initial/terminal combinations, and reorder rules.
- Transactional tests for competing initial-state creation and rollback after invariant failure.
- Regression tests for archive behavior when transitions reference a state.

## Dependencies

- `Task: Persist workflow state templates and machine-scoped queries`.
- Feature #26 transition repository contract for transition-reference checks.

## Out of scope

- Multiple active initial states.
- Executing entry/exit criteria.
- Project state customization.

---

## 2. 中文翻译

父特性：#25

## 预期成果

工作流状态命令在每个可复用机器内保持标题唯一性以及一致的初始/终止语义。

## 实现计划

1. 记录并实现状态标题规范化策略，仅拒绝同一机器内的重复活跃标题。
2. 定义 V1 初始/终止语义，包括最多一个活跃初始状态、允许的初始-终止组合，以及安全修改这些标志。
3. 事务性地实现创建/更新/排序/归档命令，使不变量检查考虑完整的活跃机器。
4. 拒绝或显式协调会使活跃转换失效的变更，同时保留已归档模板供历史使用。

## 验收标准

- [ ] 规范化后的活跃标题在机器内唯一，但可以在其他机器中重复。
- [ ] 一个机器最多只有一个活跃初始状态。
- [ ] 初始和终止标志遵循文档化、可测试的规则，且可查询。
- [ ] 排序不会将状态移到另一个机器，也不会产生非确定性排序。
- [ ] 归档保留行数据，且不会留下结构上无效的活跃转换。

## 测试

- 规范化、机器范围作用域、初始/终止组合和排序规则的单元测试。
- 竞争初始状态创建和不变量失败后回滚的事务测试。
- 转换引用某状态时归档行为的回归测试。

## 依赖

- 任务：持久化工作流状态模板和机器范围查询。
- 特性 #26 转换仓库契约用于转换引用检查。

## 范围外

- 多个活跃初始状态。
- 执行准入/退出条件。
- 项目状态定制。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define V1 initial/terminal semantics, including at most one active initial state, allowed initial-terminal combinations, and safe changes to these flags. |
| reference | 引用 | Regression tests for archive behavior when transitions reference a state. |
| reject | 拒绝 | Document and implement the state-title normalization policy and reject duplicate active titles only within the same machine. |
| archive | 归档 | Implement create/update/reorder/archive commands transactionally so invariant checks consider the complete active machine. |
| persist | 持久化 | Persist workflow state templates to storage. |
| preserve | 保留 | Workflow state commands preserve title uniqueness and coherent initial/terminal semantics inside each reusable machine. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Document and implement the state-title normalization policy and reject duplicate active titles only within the same machine. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| exit criteria | 退出条件 | Executing entry/exit criteria. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Transition | 转换/迁移 |
| Acceptance criteria | 验收标准 |
| Exit criteria | 退出条件 |
| Lifecycle | 生命周期 |

---

## 4. 小练习

1. Workflow discovery must return _______ results when multiple candidates match.
2. A machine should have at most one active _______ state.
3. Required source _______ must pass before a transition is authorized.
4. The engine should _______ cross-machine transitions.
5. The repository must _______ workflow state templates durably.

<details>
<summary>点击查看答案</summary>

1. deterministic
2. initial
3. exit criteria
4. reject
5. persist

</details>
