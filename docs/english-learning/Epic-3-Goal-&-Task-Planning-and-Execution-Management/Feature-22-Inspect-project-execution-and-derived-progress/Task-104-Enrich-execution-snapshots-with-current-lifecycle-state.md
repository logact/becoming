# Issue #104: Task: Enrich execution snapshots with current lifecycle state

**Labels:** task  
**State:** CLOSED  
**Parent:** #22: Feature: Inspect project execution and derived progress

---

## 1. Original English

Parent Feature: #22 — Feature: Inspect project execution and derived progress

## Outcome

Each managed entity in a Project execution snapshot is enriched with its current state for every applicable management label, while absent or corrupt lifecycle data remains explicit.

## Implementation plan

1. Define lifecycle enrichment values per entity and management label, including current Project State, entered time, and source machine identity (`project_id + entity_type + label_id`).
2. Resolve applicable management labels/machines and query `project_entity_states` active rows using `ended_at IS NULL`, validating that each referenced Project State matches Project, entity type, and label.
3. Represent entities with no applicable state machine, applicable machines with no initialized current state, and Projects with no lifecycle configuration as distinct defined outcomes.
4. Detect and attach anomalies for multiple current rows, missing/mismatched Project States, or orphan labels; never select an arbitrary row or rewrite history in the read path.

## Acceptance criteria

- [ ] Every managed entity includes current state information for each applicable management label.
- [ ] Current-state lookup uses Project, entity type, entity ID, and label and only rows with `ended_at IS NULL`.
- [ ] The referenced Project State is logically validated against the same Project/entity-type/label machine without database foreign keys.
- [ ] No applicable machine, machine-without-state, and normal current state produce documented distinct results.
- [ ] Multiple-current-state and mismatched/missing-reference anomalies are surfaced rather than silently ignored or collapsed.
- [ ] Historical state rows remain unchanged and available to lifecycle history queries.

## Tests

- Enrichment tests for no labels, one label, multiple management labels, and mixed managed/unmanaged entities.
- Tests for initialized/uninitialized machines and Projects with no lifecycle configuration.
- Anomaly tests for multiple current rows, missing/mismatched states, and orphan labels.
- Read-path tests proving no arbitrary row selection or history rewriting.

## Dependencies

- Parent Feature: #22.
- Depends on Task: Compose current and historical Project execution snapshots.
- Depends on #29/#50+ lifecycle state initialization and current-state queries.

---

## 2. 中文翻译

父级 Feature：#22 —— 检查项目执行和派生进度

## 结果

项目执行快照中的每个受管理实体都会针对每个适用的管理标签充实其当前状态，而缺失或损坏的生命周期数据保持明确。

## 实施计划

1. 按实体和管理标签定义生命周期充实值，包括当前项目状态、进入时间和源状态机标识（`project_id + entity_type + label_id`）。
2. 解析适用的管理标签/状态机，并使用 `ended_at IS NULL` 查询 `project_entity_states` 活动行，验证每个引用的项目状态与项目、实体类型和标签匹配。
3. 将没有适用状态机的实体、有适用状态机但没有初始化当前状态的实体，以及没有生命周期配置的项目表示为不同的定义结果。
4. 检测并附加多当前行、缺失/不匹配项目状态或孤立标签的异常；在读路径中绝不任意选择一行或重写历史。

## 验收标准

- [ ] 每个受管理实体都包含每个适用管理标签的当前状态信息。
- [ ] 当前状态查找使用项目、实体类型、实体 ID 和标签，并且只使用 `ended_at IS NULL` 的行。
- [ ] 引用的项目状态在同一项目/实体类型/标签状态机上进行逻辑验证，不使用数据库外键。
- [ ] 没有适用状态机、有状态机但没有状态、以及正常当前状态会产生文档化的不同结果。
- [ ] 多当前状态和缺失/不匹配引用异常会被呈现，而不是被默默忽略或合并。
- [ ] 历史状态行保持不变，并可供生命周期历史查询使用。

## 测试

- 针对无标签、单标签、多管理标签以及混合受管理/未受管理实体的充实测试。
- 针对已初始化/未初始化状态机以及没有生命周期配置的项目的测试。
- 针对多当前行、缺失/不匹配状态和孤立标签的异常测试。
- 证明读路径中没有任意行选择或历史重写的测试。

## 依赖

- 父级 Feature：#22。
- 依赖任务：组合当前和历史项目执行快照。
- 依赖 #29/#50+ 生命周期状态初始化和当前状态查询。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| enrich | 充实 | enrich execution snapshots with current lifecycle state |
| resolve | 解析 | Resolve applicable management labels/machines |
| validate | 验证 | validating that each referenced Project State matches |
| represent | 表示 | Represent entities with no applicable state machine |
| detect | 检测 | Detect and attach anomalies |
| attach | 附加 | attach anomalies for multiple current rows |
| select | 选择 | never select an arbitrary row |
| rewrite | 重写 | never rewrite history in the read path |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| lifecycle state | 生命周期状态 | current lifecycle state |
| management label | 管理标签 | applicable management label |
| machine identity | 状态机标识 | source machine identity |
| current-state lookup | 当前状态查找 | Current-state lookup |
| ended_at IS NULL | ended_at 为空 | rows with ended_at IS NULL |
| logical validation | 逻辑验证 | logically validated against the machine |
| orphan label | 孤立标签 | orphan labels |
| history rewriting | 历史重写 | no history rewriting |

### 值得模仿的句式
1. **"Each A is enriched with B for every C, while D remains explicit."** — 每个 A 都会针对每个 C 充实 B，而 D 保持明确。 — Each managed entity in a Project execution snapshot is enriched with its current state for every applicable management label, while absent or corrupt lifecycle data remains explicit.
2. **"A, B, and C are represented as distinct defined outcomes."** — A、B 和 C 被表示为不同的定义结果。 — Entities with no applicable state machine, applicable machines with no initialized current state, and Projects with no lifecycle configuration are represented as distinct defined outcomes.
3. **"Never A or B in the read path."** — 在读路径中绝不 A 或 B。 — Never select an arbitrary row or rewrite history in the read path.

### 领域词汇
| English | 中文 |
|---|---|
| Enrichment | 充实 |
| Lifecycle state | 生命周期状态 |
| Management label | 管理标签 |
| State machine | 状态机 |
| Project State | 项目状态 |
| Orphan label | 孤立标签 |
| Anomaly | 异常 |
| Lookup | 查找 |
| Logical validation | 逻辑验证 |

---

## 4. 小练习

1. Each managed entity is enriched with its current state for every applicable management ______.
2. Query project_entity_states active rows using ended_at IS ______.
3. No applicable machine, machine-without-state, and normal current state produce documented ______ results.
4. Never select an arbitrary row or rewrite ______ in the read path.
5. Multiple-current-state anomalies are surfaced rather than silently ______.

<details>
<summary>点击查看答案</summary>

1. label
2. NULL
3. distinct
4. history
5. ignored
</details>
