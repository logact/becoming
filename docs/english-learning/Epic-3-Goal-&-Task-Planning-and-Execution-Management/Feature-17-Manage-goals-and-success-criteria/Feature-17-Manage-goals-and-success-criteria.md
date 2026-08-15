# Issue #17: Feature: Manage goals and success criteria

**Labels:** Feature  
**State:** OPEN  
**Parent:** #3: Epic: Goal & Task Planning and Execution Management

---

## 1. Original English

## User outcome

Users can capture a desired future state and the observable criteria that determine whether it has been achieved.

## Scope

- Create, read, update, archive, and list Goal entities.
- Capture title, description, target state, and success criteria.
- Validate required intrinsic fields without embedding project, workflow, state, label, or resource data.
- Emit provenance for important mutations.

## Acceptance criteria

- A Goal requires a title and target state.
- Success criteria and description are optional and round-trip without loss.
- Goal updates change updated-at but not created-at.
- Archiving excludes a Goal from active lists without deleting it.
- Project membership, hierarchy, lifecycle, labels, and resources are not stored as Goal columns.
- Important mutations produce structured provenance.

## Dependencies

- Feature: Capture provenance for core entity mutations.

## Out of scope

- Goal decomposition.
- Goal lifecycle transitions.
- Progress calculation.

Parent: #3

---

## 2. 中文翻译

## 用户价值

用户可以捕获期望的未来状态，以及判断该状态是否已实现的可见标准。

## 范围

- 创建、读取、更新、归档和列出 Goal 实体。
- 捕获标题、描述、目标状态和成功标准。
- 仅验证必需的内在字段，不嵌入项目、工作流、状态、标签或资源数据。
- 为重要变更生成来源追溯记录。

## 验收标准

- Goal 必须具有标题和目标状态。
- 成功标准和描述为可选字段，且在往返过程中不丢失。
- Goal 更新会改变 updated-at，但不会改变 created-at。
- 归档操作会将 Goal 从活动列表中排除，但不会删除它。
- 项目成员关系、层级结构、生命周期、标签和资源不会作为 Goal 的列存储。
- 重要变更会产生结构化的来源追溯。

## 依赖

- Feature：为核心实体变更捕获来源追溯。

## 超出范围

- Goal 分解。
- Goal 生命周期转换。
- 进度计算。

父级：#3

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| capture | 捕获、记录 | Users can capture a desired future state. |
| determine | 确定 | observable criteria that determine whether it has been achieved |
| validate | 验证 | Validate required intrinsic fields |
| embed | 嵌入 | without embedding project, workflow, state, label, or resource data |
| emit | 发出、生成 | Emit provenance for important mutations. |
| archive | 归档 | Archiving excludes a Goal from active lists |
| round-trip | 往返、原样返回 | Success criteria and description are optional and round-trip without loss. |
| exclude | 排除 | Archiving excludes a Goal from active lists |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| desired future state | 期望的未来状态 | capture a desired future state |
| observable criteria | 可观察的标准 | observable criteria that determine achievement |
| success criteria | 成功标准 | Capture title, description, target state, and success criteria |
| intrinsic fields | 内在字段 | Validate required intrinsic fields |
| round-trip without loss | 无损往返 | round-trip without loss |
| active lists | 活动列表 | excludes a Goal from active lists |
| lifecycle transitions | 生命周期转换 | Goal lifecycle transitions |
| core entity mutations | 核心实体变更 | provenance for core entity mutations |

### 值得模仿的句式
1. **"Users can capture A and the B that determine whether C."** — 用户可以捕获 A 以及判断 C 是否成立的 B。 — Users can capture a desired future state and the observable criteria that determine whether it has been achieved.
2. **"A are optional and round-trip without loss."** — A 是可选的，并且在往返过程中不会丢失。 — Success criteria and description are optional and round-trip without loss.
3. **"A excludes B from C without deleting it."** — A 将 B 从 C 中排除，但不会删除它。 — Archiving excludes a Goal from active lists without deleting it.

### 领域词汇
| English | 中文 |
|---|---|
| Goal | 目标 |
| Entity | 实体 |
| Provenance | 来源追溯 |
| Mutation | 变更/突变 |
| Target state | 目标状态 |
| Success criteria | 成功标准 |
| Intrinsic fields | 内在字段 |
| Lifecycle transition | 生命周期转换 |
| Archive | 归档 |

---

## 4. 小练习

1. Users can capture a desired future state and the ______ criteria that determine achievement.
2. A Goal requires a title and ______ state.
3. Success criteria and description are optional and ______ without loss.
4. ______ excludes a Goal from active lists without deleting it.
5. Project membership and hierarchy are not stored as Goal ______.

<details>
<summary>点击查看答案</summary>

1. observable
2. target
3. round-trip
4. Archiving
5. columns
</details>
