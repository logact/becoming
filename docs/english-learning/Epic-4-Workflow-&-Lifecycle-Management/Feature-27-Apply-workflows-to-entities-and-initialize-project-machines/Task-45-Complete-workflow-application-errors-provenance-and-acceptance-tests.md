# Issue #45: Task: Complete workflow application errors, provenance, and acceptance tests

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Apply workflows to entities and initialize project machines (#27)

---

## 1. Original English

Parent Feature: #27

## Outcome

Workflow application has observable, auditable outcomes across happy paths, invalid candidates, rollback, and retry behavior.

## Implementation plan

1. Expose the application command/result contract with stable errors for missing Project, missing/archived/ambiguous/incompatible Workflow, invalid templates, partial-copy failure, and repeated application.
2. Record the selected Workflow/version, Project, machine identities, and created-copy IDs as structured provenance in the initialization transaction.
3. Add query support that reports a Project machine's template origins without treating them as synchronization links.
4. Build feature-level acceptance tests covering direct Project and supported managed-consumer applicability relations.

## Acceptance criteria

- [ ] Every Feature #27 error case is distinguishable and leaves no partial machine.
- [ ] A successful initialization has one atomic provenance record/set describing its source and copies.
- [ ] Origin queries can explain initialization after source templates are archived.
- [ ] No later Workflow version or edit mutates an initialized Project machine.
- [ ] Acceptance tests cover the explicit repeated-application policy.

## Tests

- End-to-end tests for resolution through initialization and origin query.
- Transaction/provenance fault-injection tests.
- Regression test applying a newer Workflow version alongside an existing independent Project machine.

## Dependencies

- The two preceding Feature #27 tasks.
- Feature #30 provenance primitives.
- Feature #8 origin/transformation query semantics where reused.

## Out of scope

- Silent template synchronization.
- Runtime entity state initialization or transitions.

---

## 2. 中文翻译

父特性：#27

## 预期成果

工作流应用具有可观察、可审计的结果，覆盖正常路径、无效候选、回滚和重试行为。

## 实现计划

1. 暴露应用命令/结果契约，对缺失项目、缺失/已归档/模糊/不兼容工作流、无效模板、部分复制失败和重复应用提供稳定错误。
2. 在初始化事务中将选定的工作流/版本、项目、机器身份和创建的副本 ID 记录为结构化溯源。
3. 添加查询支持，报告项目机器的模板来源，而不将其视为同步链接。
4. 构建覆盖直接项目和支持的管理消费者适用性关系的特性级验收测试。

## 验收标准

- [ ] 特性 #27 的每个错误案例都是可区分的，且不会留下部分机器。
- [ ] 成功的初始化有一个原子溯源记录/集合，描述其来源和副本。
- [ ] 来源查询可以在源模板归档后解释初始化过程。
- [ ] 后续工作流版本或编辑不会变更已初始化的项目机器。
- [ ] 验收测试覆盖显式的重复应用策略。

## 测试

- 从解析到初始化和来源查询的端到端测试。
- 事务/溯源故障注入测试。
- 将较新工作流版本应用于现有独立项目机器旁边的回归测试。

## 依赖

- 特性 #27 的前两个任务。
- 特性 #30 溯源原语。
- 特性 #8 来源/转换查询语义（如复用）。

## 范围外

- 静默模板同步。
- 运行时实体状态初始化或转换。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| query | 查询 | Add query support that reports a Project machine's template origins without treating them as synchronization links. |
| copy | 复制 | Expose the application command/result contract with stable errors for missing Project, missing/archived/ambiguous/incompatible Workflow, invalid templates, partial-copy failure,... |
| record | 记录 | Record the selected Workflow/version, Project, machine identities, and created-copy IDs as structured provenance in the initialization transaction. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| end | 结束 | End-to-end tests for resolution through initialization and origin query. |
| add | 添加 | Add query support that reports a Project machine's template origins without treating them as synchronization links. |
| expose | 暴露 | Expose the application command/result contract with stable errors for missing Project, missing/archived/ambiguous/incompatible Workflow, invalid templates, partial-copy failure,... |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |
| domain entities | 领域实体 | Workflows are first-class domain entities. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Template | 模板 |
| Lifecycle | 生命周期 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Applying a Workflow _______ its state templates into independent Project States.
3. Copied Project States retain _______ IDs as provenance only.
4. Consumers can _______ active Workflows by type and version.

<details>
<summary>点击查看答案</summary>

1. provenance
2. copies
3. source template
4. query

</details>
