# Issue #18: Feature: Manage tasks and project membership

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users can define executable work with a clear target and completion conditions, then organize it inside a Project.

## Scope

- Create, read, update, archive, and list Task entities.
- Capture title, description, target description, exit criteria, and priority.
- Link Tasks to Projects using semantic relations.
- Query a Project's active Tasks and a Task's Project contexts.

## Acceptance criteria

- A Task requires a title and target description.
- Exit criteria, description, and priority are optional and validated when supplied.
- Project membership is represented outside the Task table.
- Invalid or duplicate active Task–Project membership is rejected.
- Ending membership preserves both entities and relationship history.
- State, labels, workflow, deadlines, budgets, dependencies, and resources are not stored as Task columns.
- Important mutations and relationship changes produce provenance.

## Dependencies

- Feature: Create and validate semantic relations.
- Feature: Capture provenance for core entity mutations.
- Feature: Manage projects and goal pursuit.

## Out of scope

- Task decomposition.
- Lifecycle transitions.
- Resource allocation.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户可以定义具有清晰目标和完成条件的可执行工作，并将其组织到项目内部。

## 范围

- 创建、读取、更新、归档和列出 Task 实体。
- 捕获标题、描述、目标描述、退出条件和优先级。
- 使用语义关系将 Task 关联到 Project。
- 查询项目的活动任务以及任务的项目上下文。

## 验收标准

- Task 必须具有标题和目标描述。
- 退出条件、描述和优先级为可选字段，提供时会进行验证。
- 项目成员关系在 Task 表之外表示。
- 无效或重复的活动 Task–Project 成员关系会被拒绝。
- 结束成员关系会保留两个实体以及关系历史。
- 状态、标签、工作流、截止日期、预算、依赖和资源不会作为 Task 的列存储。
- 重要变更和关系变更会产生来源追溯。

## 依赖

- Feature：创建并验证语义关系。
- Feature：为核心实体变更捕获来源追溯。
- Feature：管理项目与目标追求。

## 超出范围

- Task 分解。
- 生命周期转换。
- 资源分配。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Users can define executable work |
| organize | 组织 | organize it inside a Project |
| capture | 捕获 | Capture title, description, target description |
| link | 关联 | Link Tasks to Projects using semantic relations |
| query | 查询 | Query a Project's active Tasks |
| reject | 拒绝 | Invalid or duplicate active membership is rejected |
| preserve | 保留 | Ending membership preserves both entities |
| validate | 验证 | Exit criteria are optional and validated when supplied |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| executable work | 可执行的工作 | define executable work |
| completion conditions | 完成条件 | clear target and completion conditions |
| semantic relations | 语义关系 | using semantic relations |
| project membership | 项目成员关系 | Project membership is represented outside the Task table |
| exit criteria | 退出条件 | target description, exit criteria, and priority |
| active Tasks | 活动任务 | a Project's active Tasks |
| relationship history | 关系历史 | preserves both entities and relationship history |
| resource allocation | 资源分配 | Resource allocation |

### 值得模仿的句式
1. **"Users can define A with B, then organize it inside C."** — 用户可以定义具有 B 的 A，然后将其组织到 C 内部。 — Users can define executable work with a clear target and completion conditions, then organize it inside a Project.
2. **"A is represented outside the B table."** — A 在 B 表之外表示。 — Project membership is represented outside the Task table.
3. **"Ending A preserves both B and C."** — 结束 A 会保留 B 和 C。 — Ending membership preserves both entities and relationship history.

### 领域词汇
| English | 中文 |
|---|---|
| Task | 任务 |
| Project | 项目 |
| Project membership | 项目成员关系 |
| Semantic relation | 语义关系 |
| Exit criteria | 退出条件 |
| Priority | 优先级 |
| Lifecycle transition | 生命周期转换 |
| Resource allocation | 资源分配 |
| Provenance | 来源追溯 |

---

## 4. 小练习

1. Users can define executable work with a clear target and ______ conditions.
2. Project membership is represented ______ the Task table.
3. Invalid or duplicate active Task–Project membership is ______.
4. State, labels, and workflow are not stored as Task ______.
5. Tasks are linked to Projects using ______ relations.

<details>
<summary>点击查看答案</summary>

1. completion
2. outside
3. rejected
4. columns
5. semantic
</details>
