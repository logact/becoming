# Issue #36: Task: Add label queries, lifecycle boundaries, and provenance

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Classify core entities with labels (#24)

---

## 1. Original English

Parent Feature: #24

## Outcome

Consumers can query active/historical classifications in both directions, and assignment changes are auditable without implying a lifecycle machine.

## Implementation plan

1. Expose queries for active labels on an entity, historical assignments on an entity, and active/historical entities carrying a label, with deterministic pagination/order.
2. Keep classification lookup separate from Workflow/Project machine resolution; return machine applicability only when explicit machine configuration exists.
3. Record label definition create/update/archive and assignment start/end through the shared provenance contract in the same transaction.
4. Add acceptance tests across classification-only and lifecycle-management label scenarios.

## Acceptance criteria

- [ ] Queries return active labels by entity and labeled entities by label.
- [ ] Historical mode includes ended assignments and archived definitions with temporal values.
- [ ] Assigning a label alone never creates or selects a state machine.
- [ ] Definition and assignment mutations emit structured provenance atomically.
- [ ] Current queries never silently include ended assignments.

## Tests

- Query tests for both directions, pagination/order, empty results, active-only, and historical modes.
- Integration tests proving classification-only labels have no machine side effects.
- Provenance transaction tests for assign and end, including failed-operation cases.

## Dependencies

- The two preceding Feature #24 tasks.
- Feature #30 shared provenance recorder.
- Features #25 and #27 define explicit Workflow/Project machine configuration.

## Out of scope

- Label-based authorization.
- A visual taxonomy browser.

---

## 2. 中文翻译

父特性：#24

## 预期成果

消费者可以双向查询活跃/历史分类，并且分配变更可审计，而不隐含生命周期机器。

## 实现计划

1. 暴露查询：实体上的活跃标签、实体上的历史分配、标签下的活跃/历史实体，并支持确定性的分页/排序。
2. 将分类查找与工作流/项目机器解析分离；仅在存在显式机器配置时才返回机器适用性。
3. 在同一事务中通过共享溯源契约记录标签定义创建/更新/归档以及分配开始/结束。
4. 在仅分类和生命周期管理标签场景下添加验收测试。

## 验收标准

- [ ] 查询按实体返回活跃标签，按标签返回被标注实体。
- [ ] 历史模式包含已结束分配和已归档定义及其时态值。
- [ ] 单独分配标签不会创建或选择状态机。
- [ ] 定义和分配变更都会原子地发出结构化溯源记录。
- [ ] 当前查询不会静默包含已结束分配。

## 测试

- 双向查询、分页/排序、空结果、仅活跃和历史模式的查询测试。
- 证明仅分类标签没有副作用的集成测试。
- 分配和结束的溯源事务测试，包括操作失败场景。

## 依赖

- 特性 #24 的前两个任务。
- 特性 #30 共享溯源记录器。
- 特性 #25 和 #27 定义显式的工作流/项目机器配置。

## 范围外

- 基于标签的授权。
- 可视化分类浏览器。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Features #25 and #27 define explicit Workflow/Project machine configuration. |
| archive | 归档 | Record label definition create/update/archive and assignment start/end through the shared provenance contract in the same transaction. |
| query | 查询 | Consumers can query active/historical classifications in both directions, and assignment changes are auditable without implying a lifecycle machine. |
| emit | 产生/发出 | Definition and assignment mutations emit structured provenance atomically. |
| record | 记录 | Record label definition create/update/archive and assignment start/end through the shared provenance contract in the same transaction. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| assign | 分配 | Provenance transaction tests for assign and end, including failed-operation cases. |
| end | 结束 | Record label definition create/update/archive and assignment start/end through the shared provenance contract in the same transaction. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |
| domain entities | 领域实体 | Workflows are first-class domain entities. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| State machine | 状态机 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |

---

## 4. 小练习

1. A reusable Workflow defines the _______ and allowed transitions for managed entities.
2. Every material mutation should emit structured _______ in the same transaction.
3. Lifecycle transitions must be committed _______ to keep history consistent.
4. Archiving a Workflow must not invalidate historical project _______.
5. Workflow discovery must return _______ results when multiple candidates match.

<details>
<summary>点击查看答案</summary>

1. state machine
2. provenance
3. atomically
4. execution
5. deterministic

</details>
