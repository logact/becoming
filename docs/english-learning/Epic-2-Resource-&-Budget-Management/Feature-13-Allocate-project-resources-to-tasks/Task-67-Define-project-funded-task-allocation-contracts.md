# Issue #67: Task: Define project-funded task allocation contracts

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Allocate project resources to tasks (#13)

---

## 1. Original English

## Outcome

Define a Task Resource allocation as a temporal semantic relation that names its funding Project and can only draw from that Project's active compatible budget.

Parent Feature: #13

## Implementation plan

1. Specify the allowed relation shape (`task` → `allocated` → `resource`) and canonical metadata for funding `project_id`, strictly positive exact amount, unit, optional validity/context, and metadata version.
2. Reuse the Resource quantity/unit contract from Feature #11 and the Project budget contract from Feature #12.
3. Define logical-reference validation ports for Task, Project, Resource, active Task-to-Project membership, and the active Project/Resource budget; do not rely on database foreign keys.
4. Define active allocation identity and temporal invariants for one Task/Project/Resource context, including end-and-append supersession.
5. Define explicit over-allocation policy outcomes (`reject` or `flag`) based on total active allocations against the active Project budget.

## Acceptance criteria

- [ ] An allocation identifies Task, funding Project, Resource, strictly positive exact amount, and compatible unit.
- [ ] A Task may hold allocations for multiple Resources.
- [ ] The Task must be an active member of the funding Project and the Project must have an active compatible budget.
- [ ] An allocation cannot resolve implicitly to or draw from an unrelated Project budget.
- [ ] Active identity and temporal rules preserve prior allocation plans through ended relations.
- [ ] Over-allocation has an explicit `reject` or `flag` outcome, with no database foreign keys or framework dependency.

## Tests

- Unit-test relation shape and metadata, exact/positive amount, compatible unit, and Project-context requirements.
- Test missing/archived Task, Project, Resource, membership, and budget logical references with fake ports.
- Test active identity, interval boundaries, and reject/flag policy outcomes at below, equal, and above budget.

## Dependencies

- Feature #12, Budget resources to projects (tasks #61-#63).
- Feature #18, Manage tasks and project membership.
- Feature #5, Track relationship changes over time.

## Out of scope

- Actual consumption and resource scheduling.
- Automatic redistribution among Tasks, accounting, or billing.

---

## 2. 中文翻译

## 成果

将任务资源分配定义为一种时态语义关系，它指明其资金项目，并且只能从该项目活跃且兼容的预算中支取。

父 Feature：#13

## 实施计划

1. 指定允许的关系形态（`task` → `allocated` → `resource`）以及资金 `project_id`、严格正的精确金额、单位、可选有效期/上下文和元数据版本的规范元数据。
2. 复用 Feature #11 的资源数量/单位契约和 Feature #12 的项目预算契约。
3. 定义任务、项目、资源、活跃任务到项目成员关系以及活跃项目/资源预算的逻辑引用验证端口；不依赖数据库外键。
4. 为一个任务/项目/资源上下文定义活跃分配标识和时态不变量，包括结束并追加的取代机制。
5. 根据针对活跃项目预算的总活跃分配，定义明确的超额分配策略结果（`reject` 或 `flag`）。

## 验收标准

- [ ] 分配标识任务、资金项目、资源、严格正的精确金额和兼容单位。
- [ ] 一个任务可以持有多种资源的分配。
- [ ] 任务必须是资金项目的活跃成员，且项目必须拥有活跃且兼容的预算。
- [ ] 分配不能隐式解析或从不相关的项目预算中支取。
- [ ] 活跃标识和时态规则通过已结束的关系保留先前的分配计划。
- [ ] 超额分配产生明确的 `reject` 或 `flag` 结果，且不依赖数据库外键或框架。

## 测试

- 对关系形态和元数据、精确/正数金额、兼容单位以及项目上下文要求进行单元测试。
- 使用模拟端口测试缺失/归档的任务、项目、资源、成员关系和预算逻辑引用。
- 测试活跃标识、区间边界，以及低于、等于和高于预算时的 reject/flag 策略结果。

## 依赖

- Feature #12：为项目预算资源（任务 #61-#63）。
- Feature #18：管理任务和项目成员资格。
- Feature #5：跟踪关系随时间的变化。

## 排除范围

- 实际消耗和资源调度。
- 任务之间的自动重新分配、会计或计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define a Task Resource allocation as a temporal semantic relation. |
| name | 指明、命名 | The relation names its funding Project. |
| draw | 支取 | Draw from the Project's active compatible budget. |
| specify | 指定 | Specify the allowed relation shape. |
| reuse | 复用 | Reuse the Resource quantity/unit contract. |
| validate | 验证 | Validate logical references through ports. |
| preserve | 保留 | Preserve prior allocation plans through ended relations. |
| resolve | 解析 | An allocation cannot resolve implicitly to an unrelated budget. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| temporal semantic relation | 时态语义关系 | a temporal semantic relation |
| funding Project | 资金项目 | name its funding Project |
| active compatible budget | 活跃且兼容的预算 | draw from the active compatible budget |
| relation shape | 关系形态 | specify the allowed relation shape |
| canonical metadata | 规范元数据 | canonical metadata for amount and unit |
| strictly positive exact amount | 严格正的精确金额 | a strictly positive exact amount |
| optional validity/context | 可选有效期/上下文 | optional validity/context metadata |
| logical-reference validation ports | 逻辑引用验证端口 | define validation ports |
| active Task-to-Project membership | 活跃任务到项目成员关系 | validate active membership |
| end-and-append supersession | 结束并追加的取代 | end-and-append supersession |
| over-allocation policy outcomes | 超额分配策略结果 | explicit policy outcomes |

### 值得模仿的句式
1. **“Define X as a temporal semantic relation that names its funding Project and can only draw from that Project's active compatible budget.”** — “将 X 定义为一种时态语义关系，它指明其资金项目，并且只能从该项目活跃且兼容的预算中支取。” — *Define a Task Resource allocation as a temporal semantic relation that names its funding Project and can only draw from that Project's active compatible budget.*
2. **“Reuse the Resource quantity/unit contract from Feature #11 and the Project budget contract from Feature #12.”** — “复用 Feature #11 的资源数量/单位契约和 Feature #12 的项目预算契约。” — *Reuse the Resource quantity/unit contract from Feature #11 and the Project budget contract from Feature #12.*
3. **“Define explicit over-allocation policy outcomes (`reject` or `flag`) based on total active allocations against the active Project budget.”** — “根据针对活跃项目预算的总活跃分配，定义明确的超额分配策略结果（`reject` 或 `flag`）。” — *Define explicit over-allocation policy outcomes (`reject` or `flag`) based on total active allocations against the active Project budget.*

### 领域词汇
| English | 中文 |
|---|---|
| Task Resource allocation | 任务资源分配 |
| temporal semantic relation | 时态语义关系 |
| funding Project | 资金项目 |
| relation shape | 关系形态 |
| canonical metadata | 规范元数据 |
| metadata version | 元数据版本 |
| logical-reference validation port | 逻辑引用验证端口 |
| Task-to-Project membership | 任务到项目成员关系 |
| active allocation identity | 活跃分配标识 |
| temporal invariant | 时态不变量 |
| end-and-append supersession | 结束并追加的取代 |
| over-allocation policy | 超额分配策略 |

---

## 4. 小练习

1. A Task Resource allocation is a temporal ______ relation that names its funding Project.
2. Allocations can only draw from the Project's active ______ budget.
3. We should reuse the Resource quantity/unit contract from Feature #11 and the Project ______ contract from Feature #12.
4. The Task must be an active member of the funding Project and the Project must have an active ______ budget.
5. Over-allocation has an explicit `reject` or `______` outcome.

<details>
<summary>点击查看答案</summary>

1. semantic  
2. compatible  
3. budget  
4. compatible  
5. flag

</details>
