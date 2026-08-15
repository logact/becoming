# Issue #9: Feature: Audit lifecycle state transitions

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users can explain every accepted lifecycle change, including its previous state, new state, governing project machine, actor, and time.

## Scope

- Emit a Record for each successful project-scoped entity state transition.
- Capture project, entity, management label, source state, destination state, actor, and transition time.
- Preserve relevant condition or criteria evaluation results.
- Keep the audit entry consistent with runtime state-history updates.

## Acceptance criteria

- Every successful transition creates exactly one structured state-transition Record.
- Rejected transitions do not create successful transition Records or change current state.
- The payload identifies the project, entity type and ID, label, from-state, and to-state.
- Transition time and actor are queryable.
- The state-history update and audit Record are committed atomically.
- Historical entries continue to resolve meaningfully after workflow or project-machine changes.

## Dependencies

- Feature: Record occurrences as first-class domain data.
- Feature: Execute project-scoped lifecycle transitions.

## Out of scope

- Defining state machines and allowed transitions.
- General entity mutation provenance.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户可以解释每个被接受的生命周期变更，包括其先前状态、新状态、管理项目机器、行为者和时间。

## 范围

- 为每个成功的项目范围实体状态转换发出记录。
- 捕获项目、实体、管理标签、源状态、目标状态、行为者和转换时间。
- 保留相关条件或标准评估结果。
- 使审计条目与运行时状态历史更新保持一致。

## 验收标准

- 每个成功的转换创建一条结构化的状态转换记录。
- 被拒绝的转换不会创建成功的转换记录或改变当前状态。
- 载荷标识项目、实体类型和 ID、标签、源状态和目标状态。
- 转换时间和行为者可查询。
- 状态历史更新和审计记录原子性提交。
- 在工作流或项目机器变更后，历史条目继续有意义地解析。

## 依赖

- 功能：将发生记录作为一等领域数据。
- 功能：执行项目范围生命周期转换。

## 范围外

- 定义状态机和允许转换。
- 一般实体变更来源。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| explain | 解释 | Users can explain every accepted lifecycle change. |
| emit | 发出 | Emit a Record for each successful project-scoped entity state transition. |
| capture | 捕获 | Capture project, entity, management label, source state, and destination state. |
| preserve | 保留 | Preserve relevant condition or criteria evaluation results. |
| keep | 保持 | Keep the audit entry consistent with runtime state-history updates. |
| create | 创建 | Every successful transition creates exactly one structured state-transition Record. |
| reject | 拒绝 | Rejected transitions do not create successful transition Records. |
| identify | 标识 | The payload identifies the project, entity type and ID, label, from-state, and to-state. |
| query | 查询 | Transition time and actor are queryable. |
| commit | 提交 | The state-history update and audit Record are committed atomically. |
| resolve | 解析 | Historical entries continue to resolve meaningfully. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| lifecycle state transitions | 生命周期状态转换 | 实体在生命周期中的状态变化 |
| project-scoped entity | 项目范围实体 | 属于某个项目的实体 |
| state-transition Record | 状态转换记录 | 记录状态转换的来源记录 |
| management label | 管理标签 | 用于管理实体的标签 |
| source state | 源状态 | 转换前的状态 |
| destination state | 目标状态 | 转换后的状态 |
| transition time | 转换时间 | 状态发生转换的时间 |
| condition evaluation | 条件评估 | 对转换条件的评估 |
| criteria evaluation | 标准评估 | 对标准的评估 |
| runtime state-history | 运行时状态历史 | 运行时的状态变更历史 |
| accepted transition | 被接受的转换 | 通过验证的转换 |

### 值得模仿的句式
1. **“Users can explain every accepted lifecycle change, including its previous state, new state, governing project machine, actor, and time.”** — 用户可以解释每个被接受的生命周期变更，包括其先前状态、新状态、管理项目机器、行为者和时间。 — 例句：Users can explain every accepted approval, including its previous status, new status, actor, and time.
2. **“Every successful transition creates exactly one structured state-transition Record.”** — 每个成功的转换创建一条结构化的状态转换记录。 — 例句：Every successful payment creates exactly one structured payment record.
3. **“The state-history update and audit Record are committed atomically.”** — 状态历史更新和审计记录原子性提交。 — 例句：The balance update and audit record are committed atomically.

### 领域词汇
| English | 中文 |
|---|---|
| Lifecycle state transition | 生命周期状态转换 |
| Project machine | 项目机器 |
| Management label | 管理标签 |
| Source state | 源状态 |
| Destination state | 目标状态 |
| State-transition Record | 状态转换记录 |
| Condition evaluation | 条件评估 |
| Criteria evaluation | 标准评估 |
| Runtime state-history | 运行时状态历史 |
| Project-scoped | 项目范围的 |

---

## 4. 小练习

1. Users can explain every accepted lifecycle change, including its previous state, new state, governing project ______, actor, and time.
2. We emit a Record for each successful project-scoped entity state ______.
3. Rejected transitions do not create successful transition Records or change ______ state.
4. The payload identifies the project, entity type and ID, label, from-state, and ______.
5. The state-history update and audit Record are committed ______.

<details>
<summary>点击查看答案</summary>

1. machine
2. transition
3. current
4. to-state
5. atomically

</details>
