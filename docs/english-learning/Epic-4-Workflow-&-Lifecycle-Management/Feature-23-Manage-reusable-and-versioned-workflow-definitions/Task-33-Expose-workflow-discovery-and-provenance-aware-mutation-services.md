# Issue #33: Task: Expose workflow discovery and provenance-aware mutation services

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Manage reusable and versioned workflow definitions (#23)

---

## 1. Original English

Parent Feature: #23

## Outcome

Consumers can discover active Workflow definitions by purpose, type, and version, while every important Workflow mutation is recorded consistently.

## Implementation plan

1. Add query services for active definitions by workflow type, purpose, exact/latest version, plus explicit historical lookups that can include archived versions.
2. Define deterministic ordering and ambiguity behavior when multiple candidates match a discovery request.
3. Integrate create, update, archive, and publish-version commands with the shared provenance recorder in the same transaction, limiting before/after payloads to relevant non-sensitive fields.
4. Add end-to-end application tests covering the supported workflow-type matrix and mutation history.

## Acceptance criteria

- [ ] Consumers can query active Workflows by type and version with deterministic results.
- [ ] Historical queries can resolve archived versions without making them eligible for new application.
- [ ] Ambiguous or missing discovery returns an explicit result rather than selecting arbitrarily.
- [ ] Create, material update, archive, and version publication each emit structured provenance atomically.
- [ ] Failed mutations leave neither a changed Workflow nor a successful provenance Record.

## Tests

- Query contract tests for exact/latest version, purpose, active-only, archived-inclusive, empty, and ambiguous results.
- Integration tests for provenance payloads and transaction rollback in both mutation-failure directions.
- Acceptance test covering each workflow type required by Feature #23.

## Dependencies

- The two preceding Feature #23 tasks.
- Feature #30 provenance recording.
- Feature #10 timeline querying consumes, but does not block, these writes.

## Out of scope

- Workflow application/resolution inside a Project (Feature #27).
- A user interface or workflow editor.

---

## 2. 中文翻译

父特性：#23

## 预期成果

消费者可以按用途、类型和版本发现活跃的工作流定义，同时每项重要的工作流变更都会被一致地记录。

## 实现计划

1. 添加按工作流类型、用途、精确版本/最新版本查询活跃定义的查询服务，以及可包含已归档版本的显式历史查询。
2. 定义当多个候选匹配发现请求时的确定性排序和歧义处理行为。
3. 将创建、更新、归档和发布版本命令与同一事务中的共享溯源记录器集成，将变更前/后的载荷限制在相关非敏感字段内。
4. 添加端到端应用测试，覆盖受支持的工作流类型矩阵和变更历史。

## 验收标准

- [ ] 消费者可以按类型和版本查询活跃工作流，并获得确定性结果。
- [ ] 历史查询可以解析已归档版本，但不会使其有资格被新应用使用。
- [ ] 模糊或缺失的发现请求会返回显式结果，而不是任意选择。
- [ ] 创建、实质性更新、归档和版本发布都会原子地发出结构化溯源记录。
- [ ] 失败的变更既不会改变工作流，也不会产生成功的溯源记录。

## 测试

- 精确版本/最新版本、用途、仅活跃、包含归档、空结果和歧义结果的查询契约测试。
- 针对溯源载荷和双向变更失败事务回滚的集成测试。
- 覆盖特性 #23 要求的每种工作流类型的验收测试。

## 依赖

- 特性 #23 的前两个任务。
- 特性 #30 溯源记录。
- 特性 #10 时间线查询消费这些写入，但不阻塞它们。

## 范围外

- 在项目内部应用/解析工作流（特性 #27）。
- 用户界面或工作流编辑器。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define deterministic ordering and ambiguity behavior when multiple candidates match a discovery request. |
| archive | 归档 | Integrate create, update, archive, and publish-version commands with the shared provenance recorder in the same transaction, limiting before/after payloads to relevant non-sensi... |
| query | 查询 | Add query services for active definitions by workflow type, purpose, exact/latest version, plus explicit historical lookups that can include archived versions. |
| emit | 产生/发出 | Create, material update, archive, and version publication each emit structured provenance atomically. |
| integrate | 集成 | Integrate create, update, archive, and publish-version commands with the shared provenance recorder in the same transaction, limiting before/after payloads to relevant non-sensi... |
| record | 记录 | Failed mutations leave neither a changed Workflow nor a successful provenance Record. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| end | 结束 | Add end-to-end application tests covering the supported workflow-type matrix and mutation history. |

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
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Lifecycle | 生命周期 |
| State machine | 状态机 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Archiving a Workflow must not invalidate historical project _______.
4. Workflow discovery must return _______ results when multiple candidates match.
5. Consumers can _______ active Workflows by type and version.

<details>
<summary>点击查看答案</summary>

1. provenance
2. atomically
3. execution
4. deterministic
5. query

</details>
