# Issue #61: Task: Define project budget relation contracts

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Budget resources to projects (#12)

---

## 1. Original English

## Outcome

Define the framework-neutral domain contract for a Project budget as a temporal Project-to-Resource semantic relation with exact amount, compatible unit, and optional validity/context metadata.

Parent Feature: #12

## Implementation plan

1. Specify the allowed relation shape (`project` → `budgeted_by` → `resource`) and canonical metadata fields for amount, unit, Project context, optional effective validity, policy context, and future-compatible metadata versioning.
2. Reuse Feature #11's exact decimal and unit rules; require a strictly positive finite amount and unit compatibility with the funding Resource.
3. Define logical-reference validation ports for active Project and Resource existence because the schema intentionally has no database foreign keys.
4. Define active-budget identity and temporal invariants: at most one active budget per Project/Resource context, `created_at`/optional validity semantics, and `ended_at` rather than destructive replacement.
5. Define explicit capacity policies (`reject` or `surface`) and deterministic domain errors/results without embedding a general accounting model.

## Acceptance criteria

- [ ] A budget contract identifies the Project, funding Resource, strictly positive exact amount, and compatible unit.
- [ ] One Project may budget multiple Resources while active-budget identity remains deterministic per Project and Resource.
- [ ] Project and Resource IDs are logical references validated through application/domain ports.
- [ ] Temporal metadata can represent active and ended budget relations without overwriting history.
- [ ] Exceeding finite Resource capacity has an explicit `reject` or `surface` policy outcome.
- [ ] No database foreign keys, framework choice, currency conversion, accounting, or billing concepts are introduced.

## Tests

- Unit-test relation direction/type, required metadata, positive/exact amounts, and compatible/incompatible units.
- Test active identity and interval boundary invariants, including zero-length or overlapping invalid histories.
- Test both finite-capacity policy outcomes and a Resource whose capacity is unspecified.

## Dependencies

- Feature #11, Define resource catalogs and available capacity.
- Feature #19, Create and validate semantic relations.
- Feature #5, Track relationship changes over time.
- Feature #20, Manage projects and goal pursuit.

## Out of scope

- Task allocation and actual consumption.
- Automated rebudgeting, general accounting, billing, currency conversion, and capacity scheduling.

---

## 2. 中文翻译

## 成果

将项目预算定义为与框架无关的领域契约：一种时态的项目到资源语义关系，包含精确金额、兼容单位以及可选的有效期/上下文元数据。

父 Feature：#12

## 实施计划

1. 指定允许的关系形态（`project` → `budgeted_by` → `resource`）以及金额、单位、项目上下文、可选生效有效期、策略上下文和未来兼容的元数据版本的规范元数据字段。
2. 复用 Feature #11 的精确小数和单位规则；要求金额为严格正的有限小数，并且单位与资金来源资源兼容。
3. 由于模式故意不设数据库外键，定义用于验证活跃项目和资源存在的逻辑引用验证端口。
4. 定义活跃预算标识和时态不变量：每个项目/资源上下文最多一个活跃预算、`created_at`/可选有效期语义，以及使用 `ended_at` 而非破坏性替换。
5. 定义明确的容量策略（`reject` 或 `surface`）以及确定性的领域错误/结果，而不嵌入通用会计模型。

## 验收标准

- [ ] 预算契约标识项目、资金来源资源、严格正的精确金额和兼容单位。
- [ ] 一个项目可以为多种资源编制预算，同时每个项目和资源的活跃预算标识保持确定性。
- [ ] 项目和资源 ID 是通过应用/领域端口验证的逻辑引用。
- [ ] 时态元数据可以表示活跃和已结束的预算关系，而无需覆盖历史。
- [ ] 超出有限资源容量会产生明确的 `reject` 或 `surface` 策略结果。
- [ ] 不引入数据库外键、框架选择、货币转换、会计或计费概念。

## 测试

- 对关系方向/类型、必填元数据、正数/精确金额以及兼容/不兼容单位进行单元测试。
- 测试活跃标识和区间边界不变量，包括零长度或重叠的无效历史。
- 测试有限容量策略结果以及容量未指定的资源。

## 依赖

- Feature #11：定义资源目录和可用容量。
- Feature #19：创建并验证语义关系。
- Feature #5：跟踪关系随时间的变化。
- Feature #20：管理项目和目标追求。

## 排除范围

- 任务分配和实际消耗。
- 自动重新预算、通用会计、计费、货币转换和容量调度。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the framework-neutral domain contract. |
| specify | 指定 | Specify the allowed relation shape. |
| reuse | 复用 | Reuse Feature #11's exact decimal and unit rules. |
| require | 要求 | Require a strictly positive finite amount. |
| validate | 验证 | Validate logical references through ports. |
| remain | 保持 | Active-budget identity remains deterministic. |
| represent | 表示 | Temporal metadata can represent active and ended relations. |
| exceed | 超出 | Exceeding finite Resource capacity has a policy outcome. |
| introduce | 引入 | No database foreign keys are introduced. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral domain contract | 与框架无关的领域契约 | define a framework-neutral domain contract |
| temporal semantic relation | 时态语义关系 | a temporal Project-to-Resource semantic relation |
| exact amount | 精确金额 | an exact amount with compatible unit |
| compatible unit | 兼容单位 | unit compatibility with the funding Resource |
| optional validity/context metadata | 可选有效期/上下文元数据 | store optional validity/context metadata |
| relation shape | 关系形态 | specify the allowed relation shape |
| canonical metadata fields | 规范元数据字段 | canonical metadata fields for amount and unit |
| strictly positive finite amount | 严格正的有限金额 | require a strictly positive finite amount |
| logical-reference validation ports | 逻辑引用验证端口 | define logical-reference validation ports |
| active-budget identity | 活跃预算标识 | active-budget identity remains deterministic |
| capacity policies | 容量策略 | explicit capacity policies (`reject` or `surface`) |

### 值得模仿的句式
1. **“Define the framework-neutral domain contract for X as a temporal Y with exact amount, compatible unit, and optional validity/context metadata.”** — “将 X 定义为与框架无关的领域契约：一种时态的 Y，包含精确金额、兼容单位以及可选的有效期/上下文元数据。” — *Define the framework-neutral domain contract for a Project budget as a temporal Project-to-Resource semantic relation with exact amount, compatible unit, and optional validity/context metadata.*
2. **“Reuse Feature #11's exact decimal and unit rules; require a strictly positive finite amount and unit compatibility with the funding Resource.”** — “复用 Feature #11 的精确小数和单位规则；要求严格正的有限金额，且单位与资金来源资源兼容。” — *Reuse Feature #11's exact decimal and unit rules; require a strictly positive finite amount and unit compatibility with the funding Resource.*
3. **“Define explicit capacity policies (`reject` or `surface`) and deterministic domain errors/results without embedding a general accounting model.”** — “定义明确的容量策略（`reject` 或 `surface`）以及确定性的领域错误/结果，而不嵌入通用会计模型。” — *Define explicit capacity policies (`reject` or `surface`) and deterministic domain errors/results without embedding a general accounting model.*

### 领域词汇
| English | 中文 |
|---|---|
| domain contract | 领域契约 |
| semantic relation | 语义关系 |
| relation shape | 关系形态 |
| canonical metadata | 规范元数据 |
| effective validity | 生效有效期 |
| policy context | 策略上下文 |
| metadata versioning | 元数据版本控制 |
| active-budget identity | 活跃预算标识 |
| temporal invariant | 时态不变量 |
| capacity policy | 容量策略 |
| deterministic domain error | 确定性领域错误 |
| general accounting model | 通用会计模型 |

---

## 4. 小练习

1. We need to define the domain contract for a Project budget as a temporal Project-to-Resource ______ relation.
2. The contract should reuse Feature #11's exact decimal and ______ rules.
3. A budget amount must be a strictly positive ______ amount.
4. There can be at most one ______ budget per Project/Resource context.
5. Exceeding finite Resource capacity should produce an explicit `reject` or `______` policy outcome.

<details>
<summary>点击查看答案</summary>

1. semantic  
2. unit  
3. finite  
4. active  
5. surface

</details>
