# Issue #26: Feature: Define allowed workflow transitions and criteria

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can explicitly define which lifecycle changes a reusable Workflow permits and the conditions for each change.

## Scope

- Create, update, archive, and query Workflow State transitions.
- Capture source and destination states, optional title, description, condition, action, and exit-criteria requirement.
- Validate that both states belong to the same workflow/entity-type/label machine.
- Reject structurally invalid transitions.

## Acceptance criteria

- A transition cannot connect states from different machines.
- Duplicate active source-to-destination transitions are rejected unless explicitly differentiated by policy.
- Self-transitions are accepted or rejected according to a documented rule.
- Conditions and actions round-trip without being executed by template management.
- Requiring source exit criteria is explicit and queryable.
- Archiving a transition does not remove it from historical workflow versions.

## Dependencies

- Feature: Define reusable workflow state templates.

## Out of scope

- A general-purpose rules language.
- Runtime transition execution.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以显式定义可复用工作流允许哪些生命周期变更，以及每次变更的条件。

## 范围

- 创建、更新、归档和查询工作流状态转换。
- 捕获源状态和目标状态、可选标题、描述、条件、动作以及退出条件要求。
- 验证两个状态是否属于同一个工作流/实体类型/标签机器。
- 拒绝结构上无效的转换。

## 验收标准

- 转换不能连接来自不同机器的状态。
- 除非策略明确允许区分，否则拒绝重复活跃源到目标转换。
- 根据文档化规则接受或拒绝自转换。
- 条件和动作可以无损往返，但模板管理不会执行它们。
- 要求源退出条件是显式的且可查询。
- 归档转换不会将其从历史工作流版本中移除。

## 依赖

- 特性：定义可复用工作流状态模板。

## 范围外

- 通用规则语言。
- 运行时转换执行。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Users can explicitly define which lifecycle changes a reusable Workflow permits and the conditions for each change. |
| reject | 拒绝 | Reject structurally invalid transitions. |
| archive | 归档 | Create, update, archive, and query Workflow State transitions. |
| validate | 验证 | Validate that both states belong to the same workflow/entity-type/label machine. |
| query | 查询 | Create, update, archive, and query Workflow State transitions. |
| capture | 捕获 | Capture source and destination states, optional title, description, condition, action, and exit-criteria requirement. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| invalid transitions | 无效的转换 | Reject structurally invalid transitions. |
| exit criteria | 退出条件 | Requiring source exit criteria is explicit and queryable. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
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
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Exit criteria | 退出条件 |

---

## 4. 小练习

1. Archiving a Workflow must not invalidate historical project _______.
2. The V1 policy must explicitly accept or reject _______ transitions.
3. Duplicate active source-to-destination edges must follow one documented _______.
4. Required source _______ must pass before a transition is authorized.
5. It is important to _______ every transition before committing it.

<details>
<summary>点击查看答案</summary>

1. execution
2. self-transition
3. policy
4. exit criteria
5. validate

</details>
