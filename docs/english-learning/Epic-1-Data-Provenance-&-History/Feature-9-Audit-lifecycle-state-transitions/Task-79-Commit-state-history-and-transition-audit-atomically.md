# Issue #79: Task: Commit state history and transition audit atomically

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Audit lifecycle state transitions (#9)

---

## 1. Original English

Parent Feature: #9 — Feature: Audit lifecycle state transitions

## Outcome

A successful lifecycle move closes one active state period, opens one new period, and appends exactly one matching audit Record atomically; rejected or failed moves change nothing.

## Implementation plan

1. Integrate audit payload construction after Feature #29 resolves the current state, matching project transition, conditions, and required exit criteria.
2. Within one unit of work, set the current `project_entity_states.ended_at`, insert the destination state-history row, and append the `state_transition` Record using the same transition time and actor.
3. Preserve Feature #29's concurrency control so competing transitions cannot create multiple current rows or duplicate success audits.
4. Return validation/condition/concurrency/audit failures through explicit application/domain errors and roll back every staged change.
5. Keep the audit row append-oriented and separate from reusable Workflow State and project-machine definitions.

## Acceptance criteria

- [ ] Every successful transition closes exactly one prior state-history row, opens exactly one new row, and creates exactly one audit Record.
- [ ] Rejected transitions create no successful transition Record and do not change the current state.
- [ ] State-history and audit writes commit or roll back together.
- [ ] The history rows and payload agree on project, entity, label, from-state, to-state, actor, and time.
- [ ] Concurrent requests cannot create multiple active current-state rows or duplicate successful audit Records.
- [ ] Existing audit Records are never rewritten when Workflow or Project State definitions change.

## Tests

- Integration-test initialization/transition paths as appropriate, successful transitions, and exact before/after history plus payload values.
- Test missing transitions, failed conditions, failed required exit criteria, mismatched state-machine references, and unknown entities with no writes.
- Inject close-row, insert-row, and Record-write failures and assert full rollback.
- Run concurrent-transition tests proving a single winner, one active row, and one success Record.

## Dependencies

- Parent Feature #9.
- Task: Define the lifecycle-transition audit payload.
- Feature #29's validated, atomic transition executor and current-state concurrency contract.

## Out of scope

- Background workflow automation and resource-driven transitions.
- Workflow/project-machine definition changes.
- General mutation provenance.

---

## 2. 中文翻译

父功能：#9 — 功能：审计生命周期状态转换

## 成果

一次成功的生命周期移动会关闭一个活动状态周期，打开一个新周期，并原子性地追加一条匹配的审计记录；被拒绝或失败的移动不会变更任何内容。

## 实施计划

1. 在功能 #29 解析当前状态、匹配项目转换、条件和必需退出标准后，集成审计载荷构建。
2. 在一个工作单元内，设置当前 `project_entity_states.ended_at`，插入目标状态历史行，并使用相同的转换时间和行为者追加 `state_transition` 记录。
3. 保留功能 #29 的并发控制，使竞争转换无法创建多个当前行或重复成功审计。
4. 通过显式应用/领域错误返回验证/条件/并发/审计失败，并回滚每个暂存变更。
5. 使审计行追加导向，并与可重用工作流状态和项目机器定义分离。

## 验收标准

- [ ] 每次成功转换恰好关闭一条先前状态历史行，打开一条新行，并创建一条审计记录。
- [ ] 被拒绝的转换不创建成功转换记录，也不改变当前状态。
- [ ] 状态历史和审计写入一起提交或回滚。
- [ ] 历史行和载荷在项目、实体、标签、源状态、目标状态、行为者和时间上达成一致。
- [ ] 并发请求无法创建多个活动当前状态行或重复成功审计记录。
- [ ] 当工作流或项目状态定义变更时，现有审计记录不会被重写。

## 测试

- 根据适当情况对初始化/转换路径进行集成测试，包括成功转换以及精确的前后历史加载荷值。
- 测试缺失转换、失败条件、失败必需退出标准、不匹配状态机引用和未知实体，无写入。
- 注入关闭行、插入行和记录写入失败，并断言完全回滚。
- 运行并发转换测试，证明单一获胜者、一个活动行和一条成功记录。

## 依赖

- 父功能 #9。
- 任务：定义生命周期转换审计载荷。
- 功能 #29 经过验证的、原子性的转换执行器和当前状态并发合同。

## 范围外

- 后台工作流自动化和资源驱动转换。
- 工作流/项目机器定义变更。
- 一般变更来源。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| commit | 提交 | Commit state history and transition audit atomically. |
| close | 关闭 | A successful lifecycle move closes one active state period. |
| open | 打开 | ...and opens one new period. |
| append | 追加 | ...and appends exactly one matching audit Record. |
| preserve | 保留 | Preserve Feature #29's concurrency control. |
| return | 返回 | Return failures through explicit application/domain errors. |
| roll back | 回滚 | Roll back every staged change. |
| exercise | 练习 | Exercise transaction commit and rollback. |
| inject | 注入 | Inject close-row, insert-row, and Record-write failures. |
| resolve | 解析 | Feature #29 resolves the current state and matching project transition. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| commit atomically | 原子性提交 | 不可分割地提交 |
| state history | 状态历史 | 实体状态变更的历史 |
| transition audit | 转换审计 | 对状态转换的审计 |
| active state period | 活动状态周期 | 实体处于某状态的时间段 |
| destination state-history row | 目标状态历史行 | 新状态的历史记录 |
| concurrency control | 并发控制 | 管理并发操作的机制 |
| competing transitions | 竞争转换 | 同时尝试的多个转换 |
| staged changes | 暂存变更 | 已准备但尚未提交的变更 |
| append-oriented | 追加导向的 | 只追加不修改 |
| retry/idempotency semantics | 重试/幂等语义 | 重复操作的约定 |

### 值得模仿的句式
1. **“A successful lifecycle move closes one active state period, opens one new period, and appends exactly one matching audit Record atomically.”** — 一次成功的生命周期移动会关闭一个活动状态周期，打开一个新周期，并原子性地追加一条匹配的审计记录。 — 例句：A successful migration closes one active period, opens a new one, and appends one audit record.
2. **“Rejected or failed moves change nothing.”** — 被拒绝或失败的移动不会变更任何内容。 — 例句：Rejected or failed requests change nothing in the system.
3. **“Competing transitions cannot create multiple current rows or duplicate success audits.”** — 竞争转换无法创建多个当前行或重复成功审计。 — 例句：Competing requests cannot create multiple active sessions or duplicate success logs.

### 领域词汇
| English | 中文 |
|---|---|
| Atomic commit | 原子性提交 |
| State history | 状态历史 |
| Transition audit | 转换审计 |
| Concurrency control | 并发控制 |
| Competing transition | 竞争转换 |
| Staged change | 暂存变更 |
| Append-oriented | 追加导向的 |
| Lifecycle move | 生命周期移动 |
| Current-state row | 当前状态行 |
| Success audit | 成功审计 |

---

## 4. 小练习

1. A successful lifecycle move closes one active state period, opens one new period, and appends exactly one matching audit Record ______.
2. Rejected or failed moves change ______.
3. Within one unit of work, set the current `project_entity_states.ended_at`, insert the destination state-history row, and ______ the `state_transition` Record.
4. Concurrent requests cannot create multiple active current-state rows or ______ successful audit Records.
5. Existing audit Records are never ______ when Workflow or Project State definitions change.

<details>
<summary>点击查看答案</summary>

1. atomically
2. nothing
3. append
4. duplicate
5. rewritten

</details>
