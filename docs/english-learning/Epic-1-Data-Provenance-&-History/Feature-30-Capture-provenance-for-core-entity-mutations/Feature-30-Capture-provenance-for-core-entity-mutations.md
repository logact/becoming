# Issue #30: Feature: Capture provenance for core entity mutations

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users can determine who or what created or changed a core entity, when it happened, and what materially changed.

## Scope

- Emit structured provenance for creation, update, archival, and supported deletion operations.
- Identify the affected entity type and ID, action, actor, and timestamp.
- Include relevant before-and-after values for updates.
- Apply the behavior consistently to all supported core concepts.
- Make mutation recording part of the same application operation as the mutation.

## Acceptance criteria

- Important mutations of Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record entities create provenance Records.
- Each provenance Record identifies entity, action, actor, and event time.
- Updates include relevant before-and-after data while avoiding unrelated or sensitive fields.
- A failed mutation does not leave a successful provenance Record, and a provenance failure does not leave an unrecorded successful mutation.
- Archive and restoration actions, if restoration is supported, are distinguishable.
- Automated tests cover create, update, and archive paths for every supported entity type.

## Dependencies

- Feature: Record occurrences as first-class domain data.

## Out of scope

- Lifecycle-transition-specific payloads.
- Read-access auditing.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户可以确定谁或什么创建或变更了核心实体，何时发生，以及什么实质性变更。

## 范围

- 为创建、更新、归档和支持的删除操作发出结构化来源信息。
- 标识受影响实体类型和 ID、操作、行为者和时间戳。
- 包括更新相关的前后值。
- 将该行为一致地应用于所有支持的核心概念。
- 使变更记录成为与变更相同的应用操作的一部分。

## 验收标准

- 任务、目标、项目、想法、理念、工作流、资源和记录实体的重要变更创建来源记录。
- 每个来源记录标识实体、操作、行为者和事件时间。
- 更新包括相关的前后数据，同时避免无关或敏感字段。
- 失败的变更不会留下成功的来源记录，来源失败也不会留下未记录的成功变更。
- 归档和恢复操作（如果支持恢复）是可区分的。
- 自动化测试覆盖每种支持实体类型的创建、更新和归档路径。

## 依赖

- 功能：将发生记录作为一等领域数据。

## 范围外

- 生命周期转换特定载荷。
- 读取访问审计。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| determine | 确定 | Users can determine who or what created or changed a core entity. |
| emit | 发出 | Emit structured provenance for creation, update, archival, and deletion operations. |
| identify | 标识 | Identify the affected entity type and ID, action, actor, and timestamp. |
| include | 包含 | Include relevant before-and-after values for updates. |
| apply | 应用 | Apply the behavior consistently to all supported core concepts. |
| make | 使成为 | Make mutation recording part of the same application operation. |
| create | 创建 | Important mutations create provenance Records. |
| leave | 留下 | A failed mutation does not leave a successful provenance Record. |
| distinguish | 区分 | Archive and restoration actions are distinguishable. |
| cover | 覆盖 | Automated tests cover create, update, and archive paths. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| core entity mutations | 核心实体变更 | 核心实体的创建/更新等变更 |
| provenance Records | 来源记录 | 记录变更来源的实体 |
| affected entity | 受影响实体 | 被变更的实体 |
| action actor | 操作行为者 | 执行操作的人或系统 |
| event time | 事件时间 | 变更发生的时间 |
| before-and-after values | 前后值 | 变更前后的数据 |
| supported deletion operations | 支持的删除操作 | 领域允许的删除 |
| current-state mutation | 当前状态变更 | 对当前状态的修改 |
| read-access auditing | 读取访问审计 | 记录读取操作 |
| lifecycle-transition-specific payloads | 生命周期转换特定载荷 | 状态转换专用数据结构 |

### 值得模仿的句式
1. **“Users can determine who or what created or changed a core entity, when it happened, and what materially changed.”** — 用户可以确定谁或什么创建或变更了核心实体，何时发生，以及什么实质性变更。 — 例句：Users can determine who created or changed a document, when it happened, and what changed.
2. **“Important mutations of ... entities create provenance Records.”** — ...实体的重要变更创建来源记录。 — 例句：Important mutations of customer records create audit entries.
3. **“A failed mutation does not leave a successful provenance Record, and a provenance failure does not leave an unrecorded successful mutation.”** — 失败的变更不会留下成功的来源记录，来源失败也不会留下未记录的成功变更。 — 例句：A failed transaction does not leave a successful receipt, and a receipt failure does not leave an unrecorded successful payment.

### 领域词汇
| English | 中文 |
|---|---|
| Core entity mutation | 核心实体变更 |
| Provenance Record | 来源记录 |
| Affected entity | 受影响实体 |
| Event time | 事件时间 |
| Before-and-after data | 前后数据 |
| Read-access auditing | 读取访问审计 |
| Archive/restoration | 归档/恢复 |
| Supported deletion | 支持的删除 |
| Application operation | 应用操作 |
| Material change | 实质性变更 |

---

## 4. 小练习

1. Users can determine who or what created or changed a core entity, when it happened, and what ______ changed.
2. We emit structured ______ for creation, update, archival, and supported deletion operations.
3. Each provenance Record identifies entity, action, actor, and ______ time.
4. Updates include relevant before-and-after data while avoiding unrelated or ______ fields.
5. A failed mutation does not leave a successful provenance Record, and a provenance failure does not leave an unrecorded successful ______.

<details>
<summary>点击查看答案</summary>

1. materially
2. provenance
3. event
4. sensitive
5. mutation

</details>
