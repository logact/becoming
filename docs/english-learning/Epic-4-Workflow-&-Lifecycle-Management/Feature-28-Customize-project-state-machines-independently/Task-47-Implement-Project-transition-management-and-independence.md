# Issue #47: Task: Implement Project transition management and independence

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Customize project state machines independently (#28)

---

## 1. Original English

Parent Feature: #28

## Outcome

Projects can define and customize allowed transitions whose endpoints remain inside one Project machine and whose template origins are informational only.

## Implementation plan

1. Define the ProjectStateTransition model/repository from `project_state_transitions`, including optional source Workflow transition provenance.
2. Implement endpoint checks for exact Project/entity-type/Label identity, active endpoint policy, duplicate-edge policy, and documented self-transition policy.
3. Add create/update/archive and incoming/outgoing/machine queries for copied and Project-native transitions.
4. Add regression coverage proving Project transition edits and later Workflow versions never mutate or overwrite each other.

## Acceptance criteria

- [ ] Both endpoints of every active Project transition belong to the same Project machine.
- [ ] Copied transitions can be edited independently of source Workflow transitions.
- [ ] Project-native transitions work without source template IDs.
- [ ] Duplicate, cross-machine, missing, or archived endpoint requests return explicit errors.
- [ ] New Workflow versions do not change existing Project transitions.
- [ ] Archived transitions remain historically resolvable.

## Tests

- Topology tests for each mismatched identity dimension, duplicates, and self-transition policy.
- Repository tests for active/historical queries and optional origins.
- Independence tests across source edits, Project edits, and new Workflow versions.

## Dependencies

- `Task: Implement independent Project State management`.
- Feature #27 copied transition initialization.

## Out of scope

- Executing transition conditions/actions.
- Merging template changes into a Project.

---

## 2. 中文翻译

父特性：#28

## 预期成果

项目可以定义和自定义允许的转换，其端点始终位于一个项目机器内，模板来源仅作为信息保留。

## 实现计划

1. 根据 `project_state_transitions` 定义 ProjectStateTransition 模型/仓库，包括可选的源工作流转换溯源。
2. 实现端点检查：精确的项目/实体类型/标签身份、活跃端点策略、重复边策略以及文档化的自转换策略。
3. 为复制和项目原生转换添加创建/更新/归档以及入边/出边/机器查询。
4. 添加回归覆盖，证明项目转换编辑和后续工作流版本不会相互变更或覆盖。

## 验收标准

- [ ] 每个活跃项目转换的两个端点都属于同一个项目机器。
- [ ] 复制的转换可以独立于源工作流转换进行编辑。
- [ ] 项目原生转换可以没有源模板 ID。
- [ ] 重复、跨机器、缺失或已归档端点请求返回显式错误。
- [ ] 新的工作流版本不会改变现有项目转换。
- [ ] 已归档转换在历史上仍可解析。

## 测试

- 每种身份维度不匹配、重复和自转换策略的拓扑测试。
- 活跃/历史查询和可选来源的仓库测试。
- 跨源编辑、项目编辑和新工作流版本的独立性测试。

## 依赖

- 任务：实现独立的项目状态管理。
- 特性 #27 复制转换初始化。

## 范围外

- 执行转换条件/动作。
- 将模板变更合并到项目中。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Projects can define and customize allowed transitions whose endpoints remain inside one Project machine and whose template origins are informational only. |
| archive | 归档 | Add create/update/archive and incoming/outgoing/machine queries for copied and Project-native transitions. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement endpoint checks for exact Project/entity-type/Label identity, active endpoint policy, duplicate-edge policy, and documented self-transition policy. |
| add | 添加 | Add create/update/archive and incoming/outgoing/machine queries for copied and Project-native transitions. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| allowed transitions | 允许的转换 | Projects can define and customize allowed transitions whose endpoints remain inside one Project machine and whose template origins are informational only. |
| source template | 源模板 | Project-native transitions work without source template IDs. |
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
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Source template | 源模板 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Archiving a Workflow must not invalidate historical project _______.
3. The V1 policy must explicitly accept or reject _______ transitions.
4. Copied Project States retain _______ IDs as provenance only.

<details>
<summary>点击查看答案</summary>

1. provenance
2. execution
3. self-transition
4. source template

</details>
