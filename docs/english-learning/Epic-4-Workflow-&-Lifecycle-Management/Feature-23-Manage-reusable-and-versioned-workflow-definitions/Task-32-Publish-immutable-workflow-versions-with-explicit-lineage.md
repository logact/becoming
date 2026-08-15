# Issue #32: Task: Publish immutable workflow versions with explicit lineage

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Manage reusable and versioned workflow definitions (#23)

---

## 1. Original English

Parent Feature: #23

## Outcome

Users can publish a distinguishable Workflow version whose predecessor remains unchanged and whose lineage is inspectable.

## Implementation plan

1. Define a version-family and predecessor/successor policy using semantic Workflow-to-Workflow relations rather than adding a live workflow pointer to consumer tables.
2. Implement a publish-version command that loads an active source definition, validates the requested next positive version, creates the successor, and records its lineage atomically.
3. Reject duplicate or non-monotonic versions within a lineage and define safe concurrency behavior for simultaneous publication attempts.
4. Ensure later edits or archival of either version never rewrite the other definition or historical Project execution.

## Acceptance criteria

- [ ] Publishing creates a new Workflow ID and retains the earlier row byte-for-byte.
- [ ] The new definition has an explicit, traversable lineage relation to its predecessor.
- [ ] Duplicate/non-monotonic publication attempts return domain conflicts without partial rows or relations.
- [ ] Archiving a Workflow does not invalidate its lineage or historical project references.
- [ ] Concurrent publication cannot create two accepted successors for the same requested version.

## Tests

- Unit tests for version sequencing, copy/override behavior, and archived-source rejection.
- Transactional integration tests proving rollback of partial Workflow/lineage writes.
- Concurrency test for competing publish operations and regression test that the predecessor is unchanged.

## Dependencies

- `Task: Establish the workflow domain model and persistence boundary`.
- Feature #19 provides validated semantic relations.
- Feature #30 provides atomic mutation provenance.

## Out of scope

- Automatic migration of Project machines to a new version.
- Branching/merging workflow definitions beyond the documented V1 policy.

---

## 2. 中文翻译

父特性：#23

## 预期成果

用户可以发布一个可区分的工作流版本，其前驱版本保持不变，且血统关系可被检查。

## 实现计划

1. 使用工作流到工作流的语义关系来定义版本族和前驱/后继策略，而不是在消费者表中添加指向最新版本的实时指针。
2. 实现一个发布版本命令：加载活跃的源定义，验证请求的下一个正版本号，创建后继版本，并原子地记录其血统关系。
3. 拒绝同一条血统中的重复或非单调版本号，并定义并发发布尝试的安全行为。
4. 确保后续对任一版本的编辑或归档都不会改写另一个定义或历史项目执行记录。

## 验收标准

- [ ] 发布版本会创建新的工作流 ID，并逐字节保留之前的行数据。
- [ ] 新定义与其前驱之间存在显式、可遍历的血统关系。
- [ ] 重复/非单调的发布尝试会返回领域冲突，不会产生部分行或部分关系。
- [ ] 归档工作流不会使其血统或历史项目引用失效。
- [ ] 并发发布不会为同一请求版本创建两个被接受的后继。

## 测试

- 针对版本排序、复制/覆盖行为以及已归档源拒绝的单元测试。
- 事务集成测试，证明部分工作流/血统写入会回滚。
- 并发测试，验证竞争发布操作以及前驱保持不变的回归测试。

## 依赖

- 任务：建立工作流领域模型和持久化边界。
- 特性 #19 提供经过验证的语义关系。
- 特性 #30 提供原子变更溯源。

## 范围外

- 自动将项目机器迁移到新版本。
- 超出 V1 策略的分支/合并工作流定义。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define a version-family and predecessor/successor policy using semantic Workflow-to-Workflow relations rather than adding a live workflow pointer to consumer tables. |
| reject | 拒绝 | Reject duplicate or non-monotonic versions within a lineage and define safe concurrency behavior for simultaneous publication attempts. |
| copy | 复制 | Unit tests for version sequencing, copy/override behavior, and archived-source rejection. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement a publish-version command that loads an active source definition, validates the requested next positive version, creates the successor, and records its lineage atomica... |
| publish | 发布 | Users can publish a distinguishable Workflow version whose predecessor remains unchanged and whose lineage is inspectable. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| persistence boundary | 持久化边界 | Establish the workflow domain model and persistence boundary. |
| semantic relations | 语义关系 | Create and validate semantic relations. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Provenance | 溯源 |
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Lineage | 血统/谱系 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Concurrent requests require _______ controls to avoid duplicate active rows.
4. Archiving a Workflow must not invalidate historical project _______.
5. Publishing a new version records an explicit, traversable _______ to its predecessor.

<details>
<summary>点击查看答案</summary>

1. provenance
2. atomically
3. concurrency
4. execution
5. lineage

</details>
