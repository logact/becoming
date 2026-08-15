# Issue #42: Task: Add transition lifecycle services and provenance coverage

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define allowed workflow transitions and criteria (#26)

---

## 1. Original English

Parent Feature: #26

## Outcome

Transition templates can be managed and inspected over time with atomically recorded changes.

## Implementation plan

1. Implement create/update/archive application commands on top of topology validation, preserving historical transitions rather than deleting them.
2. Expose machine-level active/historical queries including source exit-criteria requirements and opaque condition/action values.
3. Integrate transition mutations with shared provenance and relevant before/after payloads in the same transaction.
4. Add acceptance tests that combine state archival, Workflow version history, and transition discovery.

## Acceptance criteria

- [ ] Create, update, archive, and query operations cover the full transition template lifecycle.
- [ ] Archiving never removes a transition from historical Workflow version views.
- [ ] Exit-criteria requirements are explicit and queryable.
- [ ] Each successful material mutation emits provenance atomically; failed commands emit none.
- [ ] Historical queries remain meaningful after endpoint or Workflow archival.

## Tests

- Application tests for lifecycle commands and active/historical queries.
- Transaction tests for provenance success/failure atomicity.
- Regression test for archived transitions in an earlier Workflow version.

## Dependencies

- The two preceding Feature #26 tasks.
- Feature #30 mutation provenance.
- Feature #10 historical timeline query behavior.

## Out of scope

- Runtime transition execution.
- A general-purpose rules engine.

---

## 2. 中文翻译

父特性：#26

## 预期成果

转换模板可以随时间被管理和检查，并且变更会被原子地记录。

## 实现计划

1. 在拓扑验证之上实现创建/更新/归档应用命令，保留历史转换而不是删除它们。
2. 暴露机器级活跃/历史查询，包括源退出条件要求和不透明的条件/动作值。
3. 将转换变更与共享溯源及相关的变更前/后载荷集成在同一事务中。
4. 添加结合状态归档、工作流版本历史和转换发现的验收测试。

## 验收标准

- [ ] 创建、更新、归档和查询操作覆盖完整的转换模板生命周期。
- [ ] 归档不会将转换从历史工作流版本视图中移除。
- [ ] 退出条件要求是显式的且可查询。
- [ ] 每次成功的实质性变更都会原子地发出溯源记录；失败命令不会发出。
- [ ] 端点或工作流归档后，历史查询仍然有意义。

## 测试

- 生命周期命令和活跃/历史查询的应用测试。
- 溯源成功/失败原子性的事务测试。
- 早期工作流版本中已归档转换的回归测试。

## 依赖

- 特性 #26 的前两个任务。
- 特性 #30 变更溯源。
- 特性 #10 历史时间线查询行为。

## 范围外

- 运行时转换执行。
- 通用规则引擎。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| archive | 归档 | Implement create/update/archive application commands on top of topology validation, preserving historical transitions rather than deleting them. |
| query | 查询 | Create, update, archive, and query operations cover the full transition template lifecycle. |
| emit | 产生/发出 | Each successful material mutation emits provenance atomically; failed commands emit none. |
| integrate | 集成 | Integrate transition mutations with shared provenance and relevant before/after payloads in the same transaction. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement create/update/archive application commands on top of topology validation, preserving historical transitions rather than deleting them. |
| add | 添加 | Add acceptance tests that combine state archival, Workflow version history, and transition discovery. |
| expose | 暴露 | Expose machine-level active/historical queries including source exit-criteria requirements and opaque condition/action values. |

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
| Transition | 转换/迁移 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Template | 模板 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Archiving a Workflow must not invalidate historical project _______.
4. Consumers can _______ active Workflows by type and version.
5. Mutations should _______ provenance recording in the same transaction.

<details>
<summary>点击查看答案</summary>

1. provenance
2. atomically
3. execution
4. query
5. integrate

</details>
