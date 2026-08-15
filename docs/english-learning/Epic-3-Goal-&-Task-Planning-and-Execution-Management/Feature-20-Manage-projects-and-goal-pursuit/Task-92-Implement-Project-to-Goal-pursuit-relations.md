# Issue #92: Task: Implement Project-to-Goal pursuit relations

**Labels:** task  
**State:** CLOSED  
**Parent:** #20: Feature: Manage projects and goal pursuit

---

## 1. Original English

Parent Feature: #20 — Feature: Manage projects and goal pursuit

## Outcome

Projects pursue Goals through explicit, directed, time-bounded semantic relations with validated many-to-many membership and preserved change history.

## Implementation plan

1. Define the canonical directed relation policy for Project-to-Goal pursuit, including relation type, endpoint direction, allowed many-to-many cardinality, and active-duplicate identity.
2. Implement start-pursuit by resolving the Project and Goal through typed domain ports, checking archive/current eligibility policy, and creating the relation outside both entity tables.
3. Implement end-pursuit by setting relation `ended_at` instead of deleting either endpoint or relation history; define repeated-end behavior.
4. Emit structured relationship provenance containing both endpoints, type, actor, time, and relevant metadata in the same unit of work.

## Acceptance criteria

- [ ] One Goal may be actively pursued through multiple Projects and one Project may actively pursue multiple Goals.
- [ ] Missing, mistyped, archived-ineligible, reversed, or otherwise invalid endpoints are rejected by application/domain validation.
- [ ] A duplicate active pursuit between the same Project and Goal is rejected while ended history does not prevent a later new pursuit.
- [ ] Ending pursuit preserves both entities and the relation row with its original direction and metadata.
- [ ] Goal pursuit is stored only in `relations`; no database foreign keys or Project/Goal membership columns are added.
- [ ] Start/end relationship changes emit atomic structured provenance.

## Tests

- Policy/command tests for many-to-many pursuit, direction, missing endpoints, duplicates, and archive eligibility.
- Tests for ending, repeated ending, and re-establishing pursuit after an ended relation.
- Transaction/provenance payload tests and concurrency tests for competing duplicate starts.
- Schema guards proving no membership columns in `projects` or `goals`.

## Dependencies

- Parent Feature: #20.
- Depends on Task: Implement Project domain, persistence, and mutations.
- Depends on Task: Implement Goal mutation commands with provenance.
- Depends on #19 relation operations and #5 relationship-change provenance.

---

## 2. 中文翻译

父级 Feature：#20 —— 管理项目与目标追求

## 结果

Project 通过显式、定向、有时间边界的语义关系追求 Goal，具有经过验证的多对多成员关系，并保留变更历史。

## 实施计划

1. 定义 Project-to-Goal 追求关系的规范定向策略，包括关系类型、端点方向、允许多对多基数和活动重复标识。
2. 通过带类型的领域端口解析 Project 和 Goal，检查归档/当前资格策略，并在两个实体表之外创建关系，实现开始追求。
3. 通过设置关系 `ended_at`（而不是删除任一端点或关系历史）实现结束追求；定义重复结束行为。
4. 在同一工作单元中发出包含两个端点、类型、执行者、时间和相关元数据的结构化关系来源追溯。

## 验收标准

- [ ] 一个 Goal 可以通过多个 Project 被积极追求，一个 Project 也可以积极追求多个 Goal。
- [ ] 缺失、类型错误、不符合归档资格、反向或以其他方式无效的端点会被应用/领域验证拒绝。
- [ ] 拒绝同一 Project 和 Goal 之间的重复活动追求，但已结束的历史不会阻止以后的新追求。
- [ ] 结束追求会保留两个实体以及具有原始方向和元数据的关系行。
- [ ] Goal 追求仅存储在 `relations` 中；不添加数据库外键或 Project/Goal 成员关系列。
- [ ] 开始/结束关系变更会发出原子化结构化来源追溯。

## 测试

- 针对多对多追求、方向、缺失端点、重复项和归档资格的策略/命令测试。
- 针对结束、重复结束和关系结束后重新建立追求的测试。
- 事务/来源追溯负载测试以及针对竞争重复开始的并发测试。
- 证明 `projects` 或 `goals` 中没有成员关系列的模式防护测试。

## 依赖

- 父级 Feature：#20。
- 依赖任务：实现 Project 领域、持久化和变更。
- 依赖任务：使用来源追溯实现 Goal 变更命令。
- 依赖 #19 关系操作和 #5 关系变更来源追溯。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| pursue | 追求 | Projects pursue Goals |
| resolve | 解析 | resolving the Project and Goal through typed domain ports |
| reject | 拒绝 | invalid endpoints are rejected |
| prevent | 阻止 | ended history does not prevent a later new pursuit |
| preserve | 保留 | Ending pursuit preserves both entities |
| emit | 发出 | emit atomic structured provenance |
| compete | 竞争 | competing duplicate starts |
| re-establish | 重新建立 | re-establishing pursuit after an ended relation |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| many-to-many membership | 多对多成员关系 | validated many-to-many membership |
| active-duplicate identity | 活动重复标识 | active-duplicate identity |
| archive eligibility | 归档资格 | archive/current eligibility policy |
| ended history | 已结束历史 | ended history does not prevent a later new pursuit |
| original direction | 原始方向 | with its original direction and metadata |
| membership columns | 成员关系列 | no membership columns in projects or goals |
| duplicate starts | 重复开始 | competing duplicate starts |
| relationship-change provenance | 关系变更来源追溯 | relationship-change provenance |

### 值得模仿的句式
1. **"A pursue B through C with D and preserved E."** — A 通过 C 追求 B，并带有 D 和保留的 E。 — Projects pursue Goals through explicit, directed, time-bounded semantic relations with validated many-to-many membership and preserved change history.
2. **"A is rejected while B does not prevent C."** — A 被拒绝，而 B 不会阻止 C。 — A duplicate active pursuit between the same Project and Goal is rejected while ended history does not prevent a later new pursuit.
3. **"A is stored only in B; no C or D are added."** — A 仅存储在 B 中；不添加 C 或 D。 — Goal pursuit is stored only in relations; no database foreign keys or Project/Goal membership columns are added.

### 领域词汇
| English | 中文 |
|---|---|
| Pursuit | 追求 |
| Many-to-many | 多对多 |
| Cardinality | 基数 |
| Active duplicate | 活动重复 |
| Eligibility | 资格 |
| Provenance | 来源追溯 |
| Concurrency | 并发 |
| Relation policy | 关系策略 |
| Endpoint | 端点 |

---

## 4. 小练习

1. Projects pursue Goals through explicit, directed, ______-bounded semantic relations.
2. One Goal may be actively pursued through multiple ______.
3. A duplicate active pursuit is rejected while ______ history does not prevent a later new pursuit.
4. Goal pursuit is stored only in ______.
5. Start/end relationship changes emit ______ structured provenance.

<details>
<summary>点击查看答案</summary>

1. time
2. Projects
3. ended
4. relations
5. atomic
</details>
