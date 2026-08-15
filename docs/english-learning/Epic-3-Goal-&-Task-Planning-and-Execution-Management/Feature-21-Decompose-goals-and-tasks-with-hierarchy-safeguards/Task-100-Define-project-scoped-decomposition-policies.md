# Issue #100: Task: Define project-scoped decomposition policies

**Labels:** task  
**State:** CLOSED  
**Parent:** #21: Feature: Decompose goals and tasks with hierarchy safeguards

---

## 1. Original English

Parent Feature: #21 — Feature: Decompose goals and tasks with hierarchy safeguards

## Outcome

A framework-neutral Project-scoped decomposition contract defines the permitted Goal-to-Goal, Goal-to-Task, and Task-to-Task hierarchy edges and the logical validation required before graph mutation.

## Implementation plan

1. Define canonical directed decomposition relation policies for Goal parent → Goal child, Goal parent → Task child, and Task parent → Task child, including relation types and Project-context metadata.
2. Define how a Project contains each endpoint: Goals through applicable active Project–Goal pursuit/context relations and Tasks through active Task–Project membership, with no project IDs added to Goal or Task tables.
3. Validate Project and typed endpoint existence, active membership in the same Project context, permitted direction, archive eligibility, self-link prohibition, and parent/cardinality rules through application/domain ports.
4. Define a workflow-guidance resolver port keyed by Project, operation/decomposition purpose, entity types, applicable management label, and version, returning explicit missing/archived/ambiguous/incompatible errors.

## Acceptance criteria

- [ ] Only Goal→Goal, Goal→Task, and Task→Task decomposition directions are supported.
- [ ] Every decomposition operation requires an existing Project context represented outside Goal and Task tables.
- [ ] Both endpoints must exist and satisfy the documented active membership/context policy for the same Project.
- [ ] Self-links, cross-project links that violate policy, reversed/unsupported endpoint pairs, archive-ineligible endpoints, and cardinality violations are rejected as distinct domain errors.
- [ ] Applicable decomposition Workflow guidance can be resolved through an explicit port without storing workflow IDs on Goal or Task.
- [ ] All references are logical and application/domain validated; the schema declares no database foreign keys.

## Tests

- Unit tests for policy selection, direction validation, Project-context membership, and invalid endpoint pairs.
- Contract tests for the workflow-guidance resolver port.
- Schema tests proving no project, workflow, or membership columns in `goals` or `tasks`.

## Dependencies

- Parent Feature: #21.
- Depends on #17 Goal, #18 Task, #19 relation, and #20 Project context.

---

## 2. 中文翻译

父级 Feature：#21 —— 在层级保护下分解目标与任务

## 结果

一个与框架无关的 Project 范围分解约定定义了允许的 Goal-to-Goal、Goal-to-Task 和 Task-to-Task 层级边，以及图变更前所需的逻辑验证。

## 实施计划

1. 定义 Goal parent → Goal child、Goal parent → Task child 和 Task parent → Task child 的规范定向分解关系策略，包括关系类型和项目上下文元数据。
2. 定义 Project 如何包含每个端点：Goal 通过适用的活动 Project–Goal 追求/上下文关系，Task 通过活动 Task–Project 成员关系，且不在 Goal 或 Task 表中添加项目 ID。
3. 通过应用/领域端口验证 Project 和带类型端点的存在性、同一项目上下文中的活动成员关系、允许的方向、归档资格、自链接禁止以及父级/基数规则。
4. 定义工作流指导解析器端口，以 Project、操作/分解目的、实体类型、适用的管理标签和版本为键，返回明确的缺失/已归档/模糊/不兼容错误。

## 验收标准

- [ ] 仅支持 Goal→Goal、Goal→Task 和 Task→Task 分解方向。
- [ ] 每次分解操作都需要在 Goal 和 Task 表之外表示的现有 Project 上下文。
- [ ] 两个端点必须存在，并满足同一 Project 的文档化活动成员关系/上下文策略。
- [ ] 自链接、违反策略的跨项目链接、反向/不支持的端点对、不符合归档资格的端点和基数违反会被作为不同的领域错误拒绝。
- [ ] 可以通过显式端口解析适用的分解工作流指导，而无需在 Goal 或 Task 上存储工作流 ID。
- [ ] 所有引用都是逻辑的并由应用/领域验证；模式不声明数据库外键。

## 测试

- 针对策略选择、方向验证、项目上下文成员关系和无效端点对的单元测试。
- 针对工作流指导解析器端口的约定测试。
- 证明 `goals` 或 `tasks` 中没有项目、工作流或成员关系列的模式测试。

## 依赖

- 父级 Feature：#21。
- 依赖 #17 Goal、#18 Task、#19 关系和 #20 Project 上下文。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | defines the permitted hierarchy edges |
| validate | 验证 | logical validation required before graph mutation |
| satisfy | 满足 | satisfy the documented active membership policy |
| reject | 拒绝 | rejected as distinct domain errors |
| store | 存储 | without storing workflow IDs on Goal or Task |
| resolve | 解析 | Workflow guidance can be resolved |
| declare | 声明 | the schema declares no database foreign keys |
| prohibit | 禁止 | self-link prohibition |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| project-scoped | 项目范围的 | Project-scoped decomposition contract |
| hierarchy edge | 层级边 | permitted hierarchy edges |
| graph mutation | 图变更 | before graph mutation |
| decomposition relation policy | 分解关系策略 | directed decomposition relation policies |
| active membership | 活动成员关系 | active membership/context policy |
| archive eligibility | 归档资格 | archive-ineligible endpoints |
| workflow-guidance resolver | 工作流指导解析器 | workflow-guidance resolver port |
| distinct domain errors | 不同的领域错误 | rejected as distinct domain errors |

### 值得模仿的句式
1. **"A defines the permitted B and the C required before D."** — A 定义允许的 B 以及 D 之前所需的 C。 — A framework-neutral Project-scoped decomposition contract defines the permitted Goal-to-Goal, Goal-to-Task, and Task-to-Task hierarchy edges and the logical validation required before graph mutation.
2. **"A are rejected as distinct B errors."** — A 被作为不同的 B 错误拒绝。 — Self-links, cross-project links, reversed pairs, archive-ineligible endpoints, and cardinality violations are rejected as distinct domain errors.
3. **"A can be resolved through B without storing C on D."** — A 可以通过 B 解析，而无需在 D 上存储 C。 — Applicable decomposition Workflow guidance can be resolved through an explicit port without storing workflow IDs on Goal or Task.

### 领域词汇
| English | 中文 |
|---|---|
| Decomposition | 分解 |
| Hierarchy edge | 层级边 |
| Graph mutation | 图变更 |
| Project-scoped | 项目范围的 |
| Workflow guidance | 工作流指导 |
| Self-link | 自链接 |
| Cardinality violation | 基数违反 |
| Domain error | 领域错误 |
| Foreign key | 外键 |

---

## 4. 小练习

1. A Project-scoped decomposition contract defines the permitted hierarchy ______.
2. Only Goal→Goal, Goal→Task, and Task→Task decomposition ______ are supported.
3. Self-links and cross-project links are rejected as distinct ______ errors.
4. Workflow guidance can be resolved through an explicit ______.
5. The schema declares no database foreign ______.

<details>
<summary>点击查看答案</summary>

1. edges
2. directions
3. domain
4. port
5. keys
</details>
