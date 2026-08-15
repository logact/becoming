# Issue #20: Feature: Manage projects and goal pursuit

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users can create a Project as the management context for pursuing one or more Goals.

## Scope

- Create, read, update, archive, and list Project entities.
- Capture title, description, and purpose.
- Link Projects and Goals using explicit semantic relations.
- Query the active Projects pursuing a Goal and the Goals pursued by a Project.

## Acceptance criteria

- A Project requires a title; description and purpose are optional.
- A Goal can be pursued through one or more Projects.
- A Project can pursue one or more Goals.
- Invalid or duplicate active Goal–Project relationships are rejected.
- Ending a pursuit relationship does not delete either endpoint.
- Archived Projects remain available to historical queries.
- Important mutations and relationship changes produce provenance.

## Dependencies

- Feature: Manage goals and success criteria.
- Feature: Create and validate semantic relations.
- Feature: Track relationship changes over time.

## Out of scope

- Project progress calculation.
- Project resource budgets.
- Workflow definition.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户可以创建一个 Project，作为追求一个或多个 Goal 的管理上下文。

## 范围

- 创建、读取、更新、归档和列出 Project 实体。
- 捕获标题、描述和目的。
- 使用显式语义关系链接 Project 和 Goal。
- 查询追求某个 Goal 的活动 Project，以及某个 Project 正在追求的 Goal。

## 验收标准

- Project 必须具有标题；描述和目的为可选字段。
- 一个 Goal 可以通过一个或多个 Project 来追求。
- 一个 Project 可以追求一个或多个 Goal。
- 无效或重复的活动 Goal–Project 关系会被拒绝。
- 结束追求关系不会删除任一端点。
- 已归档 Project 仍可用于历史查询。
- 重要变更和关系变更会产生来源追溯。

## 依赖

- Feature：管理目标与成功标准。
- Feature：创建并验证语义关系。
- Feature：跟踪关系随时间的变化。

## 超出范围

- 项目进度计算。
- 项目资源预算。
- 工作流定义。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| pursue | 追求 | pursuing one or more Goals |
| create | 创建 | create a Project |
| link | 链接 | Link Projects and Goals |
| query | 查询 | Query the active Projects pursuing a Goal |
| reject | 拒绝 | Invalid or duplicate active relationships are rejected |
| archive | 归档 | Archived Projects remain available |
| produce | 产生 | Important mutations produce provenance |
| end | 结束 | Ending a pursuit relationship |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| management context | 管理上下文 | management context for pursuing Goals |
| goal pursuit | 目标追求 | Manage projects and goal pursuit |
| active Projects | 活动项目 | active Projects pursuing a Goal |
| pursuit relationship | 追求关系 | Goal–Project pursuit relationship |
| historical queries | 历史查询 | available to historical queries |
| resource budget | 资源预算 | Project resource budgets |
| semantic relation | 语义关系 | explicit semantic relations |
| relationship change | 关系变更 | relationship changes produce provenance |

### 值得模仿的句式
1. **"Users can create A as the B for C."** — 用户可以创建 A 作为 C 的 B。 — Users can create a Project as the management context for pursuing one or more Goals.
2. **"A can be pursued through one or more B."** — A 可以通过一个或多个 B 来追求。 — A Goal can be pursued through one or more Projects.
3. **"Ending A does not delete either B."** — 结束 A 不会删除任一 B。 — Ending a pursuit relationship does not delete either endpoint.

### 领域词汇
| English | 中文 |
|---|---|
| Project | 项目 |
| Goal | 目标 |
| Pursuit | 追求 |
| Management context | 管理上下文 |
| Semantic relation | 语义关系 |
| Archive | 归档 |
| Provenance | 来源追溯 |
| Resource budget | 资源预算 |
| Endpoint | 端点 |

---

## 4. 小练习

1. Users can create a Project as the management ______ for pursuing Goals.
2. A Goal can be pursued through one or more ______.
3. Invalid or duplicate active Goal–Project relationships are ______.
4. Ending a pursuit relationship does not delete either ______.
5. Archived Projects remain available to ______ queries.

<details>
<summary>点击查看答案</summary>

1. context
2. Projects
3. rejected
4. endpoint
5. historical
</details>
