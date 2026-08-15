# Issue #55: Task: Commit lifecycle transitions atomically with concurrency controls

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Execute project-scoped lifecycle transitions (#29)

---

## 1. Original English

Parent Feature: #29

## Outcome

A valid transition closes the previous state period and opens exactly one new current period atomically, while queries expose a coherent current state and full history.

## Implementation plan

1. Implement the transition command around the validation engine and a transaction that rechecks/locks current state, ends it at one authoritative timestamp, and inserts the destination period.
2. Detect stale/concurrent requests and guarantee the active-row uniqueness invariant without losing the winning transition's history.
3. Expose current-state and complete-history queries with deterministic chronology and anomaly detection for legacy multiple-current rows or mismatched State identity.
4. Integrate the transaction boundary with the Record/audit port required by Features #6 and #9, without duplicating lifecycle payload policy in this feature.

## Acceptance criteria

- [ ] A successful transition ends one prior row and opens one destination row using an atomic operation.
- [ ] A failed or stale transition leaves current state unchanged.
- [ ] Concurrent transitions cannot create multiple current rows or silently overwrite history.
- [ ] Queries return current state and complete ordered history.
- [ ] Identity/multiple-current anomalies are surfaced rather than silently selected.
- [ ] The transaction boundary can atomically include the lifecycle audit Record defined by Feature #9.

## Tests

- Transactional integration tests for success and fault injection between close/open steps.
- Concurrency tests for competing transitions from the same current row.
- Query tests for normal history, empty state, mismatched State identity, and multiple-current anomalies.
- Cross-feature contract test proving audit failure rolls back state change and state failure emits no successful audit.

## Dependencies

- The two preceding Feature #29 tasks.
- Feature #6 Record primitive and Feature #9 transition audit integration.

## Out of scope

- Background workflow automation.
- Resource-triggered transitions.
- Condition/action language implementation.

---

## 2. 中文翻译

父特性：#29

## 预期成果

有效转换会关闭先前状态周期并原子地恰好开启一个新当前周期，同时查询暴露一致的当前状态和完整历史。

## 实现计划

1. 围绕验证引擎和事务实现转换命令，事务会重新检查/锁定当前状态，在一个权威时间戳结束它，并插入目标周期。
2. 检测陈旧/并发请求，并保证活跃行唯一性不变量，同时不丢失获胜转换的历史。
3. 暴露当前状态和完整历史查询，提供确定性时间顺序，并针对遗留的多当前行或不匹配状态身份进行异常检测。
4. 将事务边界与特性 #6 和 #9 要求的记录/审计端口集成，而无需在此特性中重复生命周期载荷策略。

## 验收标准

- [ ] 成功的转换使用原子操作结束一个前行并开启一个目标行。
- [ ] 失败或陈旧的转换保持当前状态不变。
- [ ] 并发转换不能创建多个当前行或静默覆盖历史。
- [ ] 查询返回当前状态和完整有序历史。
- [ ] 身份/多当前异常会被暴露，而不是被静默选择。
- [ ] 事务边界可以原子地包含特性 #9 定义的生命周期审计记录。

## 测试

- 成功以及关闭/开启步骤之间故障注入的事务集成测试。
- 来自同一当前行的竞争转换的并发测试。
- 正常历史、空状态、不匹配状态身份和多当前异常的查询测试。
- 跨特性契约测试，证明审计失败会回滚状态变更，状态失败不会发出成功的审计。

## 依赖

- 特性 #29 的前两个任务。
- 特性 #6 记录原语和特性 #9 转换审计集成。

## 范围外

- 后台工作流自动化。
- 资源触发的转换。
- 条件/动作语言实现。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| query | 查询 | Query tests for normal history, empty state, mismatched State identity, and multiple-current anomalies. |
| detect | 检测 | Detect stale/concurrent requests and guarantee the active-row uniqueness invariant without losing the winning transition's history. |
| integrate | 集成 | Integrate the transaction boundary with the Record/audit port required by Features #6 and #9, without duplicating lifecycle payload policy in this feature. |
| record | 记录 | Integrate the transaction boundary with the Record/audit port required by Features #6 and #9, without duplicating lifecycle payload policy in this feature. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement the transition command around the validation engine and a transaction that rechecks/locks current state, ends it at one authoritative timestamp, and inserts the destin... |
| expose | 暴露 | A valid transition closes the previous state period and opens exactly one new current period atomically, while queries expose a coherent current state and full history. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| current state | 当前状态 | A valid transition closes the previous state period and opens exactly one new current period atomically, while queries expose a coherent current state and full history. |
| state period | 状态周期 | A valid transition closes the previous state period and opens exactly one new current period atomically, while queries expose a coherent current state and full history. |
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
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Acceptance criteria | 验收标准 |
| Atomic operation | 原子操作 |
| Current state | 当前状态 |

---

## 4. 小练习

1. Lifecycle transitions must be committed _______ to keep history consistent.
2. Concurrent requests require _______ controls to avoid duplicate active rows.
3. Workflow discovery must return _______ results when multiple candidates match.
4. The system enforces a single _______ per project/entity/label context.
5. The _______ can atomically include the lifecycle audit Record.

<details>
<summary>点击查看答案</summary>

1. atomically
2. concurrency
3. deterministic
4. current state
5. transaction boundary

</details>
