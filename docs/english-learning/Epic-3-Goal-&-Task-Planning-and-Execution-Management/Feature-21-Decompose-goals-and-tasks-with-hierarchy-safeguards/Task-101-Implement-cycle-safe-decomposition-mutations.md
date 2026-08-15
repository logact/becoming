# Issue #101: Task: Implement cycle-safe decomposition mutations

**Labels:** task  
**State:** CLOSED  
**Parent:** #21: Feature: Decompose goals and tasks with hierarchy safeguards

---

## 1. Original English

Parent Feature: #21 — Feature: Decompose goals and tasks with hierarchy safeguards

## Outcome

Goal and Task hierarchy edges can be safely created and ended inside a Project only after workflow, membership, and cycle validation, with atomic provenance and preserved historical structure.

## Implementation plan

1. Implement create-decomposition using the Project-scoped policy and resolve applicable decomposition Workflow guidance before mutation; expose the resolved guidance/version in the operation result or audit context.
2. Add cycle preflight that evaluates the candidate edge against the active Project hierarchy, rejects any path back to the proposed parent, and uses visited-node and depth/node bounds to terminate on malformed stored graphs.
3. Revalidate active duplicates, membership/context, and cycle assumptions inside the write unit of work so concurrent creates cannot establish a cycle or disallowed active edge.
4. Implement end-decomposition by setting `ended_at`, never deleting endpoints or the relation row, and emit structured create/end provenance with Project, typed endpoints, relation, actor, time, and workflow context atomically.

## Acceptance criteria

- [ ] Valid Goal→Goal, Goal→Task, and Task→Task edges can be created inside their shared Project context.
- [ ] Missing/ambiguous/incompatible Workflow guidance, missing endpoints, invalid membership, self-links, active duplicates, and policy violations persist nothing.
- [ ] A candidate edge that would form a direct or indirect active cycle is rejected before commit.
- [ ] Cycle validation terminates deterministically even when existing data already contains a cycle or exceeds configured traversal bounds, and surfaces an integrity error.
- [ ] Concurrency cannot commit a cycle or disallowed duplicate active edge under the documented consistency contract.
- [ ] Ending an edge sets `ended_at` and preserves historical structure and both endpoints; create/end mutations emit atomic structured provenance.

## Tests

- Command tests for valid edges, each validation failure, workflow guidance resolution, and cycle preflight.
- Cycle tests for direct, indirect, concurrent, and malformed stored cycles with bounds.
- Concurrency tests proving no committed cycles or duplicate active edges.
- Provenance payload tests including workflow context and Project/endpoints.

## Dependencies

- Parent Feature: #21.
- Depends on Task: Define project-scoped decomposition policies.
- Depends on #19 relation create/end and #5/#30 provenance conventions.

---

## 2. 中文翻译

父级 Feature：#21 —— 在层级保护下分解目标与任务

## 结果

Goal 和 Task 的层级边只有在工作流、成员关系和循环验证之后，才能在 Project 内安全地创建和结束，并具有原子化来源追溯和保留的历史结构。

## 实施计划

1. 使用项目范围策略实现创建分解，并在变更前解析适用的分解工作流指导；在操作结果或审计上下文中公开已解析的指导/版本。
2. 添加循环预检，根据活动项目层级评估候选边，拒绝任何返回到提议父级的路径，并使用访问节点和深度/节点边界在格式错误的存储图上终止。
3. 在写入工作单元内重新验证活动重复项、成员关系/上下文和循环假设，使并发创建无法建立循环或不允许的活动边。
4. 通过设置 `ended_at` 实现结束分解，绝不删除端点或关系行，并原子化地发出包含 Project、带类型端点、关系、执行者、时间和工作流上下文的结构化创建/结束来源追溯。

## 验收标准

- [ ] 可以在共享项目上下文内创建有效的 Goal→Goal、Goal→Task 和 Task→Task 边。
- [ ] 缺失/模糊/不兼容的工作流指导、缺失端点、无效成员关系、自链接、活动重复项和策略违反不会持久化任何内容。
- [ ] 会在提交前拒绝会形成直接或间接活动循环的候选边。
- [ ] 即使现有数据已包含循环或超出配置的遍历边界，循环验证也会确定性终止，并呈现完整性错误。
- [ ] 在文档化的一致性约定下，并发不能提交循环或不允许的重复活动边。
- [ ] 结束边会设置 `ended_at` 并保留历史结构和两个端点；创建/结束变更会发出原子化结构化来源追溯。

## 测试

- 针对有效边、每种验证失败、工作流指导解析和循环预检的命令测试。
- 针对直接、间接、并发和带边界格式错误存储循环的循环测试。
- 证明没有提交循环或重复活动边的并发测试。
- 包含工作流上下文和项目/端点的来源追溯负载测试。

## 依赖

- 父级 Feature：#21。
- 依赖任务：定义项目范围分解策略。
- 依赖 #19 关系创建/结束和 #5/#30 来源追溯约定。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| create | 创建 | hierarchy edges can be safely created |
| end | 结束 | safely created and ended inside a Project |
| evaluate | 评估 | evaluates the candidate edge against the active Project hierarchy |
| reject | 拒绝 | rejects any path back to the proposed parent |
| terminate | 终止 | terminate on malformed stored graphs |
| revalidate | 重新验证 | Revalidate active duplicates inside the write unit |
| commit | 提交 | Concurrency cannot commit a cycle |
| emit | 发出 | emit structured create/end provenance |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| cycle-safe | 防循环的 | cycle-safe decomposition mutations |
| cycle preflight | 循环预检 | Add cycle preflight |
| candidate edge | 候选边 | evaluates the candidate edge |
| active Project hierarchy | 活动项目层级 | active Project hierarchy |
| visited-node set | 访问节点集合 | uses visited-node and depth/node bounds |
| traversal bounds | 遍历边界 | exceeds configured traversal bounds |
| consistency contract | 一致性约定 | documented consistency contract |
| malformed stored graph | 格式错误的存储图 | malformed stored graphs |

### 值得模仿的句式
1. **"A can be safely created and ended only after B, with C and D."** — 只有在 B 之后，才能安全地创建和结束 A，并带有 C 和 D。 — Goal and Task hierarchy edges can be safely created and ended inside a Project only after workflow, membership, and cycle validation, with atomic provenance and preserved historical structure.
2. **"A terminates deterministically even when B or exceeds C."** — 即使 B 或超过 C，A 也会确定性终止。 — Cycle validation terminates deterministically even when existing data already contains a cycle or exceeds configured traversal bounds.
3. **"Concurrency cannot commit A or B under C."** — 在 C 下，并发不能提交 A 或 B。 — Concurrency cannot commit a cycle or disallowed duplicate active edge under the documented consistency contract.

### 领域词汇
| English | 中文 |
|---|---|
| Decomposition | 分解 |
| Cycle | 循环 |
| Preflight | 预检 |
| Candidate edge | 候选边 |
| Traversal bounds | 遍历边界 |
| Consistency contract | 一致性约定 |
| Atomic provenance | 原子化来源追溯 |
| Integrity error | 完整性错误 |
| Workflow context | 工作流上下文 |

---

## 4. 小练习

1. Goal and Task hierarchy edges can be safely created and ended after workflow, membership, and ______ validation.
2. Cycle preflight evaluates the candidate edge against the active Project ______.
3. A candidate edge that would form a direct or indirect active cycle is rejected before ______.
4. Concurrency cannot commit a cycle or disallowed duplicate active edge under the documented ______ contract.
5. Ending an edge sets ______ and preserves historical structure.

<details>
<summary>点击查看答案</summary>

1. cycle
2. hierarchy
3. commit
4. consistency
5. ended_at
</details>
