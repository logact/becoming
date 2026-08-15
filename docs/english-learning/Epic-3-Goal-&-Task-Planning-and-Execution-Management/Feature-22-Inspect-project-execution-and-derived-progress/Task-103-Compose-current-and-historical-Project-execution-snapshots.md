# Issue #103: Task: Compose current and historical Project execution snapshots

**Labels:** task  
**State:** CLOSED  
**Parent:** #22: Feature: Inspect project execution and derived progress

---

## 1. Original English

Parent Feature: #22 — Feature: Inspect project execution and derived progress

## Outcome

A framework-neutral Project execution snapshot returns pursued Goals, active Tasks, and nested Goal/Task structure for current or historical scope while retaining structural integrity findings.

## Implementation plan

1. Define an execution-snapshot contract containing Project context, pursued Goal roots, typed hierarchy nodes/edges, active Task membership, relation validity context, and integrity findings.
2. Compose #20 pursuit, #18 Task membership, and #21 bounded hierarchy query ports without duplicating their relation or cycle rules.
3. Define current scope to exclude archived entities and ended relations by default, and historical/as-of scope to include them when requested with explicit validity timestamps.
4. Reconcile overlapping roots/memberships deterministically and surface missing endpoints, cross-project edges, cycles, duplicates, and traversal truncation rather than silently dropping them.

## Acceptance criteria

- [ ] A Project execution query returns its relevant pursued Goals, nested Goal/Task hierarchy, and active Tasks in one coherent projection.
- [ ] Current scope excludes ended relations and follows a documented archived-entity policy.
- [ ] Historical/as-of scope can include archived entities and ended pursuit, membership, and decomposition edges.
- [ ] Empty Projects return a defined empty snapshot rather than an error or undefined value.
- [ ] Invalid hierarchy, missing endpoints, duplicate membership/edges, cycles, and traversal truncation are present as structured integrity findings.
- [ ] Results and anomaly ordering are deterministic, and no derived structure is written to intrinsic Project fields.

## Tests

- Snapshot tests for empty, flat, nested, multi-Goal, shared-node/diamond, and disconnected active-Task Projects.
- Current versus historical/as-of tests across archived endpoints and ended/re-established relations.
- Integrity-finding tests for cycles, cross-project edges, missing endpoints, duplicates, and bound truncation.
- Determinism tests for output ordering with shuffled inputs.

## Dependencies

- Parent Feature: #22.
- Depends on #20 pursuit queries, #18 Task membership queries, and #21 hierarchy queries.

---

## 2. 中文翻译

父级 Feature：#22 —— 检查项目执行和派生进度

## 结果

一个与框架无关的项目执行快照返回当前或历史范围内的追求目标、活动任务和嵌套目标/任务结构，同时保留结构性完整性发现。

## 实施计划

1. 定义执行快照约定，包含项目上下文、追求目标根节点、带类型的层级节点/边、活动任务成员关系、关系有效性上下文和完整性发现。
2. 组合 #20 追求、#18 任务成员关系和 #21 有界层级查询端口，而不重复它们的关系或循环规则。
3. 定义当前范围默认排除已归档实体和已结束关系；历史/截至范围在请求时包含它们，并带有明确的有效时间戳。
4. 确定性协调重叠的根/成员关系，并呈现缺失端点、跨项目边、循环、重复项和遍历截断，而不是默默丢弃它们。

## 验收标准

- [ ] 项目执行查询在一个连贯投影中返回其相关的追求目标、嵌套目标/任务层级和活动任务。
- [ ] 当前范围排除已结束关系，并遵循文档化的归档实体策略。
- [ ] 历史/截至范围可以包含已归档实体以及已结束的追求、成员关系和分解边。
- [ ] 空项目返回定义的空快照，而不是错误或 undefined 值。
- [ ] 无效层级、缺失端点、重复成员关系/边、循环和遍历截断作为结构化完整性发现存在。
- [ ] 结果和异常排序是确定性的，且不会将派生结构写入项目内在字段。

## 测试

- 针对空、扁平、嵌套、多目标、共享节点/菱形和断开的活动任务项目的快照测试。
- 跨已归档端点以及已结束/重新建立关系的当前与历史/截至测试。
- 针对循环、跨项目边、缺失端点、重复项和边界截断的完整性发现测试。
- 使用打乱输入对输出排序进行确定性测试。

## 依赖

- 父级 Feature：#22。
- 依赖 #20 追求查询、#18 任务成员关系查询和 #21 层级查询。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| compose | 组合 | Compose #20 pursuit, #18 Task membership |
| reconcile | 协调 | Reconcile overlapping roots/memberships |
| surface | 呈现 | surface missing endpoints |
| duplicate | 重复 | without duplicating their relation rules |
| exclude | 排除 | Current scope excludes ended relations |
| include | 包含 | Historical scope can include archived entities |
| retain | 保留 | retaining structural integrity findings |
| write | 写入 | no derived structure is written to intrinsic fields |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| execution snapshot | 执行快照 | Project execution snapshot |
| structural integrity | 结构性完整性 | structural integrity findings |
| pursued Goal roots | 追求目标根节点 | pursued Goal roots |
| relation validity | 关系有效性 | relation validity context |
| archived-entity policy | 归档实体策略 | documented archived-entity policy |
| empty snapshot | 空快照 | defined empty snapshot |
| traversal truncation | 遍历截断 | traversal truncation |
| shared-node/diamond | 共享节点/菱形 | shared-node/diamond Projects |

### 值得模仿的句式
1. **"A returns B, C, and D for E or F scope while retaining G."** — A 返回 E 或 F 范围内的 B、C 和 D，同时保留 G。 — A framework-neutral Project execution snapshot returns pursued Goals, active Tasks, and nested Goal/Task structure for current or historical scope while retaining structural integrity findings.
2. **"A are present as B rather than silently C."** — A 作为 B 存在，而不是被默默 C。 — Invalid hierarchy, missing endpoints, duplicate membership/edges, cycles, and traversal truncation are present as structured integrity findings rather than silently dropping them.
3. **"A and B are deterministic, and no C is written to D."** — A 和 B 是确定性的，且没有 C 被写入 D。 — Results and anomaly ordering are deterministic, and no derived structure is written to intrinsic Project fields.

### 领域词汇
| English | 中文 |
|---|---|
| Snapshot | 快照 |
| Projection | 投影 |
| Integrity finding | 完整性发现 |
| Pursued Goal | 追求目标 |
| Nested hierarchy | 嵌套层级 |
| Validity context | 有效性上下文 |
| Traversal truncation | 遍历截断 |
| Shared node | 共享节点 |
| Deterministic ordering | 确定性排序 |

---

## 4. 小练习

1. A Project execution snapshot returns pursued Goals, active Tasks, and nested Goal/Task ______.
2. Compose pursuit, Task membership, and bounded hierarchy query ports without ______ their rules.
3. Empty Projects return a defined empty ______ rather than an error.
4. Invalid hierarchy and cycles are present as structured integrity ______.
5. Results and anomaly ordering are ______.

<details>
<summary>点击查看答案</summary>

1. structure
2. duplicating
3. snapshot
4. findings
5. deterministic
</details>
