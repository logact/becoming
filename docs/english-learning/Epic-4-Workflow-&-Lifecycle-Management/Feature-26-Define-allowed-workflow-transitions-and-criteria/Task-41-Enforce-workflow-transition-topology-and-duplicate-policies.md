# Issue #41: Task: Enforce workflow transition topology and duplicate policies

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define allowed workflow transitions and criteria (#26)

---

## 1. Original English

Parent Feature: #26

## Outcome

Only structurally valid transitions can be activated inside a single Workflow/entity-type/Label machine.

## Implementation plan

1. Implement endpoint validation requiring both states and the transition identity to share the same workflow, entity type, and label.
2. Document and enforce the V1 self-transition policy and the normalized duplicate-active-edge policy, including whether separately titled edges are permitted.
3. Validate create/update/reactivate operations against archived endpoints and machine invariants before persistence.
4. Make duplicate checks safe under concurrent requests using an application/storage invariant compatible with logical references.

## Acceptance criteria

- [ ] Cross-machine transitions are rejected with no persisted partial mutation.
- [ ] The self-transition policy is explicit and consistently enforced.
- [ ] Duplicate active source-to-destination edges follow one documented policy.
- [ ] Archived states cannot be endpoints of newly active transitions.
- [ ] Concurrent duplicate requests cannot produce invalid active topology.

## Tests

- Table-driven tests for each mismatched machine dimension and missing/archived endpoints.
- Unit tests for self-transition and differentiated/duplicate edge cases.
- Concurrency and rollback integration tests for duplicate edges.

## Dependencies

- `Task: Persist workflow transition templates and machine queries`.
- Feature #25 machine integrity rules.

## Out of scope

- Evaluating conditions.
- Graph reachability requirements beyond direct structural validity.

---

## 2. 中文翻译

父特性：#26

## 预期成果

只有结构上有效的转换才能在单个工作流/实体类型/标签机器内被激活。

## 实现计划

1. 实现端点验证，要求两个状态和转换身份共享相同的工作流、实体类型和标签。
2. 记录并强制执行 V1 自转换策略和规范化重复活跃边策略，包括是否允许单独标题的边。
3. 在持久化前针对已归档端点和机器不变量验证创建/更新/重新激活操作。
4. 使用与逻辑引用兼容的应用/存储不变量，使重复检查在并发请求下安全。

## 验收标准

- [ ] 跨机器转换被拒绝，且不会产生持久化的部分变更。
- [ ] 自转换策略是显式的，并被一致地强制执行。
- [ ] 重复活跃源到目标边遵循一个文档化策略。
- [ ] 已归档状态不能作为新活跃转换的端点。
- [ ] 并发重复请求不能产生无效活跃拓扑。

## 测试

- 针对每种不匹配的机器维度和缺失/已归档端点的表驱动测试。
- 自转换和有区分/重复边情况的单元测试。
- 重复边的并发和回滚集成测试。

## 依赖

- 任务：持久化工作流转换模板和机器查询。
- 特性 #25 机器完整性规则。

## 范围外

- 评估条件。
- 超出直接结构有效性的图可达性要求。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| persist | 持久化 | Persist workflow state templates to storage. |
| enforce | 强制执行 | Document and enforce the V1 self-transition policy and the normalized duplicate-active-edge policy, including whether separately titled edges are permitted. |
| validate | 验证 | Validate create/update/reactivate operations against archived endpoints and machine invariants before persistence. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement endpoint validation requiring both states and the transition identity to share the same workflow, entity type, and label. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| logical references | 逻辑引用 | Make duplicate checks safe under concurrent requests using an application/storage invariant compatible with logical references. |
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
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |

---

## 4. 小练习

1. Concurrent requests require _______ controls to avoid duplicate active rows.
2. The V1 policy must explicitly accept or reject _______ transitions.
3. Duplicate active source-to-destination edges must follow one documented _______.
4. Cross-machine transitions are _______ with no persisted partial mutation.
5. It is important to _______ every transition before committing it.

<details>
<summary>点击查看答案</summary>

1. concurrency
2. self-transition
3. policy
4. rejected
5. validate

</details>
