# Issue #77: Task: Define the lifecycle-transition audit payload

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Audit lifecycle state transitions (#9)

---

## 1. Original English

Parent Feature: #9 — Feature: Audit lifecycle state transitions

## Outcome

Every project-scoped lifecycle transition has one durable, versioned audit payload that remains meaningful independently of later workflow or project-machine edits.

## Implementation plan

1. Define the `state_transition` Record payload with project ID, entity type/ID, management label ID, from/to project-state IDs, project-transition ID, actor, transition time, and schema version.
2. Include immutable descriptive snapshots needed for historical meaning (such as state titles/categories and machine identity) so later Workflow or Project State changes do not rewrite or obscure the event.
3. Define structured condition and required-exit-criteria evaluation results, including policy/rule identifiers and outcome summaries while excluding sensitive inputs.
4. Define the transaction handoff between Feature #29's lifecycle executor and the Record repository, plus exact Record-count, retry, and failure semantics.
5. Require application/domain logical-reference validation across `project_entity_states`, `project_states`, `labels`, projects, and the appropriate independent core entity table; add no database foreign keys.

## Acceptance criteria

- [ ] The payload identifies project, entity type/ID, label, from-state, to-state, transition, actor, and transition time.
- [ ] Condition and exit-criteria evaluation outcomes are captured through an explicit, redacted structure.
- [ ] Immutable descriptive snapshots/schema version keep the event understandable after machine edits or archival.
- [ ] One accepted transition maps to exactly one `state_transition` Record and rejected transitions map to none.
- [ ] The audit append participates in the same application transaction as state-history updates.
- [ ] All references are application/domain validated without an `entities` table or database foreign keys.

## Tests

- Unit-test payload construction, schema versioning, actor/time propagation, and evaluation-result redaction.
- Test each supported core entity-type discriminator and mismatched project/entity/label/state machine references.
- Contract-test exact Record counts, retry/idempotency semantics, and rollback on audit persistence failure.
- Test rendering/resolution from stored snapshots after referenced machine definitions change or archive.

## Dependencies

- Parent Feature #9.
- #53 — Task: Establish the Record domain model and persistence.
- Feature #29 — Execute project-scoped lifecycle transitions.

## Out of scope

- Defining state machines or allowed transitions.
- General core-entity mutation and relation-change payloads.
- Authorization and UI rendering.

---

## 2. 中文翻译

父功能：#9 — 功能：审计生命周期状态转换

## 成果

每个项目范围生命周期转换都有一个持久的、版本化的审计载荷，独立于后续工作流或项目机器编辑仍然有意义。

## 实施计划

1. 使用项目 ID、实体类型/ID、管理标签 ID、源/目标项目状态 ID、项目转换 ID、行为者、转换时间和模式版本定义 `state_transition` 记录载荷。
2. 包含不可变的描述性快照，以保证历史意义（如状态标题/类别和机器标识），这样后续工作流或项目状态变更不会重写或模糊事件。
3. 定义结构化条件和必需退出标准评估结果，包括策略/规则标识符和结果摘要，同时排除敏感输入。
4. 定义功能 #29 的生命周期执行器与记录仓库之间的事务交接，以及精确的记录数量、重试和失败语义。
5. 要求对 `project_entity_states`、`project_states`、`labels`、项目和相应独立核心实体表进行应用/领域逻辑引用验证；不添加数据库外键。

## 验收标准

- [ ] 载荷标识项目、实体类型/ID、标签、源状态、目标状态、转换、行为者和转换时间。
- [ ] 条件和退出标准评估结果通过显式、编辑后的结构捕获。
- [ ] 不可变的描述性快照/模式版本使事件在机器编辑或归档后仍可理解。
- [ ] 一个被接受的转换映射到恰好一条 `state_transition` 记录，被拒绝的转换映射到零条。
- [ ] 审计追加参与与状态历史更新相同的应用事务。
- [ ] 所有引用都通过应用/领域验证，没有 `entities` 表或数据库外键。

## 测试

- 单元测试载荷构建、模式版本控制、行为者/时间传播和评估结果编辑。
- 测试每个支持的核心实体类型鉴别器以及不匹配的项目/实体/标签/状态机引用。
- 合同测试精确记录数量、重试/幂等语义以及审计持久化失败时的回滚。
- 测试在引用的机器定义变更或归档后，从存储快照进行渲染/解析。

## 依赖

- 父功能 #9。
- #53 — 任务：建立记录领域模型和持久化。
- 功能 #29 — 执行项目范围生命周期转换。

## 范围外

- 定义状态机或允许转换。
- 一般核心实体变更和关系变更载荷。
- 授权和 UI 渲染。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the `state_transition` Record payload. |
| include | 包含 | Include immutable descriptive snapshots needed for historical meaning. |
| exclude | 排除 | Excluding sensitive inputs from evaluation results. |
| hand off | 交接 | Define the transaction handoff between executor and repository. |
| require | 要求 | Require application/domain logical-reference validation. |
| validate | 验证 | All references are application/domain validated. |
| capture | 捕获 | Condition and exit-criteria outcomes are captured. |
| propagate | 传播 | Actor/time propagation in payload construction. |
| render | 渲染 | Test rendering/resolution from stored snapshots. |
| obscure | 模糊 | Later changes do not rewrite or obscure the event. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| lifecycle-transition audit payload | 生命周期转换审计载荷 | 审计状态转换的数据结构 |
| versioned audit payload | 版本化的审计载荷 | 带有版本号的审计数据 |
| state_transition Record | 状态转换记录 | 类型为 state_transition 的记录 |
| project ID | 项目 ID | 项目标识符 |
| entity type/ID | 实体类型/ID | 实体标识信息 |
| management label ID | 管理标签 ID | 管理标签的标识符 |
| from/to project-state IDs | 源/目标项目状态 ID | 状态转换前后的状态标识 |
| project-transition ID | 项目转换 ID | 项目转换的标识符 |
| schema version | 模式版本 | 数据结构版本 |
| immutable descriptive snapshots | 不可变的描述性快照 | 保持不变的历史描述 |
| condition evaluation | 条件评估 | 对条件的判断 |
| required exit criteria | 必需退出标准 | 离开状态前必须满足的条件 |
| redacted structure | 编辑后的结构 | 隐藏敏感信息的结构 |
| transaction handoff | 事务交接 | 事务责任的转移 |
| retry semantics | 重试语义 | 重试行为的约定 |

### 值得模仿的句式
1. **“Every project-scoped lifecycle transition has one durable, versioned audit payload...”** — 每个项目范围生命周期转换都有一个持久的、版本化的审计载荷... — 例句：Every payment has one durable, versioned audit payload.
2. **“...remains meaningful independently of later workflow or project-machine edits.”** — ...独立于后续工作流或项目机器编辑仍然有意义。 — 例句：The audit record remains meaningful independently of later schema changes.
3. **“...excluding sensitive inputs.”** — ...排除敏感输入。 — 例句：The log captures metadata excluding sensitive inputs.

### 领域词汇
| English | 中文 |
|---|---|
| Audit payload | 审计载荷 |
| Schema version | 模式版本 |
| Immutable snapshot | 不可变快照 |
| Condition evaluation | 条件评估 |
| Exit criteria | 退出标准 |
| Transaction handoff | 事务交接 |
| Retry semantics | 重试语义 |
| Redaction | 编辑 |
| State machine | 状态机 |
| Project machine | 项目机器 |

---

## 4. 小练习

1. Every project-scoped lifecycle transition has one durable, ______ audit payload.
2. Immutable descriptive snapshots keep the event ______ after machine edits or archival.
3. Condition and exit-criteria outcomes are captured through an explicit, ______ structure.
4. One accepted transition maps to exactly one `state_transition` Record and rejected transitions map to ______.
5. The audit append participates in the same application ______ as state-history updates.

<details>
<summary>点击查看答案</summary>

1. versioned
2. understandable
3. redacted
4. none
5. transaction

</details>
