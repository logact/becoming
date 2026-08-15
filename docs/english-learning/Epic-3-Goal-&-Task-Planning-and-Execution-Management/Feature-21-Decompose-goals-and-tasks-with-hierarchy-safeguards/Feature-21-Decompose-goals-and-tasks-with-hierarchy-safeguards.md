# Issue #21: Feature: Decompose goals and tasks with hierarchy safeguards

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users can refine Goals into sub-goals and Tasks, and split large Tasks into smaller executable Tasks, without creating an invalid hierarchy.

## Scope

- Represent Goal-to-Goal, Goal-to-Task, and Task-to-Task decomposition relationships.
- Require a Project context for managed decomposition.
- Validate permitted endpoint types, direction, project membership, and cardinality.
- Prevent self-links and hierarchy cycles.
- Query parents, children, ancestors, and descendants with bounded traversal.

## Acceptance criteria

- A Project can contain nested Goals and Tasks with explicit relations.
- A Goal can be decomposed into sub-goals and Tasks.
- A Task can be decomposed into smaller Tasks.
- Self-references, cycles, missing endpoints, and cross-project links that violate policy are rejected.
- Ending a decomposition relation preserves historical structure.
- Traversal produces deterministic results and cannot loop indefinitely.
- Applicable decomposition Workflow guidance can be resolved for the operation.

## Dependencies

- Feature: Manage goals and success criteria.
- Feature: Manage tasks and project membership.
- Feature: Create and validate semantic relations.
- Feature: Apply workflows to entities and initialize project machines.

## Out of scope

- Automatic AI-generated decomposition.
- General dependency scheduling.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户可以将 Goal 细化为子目标和任务，并将大任务拆分为更小的可执行任务，而不会创建无效的层级结构。

## 范围

- 表示 Goal-to-Goal、Goal-to-Task 和 Task-to-Task 的分解关系。
- 要求为受管理的分解提供 Project 上下文。
- 验证允许的端点类型、方向、项目成员关系和基数。
- 防止自链接和层级循环。
- 以有界遍历查询父级、子级、祖先和后代。

## 验收标准

- 项目可以包含具有明确关系的嵌套目标和任务。
- 目标可以分解为子目标和任务。
- 任务可以分解为更小的任务。
- 自引用、循环、缺失端点以及违反策略的跨项目链接会被拒绝。
- 结束分解关系会保留历史结构。
- 遍历产生确定性结果，且不会无限循环。
- 可以为操作解析适用的分解工作流指导。

## 依赖

- Feature：管理目标与成功标准。
- Feature：管理任务与项目成员关系。
- Feature：创建并验证语义关系。
- Feature：将工作流应用于实体并初始化项目状态机。

## 超出范围

- 自动 AI 生成的分解。
- 通用依赖调度。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| refine | 细化 | refine Goals into sub-goals and Tasks |
| split | 拆分 | split large Tasks into smaller executable Tasks |
| decompose | 分解 | A Goal can be decomposed into sub-goals |
| represent | 表示 | Represent Goal-to-Goal decomposition relationships |
| validate | 验证 | Validate permitted endpoint types |
| prevent | 防止 | Prevent self-links and hierarchy cycles |
| loop | 循环 | cannot loop indefinitely |
| resolve | 解析 | Workflow guidance can be resolved |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| hierarchy safeguards | 层级保护 | hierarchy safeguards |
| invalid hierarchy | 无效层级 | without creating an invalid hierarchy |
| decomposition relationship | 分解关系 | decomposition relationships |
| project context | 项目上下文 | Require a Project context |
| project membership | 项目成员关系 | validate project membership |
| self-link | 自链接 | Prevent self-links |
| hierarchy cycle | 层级循环 | hierarchy cycles |
| bounded traversal | 有界遍历 | bounded traversal |

### 值得模仿的句式
1. **"Users can A and B, without creating C."** — 用户可以 A 和 B，而不会创建 C。 — Users can refine Goals into sub-goals and Tasks, and split large Tasks into smaller executable Tasks, without creating an invalid hierarchy.
2. **"A produces B and cannot C."** — A 产生 B，且不能 C。 — Traversal produces deterministic results and cannot loop indefinitely.
3. **"Applicable ... guidance can be resolved for the operation."** — 可以为操作解析适用的……指导。 — Applicable decomposition Workflow guidance can be resolved for the operation.

### 领域词汇
| English | 中文 |
|---|---|
| Decomposition | 分解 |
| Hierarchy | 层级结构 |
| Sub-goal | 子目标 |
| Ancestor | 祖先 |
| Descendant | 后代 |
| Self-link | 自链接 |
| Cycle | 循环 |
| Bounded traversal | 有界遍历 |
| Workflow guidance | 工作流指导 |

---

## 4. 小练习

1. Users can refine Goals into sub-goals and Tasks, and split large Tasks into smaller ______ Tasks.
2. A Project can contain nested Goals and Tasks with ______ relations.
3. Self-references, cycles, and cross-project links that violate policy are ______.
4. Traversal produces deterministic results and cannot ______ indefinitely.
5. Prevent self-links and hierarchy ______.

<details>
<summary>点击查看答案</summary>

1. executable
2. explicit
3. rejected
4. loop
5. cycles
</details>
