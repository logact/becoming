# Issue #40: Task: Persist workflow transition templates and machine queries

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define allowed workflow transitions and criteria (#26)

---

## 1. Original English

Parent Feature: #26

## Outcome

Allowed reusable state transitions are durably represented with their conditions, actions, and exit-criteria requirement intact.

## Implementation plan

1. Define the WorkflowStateTransition model from `workflow_state_transitions`, treating condition/action as opaque template data rather than executable rules.
2. Add storage and repository ports for create, get, update, archive, outgoing/incoming queries, and historical resolution without database foreign keys.
3. Resolve both state endpoints through the application layer and verify the stored transition identity fields are coherent.
4. Provide deterministic ordering and filtering for active transitions within a machine.

## Acceptance criteria

- [ ] Source/destination IDs, title, description, condition, action, and `requires_exit_criteria` round-trip without loss.
- [ ] Template management never executes condition or action content.
- [ ] Missing endpoints and unsupported logical references produce explicit errors.
- [ ] Active and historical transition queries are deterministic.
- [ ] Archival retains the transition row for historical versions.

## Tests

- Repository contract tests for every field, incoming/outgoing lookup, archival, and ordering.
- Domain tests proving conditions/actions remain opaque.
- Migration/schema verification with no database foreign keys.

## Dependencies

- Feature #25 workflow state templates.

## Out of scope

- A rules language or evaluator.
- Project transition copies.
- Runtime entity transitions.

---

## 2. 中文翻译

父特性：#26

## 预期成果

允许的、可复用状态转换被持久化表示，其条件、动作和退出条件要求保持完整。

## 实现计划

1. 根据 `workflow_state_transitions` 定义 WorkflowStateTransition 模型，将条件/动作视为不透明模板数据而非可执行规则。
2. 添加存储和仓库端口，支持创建、获取、更新、归档、出边/入边查询和历史解析，不包含数据库外键。
3. 通过应用层解析两个状态端点，并验证存储的转换身份字段是否一致。
4. 为机器内的活跃转换提供确定性排序和过滤。

## 验收标准

- [ ] 源/目标 ID、标题、描述、条件、动作和 `requires_exit_criteria` 无损往返。
- [ ] 模板管理从不执行条件或动作内容。
- [ ] 缺失端点和不受支持的逻辑引用产生显式错误。
- [ ] 活跃和历史转换查询是确定性的。
- [ ] 归档保留转换行供历史版本使用。

## 测试

- 每个字段、入边/出边查找、归档和排序的仓库契约测试。
- 证明条件/动作保持不透明的领域测试。
- 确认无数据库外键的迁移/模式验证。

## 依赖

- 特性 #25 工作流状态模板。

## 范围外

- 规则语言或求值器。
- 项目转换副本。
- 运行时实体转换。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the WorkflowStateTransition model from workflow_state_transitions, treating condition/action as opaque template data rather than executable rules. |
| archive | 归档 | Add storage and repository ports for create, get, update, archive, outgoing/incoming queries, and historical resolution without database foreign keys. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| add | 添加 | Add storage and repository ports for create, get, update, archive, outgoing/incoming queries, and historical resolution without database foreign keys. |
| decompose | 分解 | Decompose large Tasks into smaller ones. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| logical references | 逻辑引用 | Missing endpoints and unsupported logical references produce explicit errors. |
| round-trip without loss | 无损往返 | Source/destination IDs, title, description, condition, action, and requires_exit_criteria round-trip without loss. |
| historical resolution | 历史解析 | Add storage and repository ports for create, get, update, archive, outgoing/incoming queries, and historical resolution without database foreign keys. |
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
| Acceptance criteria | 验收标准 |
| Template | 模板 |
| Lifecycle | 生命周期 |

---

## 4. 小练习

1. Archiving a Workflow must not invalidate historical project _______.
2. Workflow discovery must return _______ results when multiple candidates match.
3. Transition conditions are evaluated through an explicit _______ contract.

<details>
<summary>点击查看答案</summary>

1. execution
2. deterministic
3. evaluator

</details>
