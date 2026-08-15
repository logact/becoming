# Issue #1: Epic: Data Provenance & History

**Labels:** Epic  
**State:** OPEN  
**Parent:** None

---

## 1. Original English

## Purpose

Preserve how the system reached its current state and provide an inspectable history across core entities. This is a cross-cutting platform capability.

## Scope

- Record creation, modification, deletion, and archival of core entities.
- Record state transitions.
- Record relationships being created or removed.
- Record where an entity originated.
- Maintain historical versions where necessary.
- Allow users and other system capabilities to inspect history.

The capability should support Goals, Projects, Tasks, Workflows, Resources, Decisions, Ideas, and future domain entities.

## Non-goals

- Defining the business workflow itself.
- Replacing the current-state domain model.
- Implementing every audit view in the first iteration.

## Acceptance criteria

- Important domain mutations produce structured provenance records.
- Records identify the entity, action, actor, timestamp, and relevant before/after data.
- Relationship and state changes are queryable.
- Origin and transformation links can be represented.
- History is append-oriented and protected from ordinary mutation.
- Consumers can retrieve an entity's timeline.

## Dependencies

- Establish a shared event/history model usable by all epics.

This issue is labeled Epic.

---

## 2. 中文翻译

## 目的

保留系统如何达到当前状态的过程，并在所有核心实体之间提供可检查的历史记录。这是一项跨平台的横向能力。

## 范围

- 记录核心实体的创建、修改、删除和归档。
- 记录状态转换。
- 记录关系的建立或解除。
- 记录实体的来源。
- 在必要时维护历史版本。
- 允许用户和其他系统能力检查历史。

该能力应支持目标（Goals）、项目（Projects）、任务（Tasks）、工作流（Workflows）、资源（Resources）、决策（Decisions）、想法（Ideas）以及未来的领域实体。

## 非目标

- 定义业务工作流本身。
- 取代当前状态的领域模型。
- 在第一次迭代中实现所有审计视图。

## 验收标准

- 重要的领域变更会产生结构化的来源记录。
- 记录标识实体、操作、行为者、时间戳以及相关的前后数据。
- 关系和状态变更是可查询的。
- 来源和转换链接可以被表示。
- 历史是追加导向的，并受到保护以防止普通变更。
- 消费者可以检索实体的时间线。

## 依赖

- 建立一个可被所有 Epic 共享的事件/历史模型。

本 Issue 标记为 Epic。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| preserve | 保留、保持 | Preserve how the system reached its current state. |
| provide | 提供 | Provide an inspectable history across core entities. |
| record | 记录 | Record creation, modification, deletion, and archival of core entities. |
| maintain | 维护 | Maintain historical versions where necessary. |
| allow | 允许 | Allow users and other system capabilities to inspect history. |
| support | 支持 | The capability should support Goals, Projects, Tasks, and future domain entities. |
| identify | 标识 | Records identify the entity, action, actor, timestamp, and relevant before/after data. |
| replace | 取代 | Replacing the current-state domain model is a non-goal. |
| implement | 实现 | Implementing every audit view in the first iteration is a non-goal. |
| retrieve | 检索 | Consumers can retrieve an entity's timeline. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| cross-cutting platform capability | 跨平台的横向能力 | 描述同时影响多个模块的基础设施能力 |
| core entities | 核心实体 | 系统中最重要的业务对象 |
| inspectable history | 可检查的历史 | 可被用户或系统查询和理解的历史 |
| state transitions | 状态转换 | 实体从一个状态迁移到另一个状态 |
| provenance records | 来源记录 | 说明变更来源的结构化记录 |
| append-oriented history | 追加导向的历史 | 只追加、不修改的历史存储方式 |
| current-state domain model | 当前状态的领域模型 | 描述实体当前状态的模型 |
| acceptance criteria | 验收标准 | 判定需求是否完成的标准 |
| before/after data | 前后数据 | 变更前后的数据对比 |
| domain mutations | 领域变更 | 领域模型上的重要变更 |

### 值得模仿的句式
1. **“Preserve how the system reached its current state...”** — 保留系统如何达到当前状态的过程。 — 例句：Preserve how the decision was made so future reviewers can understand it.
2. **“This is a cross-cutting platform capability.”** — 这是一项跨平台的横向能力。 — 例句：Authentication is a cross-cutting concern in most web applications.
3. **“Important domain mutations produce structured provenance records.”** — 重要的领域变更会产生结构化的来源记录。 — 例句：Important user actions produce structured audit records for compliance.

### 领域词汇
| English | 中文 |
|---|---|
| Data Provenance | 数据来源 / 溯源 |
| History | 历史记录 |
| Core entities | 核心实体 |
| State transitions | 状态转换 |
| Provenance records | 来源记录 |
| Append-oriented | 追加导向的 |
| Domain mutations | 领域变更 |
| Acceptance criteria | 验收标准 |
| Cross-cutting | 横向的 / 横切的 |
| Audit view | 审计视图 |

---

## 4. 小练习

1. Important domain ______ produce structured provenance records.
2. History is ______-oriented and protected from ordinary mutation.
3. The capability should support Goals, Projects, Tasks, Workflows, Resources, Decisions, Ideas, and future ______ entities.
4. This is a ______ platform capability.
5. Records identify the entity, action, actor, timestamp, and relevant before/after ______.

<details>
<summary>点击查看答案</summary>

1. mutations
2. append
3. domain
4. cross-cutting
5. data

</details>
