# Issue #95: Task: Implement Task-to-Project membership relations

**Labels:** task  
**State:** CLOSED  
**Parent:** #18: Feature: Manage tasks and project membership

---

## 1. Original English

Parent Feature: #18 — Feature: Manage tasks and project membership

## Outcome

Tasks join and leave Project contexts through explicit semantic relations with logical endpoint validation, active-duplicate safeguards, and preserved relationship provenance.

## Implementation plan

1. Define the canonical directed Task-to-Project membership relation policy, including endpoint direction, active-duplicate identity, allowed cardinality, and metadata contract.
2. Implement add-membership by resolving the typed Task and Project, applying archive/current eligibility rules, and creating the relation outside `tasks` and `projects`.
3. Implement end-membership by setting `ended_at`; preserve both endpoints and the original relationship and define repeated-end behavior.
4. Integrate membership creation/ending with relationship provenance and a shared transaction boundary, and protect against concurrent duplicate-active creation.

## Acceptance criteria

- [ ] Task–Project membership is represented only as a semantic relation, not a Task or Project column.
- [ ] Missing, mistyped, reversed, archive-ineligible, or policy-invalid endpoints are rejected by application/domain validation.
- [ ] Duplicate active membership for the same Task and Project is rejected; allowed multi-Project contexts follow the explicit cardinality policy.
- [ ] Ending membership sets `ended_at` without deleting the Task, Project, or relation history.
- [ ] Important membership changes emit structured provenance containing both endpoints, relation type, actor, and time.
- [ ] Concurrency cannot leave a disallowed duplicate active membership, without relying on database foreign keys.

## Tests

- Policy/command tests for valid membership, endpoint direction, missing/archived endpoints, cardinality, and duplicates.
- Tests for ending, repeated ending, and rejoining after an ended relation.
- Concurrency and transaction rollback tests, including provenance failures.
- Schema guards proving no membership columns in `tasks` or `projects`.

## Dependencies

- Parent Feature: #18.
- Depends on Task: Implement Task domain, persistence, and mutations.
- Depends on Task: Implement Project domain, persistence, and mutations from #20.
- Depends on #19 relation policy and #5 relationship-change provenance.

---

## 2. 中文翻译

父级 Feature：#18 —— 管理任务与项目成员关系

## 结果

Task 通过显式的语义关系加入和离开 Project 上下文，具备逻辑端点验证、活动重复防护措施，并保留关系来源追溯。

## 实施计划

1. 定义规范的定向 Task-to-Project 成员关系策略，包括端点方向、活动重复标识、允许的基数和元数据约定。
2. 通过解析带类型的 Task 和 Project、应用归档/当前资格规则，并在 `tasks` 和 `projects` 之外创建关系来实现添加成员关系。
3. 通过设置 `ended_at` 实现结束成员关系；保留两个端点和原始关系，并定义重复结束行为。
4. 将成员关系的创建/结束与关系来源追溯和共享事务边界集成，并防止并发重复活动创建。

## 验收标准

- [ ] Task–Project 成员关系仅作为语义关系表示，而不是 Task 或 Project 的列。
- [ ] 缺失、类型错误、反向、不符合归档资格或策略无效的端点会被应用/领域验证拒绝。
- [ ] 拒绝同一 Task 和 Project 的重复活动成员关系；允许的多项目上下文遵循明确的基数策略。
- [ ] 结束成员关系设置 `ended_at`，而不删除 Task、Project 或关系历史。
- [ ] 重要的成员关系变更会发出包含两个端点、关系类型、执行者和时间的结构化来源追溯。
- [ ] 并发不能留下不允许的重复活动成员关系，且不依赖数据库外键。

## 测试

- 针对有效成员关系、端点方向、缺失/已归档端点、基数和重复项的策略/命令测试。
- 针对结束、重复结束和关系结束后重新加入的测试。
- 并发和事务回滚测试，包括来源追溯失败。
- 证明 `tasks` 或 `projects` 中没有成员关系列的模式防护测试。

## 依赖

- 父级 Feature：#18。
- 依赖任务：实现 Task 领域、持久化和变更。
- 依赖任务：实现 Project 领域、持久化和变更（来自 #20）。
- 依赖 #19 关系策略和 #5 关系变更来源追溯。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| join | 加入 | Tasks join Project contexts |
| leave | 离开 | Tasks leave Project contexts |
| resolve | 解析 | resolving the typed Task and Project |
| reject | 拒绝 | endpoints are rejected by application/domain validation |
| preserve | 保留 | preserve both endpoints and the original relationship |
| protect | 保护 | protect against concurrent duplicate-active creation |
| emit | 发出 | membership changes emit structured provenance |
| integrate | 集成 | Integrate membership creation/ending with relationship provenance |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| semantic relation | 语义关系 | explicit semantic relations |
| endpoint validation | 端点验证 | logical endpoint validation |
| active-duplicate safeguard | 活动重复防护 | active-duplicate safeguards |
| cardinality policy | 基数策略 | allowed cardinality |
| archive eligibility | 归档资格 | archive/current eligibility rules |
| relation history | 关系历史 | relation history |
| transaction boundary | 事务边界 | shared transaction boundary |
| concurrent duplicate | 并发重复 | concurrent duplicate-active creation |

### 值得模仿的句式
1. **"A join and leave B through C with D and E."** — A 通过 C 加入和离开 B，并具备 D 和 E。 — Tasks join and leave Project contexts through explicit semantic relations with logical endpoint validation, active-duplicate safeguards, and preserved relationship provenance.
2. **"A is represented only as B, not a C or D column."** — A 仅作为 B 表示，而不是 C 或 D 的列。 — Task–Project membership is represented only as a semantic relation, not a Task or Project column.
3. **"Concurrency cannot leave A, without relying on B."** — 并发不能留下 A，且不依赖 B。 — Concurrency cannot leave a disallowed duplicate active membership, without relying on database foreign keys.

### 领域词汇
| English | 中文 |
|---|---|
| Membership | 成员关系 |
| Semantic relation | 语义关系 |
| Endpoint | 端点 |
| Cardinality | 基数 |
| Metadata | 元数据 |
| Eligibility | 资格 |
| Concurrency | 并发 |
| Provenance | 来源追溯 |
| Transaction boundary | 事务边界 |

---

## 4. 小练习

1. Tasks join and leave Project contexts through explicit ______ relations.
2. Task–Project membership is represented only as a semantic relation, not a Task or Project ______.
3. Ending membership sets ______ without deleting the Task or Project.
4. Concurrency cannot leave a disallowed duplicate active membership without relying on database foreign ______.
5. Define the canonical directed Task-to-Project membership ______ policy.

<details>
<summary>点击查看答案</summary>

1. semantic
2. column
3. ended_at
4. keys
5. relation
</details>
