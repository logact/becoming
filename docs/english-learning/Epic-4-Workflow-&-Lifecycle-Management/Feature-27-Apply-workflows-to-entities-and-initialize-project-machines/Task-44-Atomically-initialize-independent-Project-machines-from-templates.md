# Issue #44: Task: Atomically initialize independent Project machines from templates

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Apply workflows to entities and initialize project machines (#27)

---

## 1. Original English

Parent Feature: #27

## Outcome

Applying a compatible Workflow version copies its complete state machines into independent Project states and transitions with source IDs retained only as provenance.

## Implementation plan

1. Implement an initialization application service that resolves the selected Workflow and enumerates each configured entity-type/Label machine.
2. Within one transaction, copy active Workflow States to new Project States, maintain a source-to-copy ID map, then copy transitions to the mapped Project endpoints.
3. Validate every copy against `project_id + entity_type + label_id`, retaining `source_workflow_state_id` and `source_workflow_transition_id` as non-live provenance.
4. Define and enforce the V1 repeated-application policy using a stable initialization identity so retries cannot create partial duplicate machines.

## Acceptance criteria

- [ ] Applying a Workflow yields the expected Project machine for every configured entity-type/Label combination.
- [ ] All Project State and transition rows belong to the target Project machine.
- [ ] Every copied transition points to copied Project States, not Workflow States.
- [ ] Source template IDs are retained as provenance and impose no live coupling.
- [ ] Any failed copy rolls back all states and transitions.
- [ ] A repeat request follows the documented idempotency/conflict policy.

## Tests

- Mapping tests for multiple machines and cross-linked transition endpoints.
- Fault-injection transaction tests at state and transition copy stages.
- Idempotent retry/conflict tests and regression test that source edits do not mutate copies.

## Dependencies

- `Task: Model workflow applicability and deterministic resolution`.
- Feature #28 Project State/transition repositories and integrity contracts.

## Out of scope

- Synchronizing later Workflow changes.
- Moving entities into the initial state.

---

## 2. 中文翻译

父特性：#27

## 预期成果

应用兼容的工作流版本会将其完整的状态机复制为独立的项目状态和转换，源 ID 仅作为溯源保留。

## 实现计划

1. 实现初始化应用服务：解析选定工作流并枚举每个配置的实体类型/标签机器。
2. 在一个事务内，将活跃工作流状态复制为新的项目状态，维护源到副本的 ID 映射，然后将转换复制到映射后的项目端点。
3. 针对 `project_id + entity_type + label_id` 验证每个副本，保留 `source_workflow_state_id` 和 `source_workflow_transition_id` 作为非实时溯源。
4. 使用稳定的初始化标识定义并强制执行 V1 重复应用策略，使重试无法创建部分重复机器。

## 验收标准

- [ ] 应用工作流会为每个配置的实体类型/标签组合生成预期的项目机器。
- [ ] 所有项目状态和转换行都属于目标项目机器。
- [ ] 每个复制的转换指向复制的项目状态，而不是工作流状态。
- [ ] 源模板 ID 作为溯源保留，不产生实时耦合。
- [ ] 任何失败的副本都会回滚所有状态和转换。
- [ ] 重复请求遵循文档化的幂等/冲突策略。

## 测试

- 多机器和交叉链接转换端点的映射测试。
- 状态和转换复制阶段的故障注入事务测试。
- 幂等重试/冲突测试以及源编辑不会变更副本的回归测试。

## 依赖

- 任务：建模工作流适用性和确定性解析。
- 特性 #28 项目状态/转换仓库和完整性契约。

## 范围外

- 同步后续工作流变更。
- 将实体移入初始状态。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define and enforce the V1 repeated-application policy using a stable initialization identity so retries cannot create partial duplicate machines. |
| enforce | 强制执行 | Define and enforce the V1 repeated-application policy using a stable initialization identity so retries cannot create partial duplicate machines. |
| validate | 验证 | Validate every copy against project_id + entity_type + label_id, retaining source_workflow_state_id and source_workflow_transition_id as non-live provenance. |
| copy | 复制 | Within one transaction, copy active Workflow States to new Project States, maintain a source-to-copy ID map, then copy transitions to the mapped Project endpoints. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement an initialization application service that resolves the selected Workflow and enumerates each configured entity-type/Label machine. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| deterministic resolution | 确定性解析 | Deterministic resolution of applicable workflows. |
| idempotency/conflict policy | 幂等/冲突策略 | A repeat request follows the documented idempotency/conflict policy. |
| source template | 源模板 | Source template IDs are retained as provenance and impose no live coupling. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Transition | 转换/迁移 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Deterministic resolution | 确定性解析 |
| Label | 标签 |
| Template | 模板 |
| Idempotency | 幂等性 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Every material mutation should emit structured _______ in the same transaction.
3. Workflow discovery must return _______ results when multiple candidates match.
4. A machine should have at most one active _______ state.
5. Applying a Workflow _______ its state templates into independent Project States.

<details>
<summary>点击查看答案</summary>

1. state machine
2. provenance
3. deterministic
4. initial
5. copies

</details>
