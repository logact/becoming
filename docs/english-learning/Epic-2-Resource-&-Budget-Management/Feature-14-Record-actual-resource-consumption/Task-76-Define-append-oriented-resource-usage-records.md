# Issue #76: Task: Define append-oriented resource usage records

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Record actual resource consumption (#14)

---

## 1. Original English

## Outcome

Define actual resource consumption as append-oriented `resource_usage` Records linked semantically to their Project, optional Task, and consumed Resource, distinct from planned budgets and allocations.

Parent Feature: #14

## Implementation plan

1. Define the usage Record contract over Feature #6's `records` model: UUID, description, `record_type=resource_usage`, occurrence/recorded timestamps, actor, and structured payload for exact amount, unit, Project context, optional Task, and execution context.
2. Define required semantic links from the Record to the Project and Resource and an optional link to the Task, using only allowed core-concept relations from `Table-definetion.txt`.
3. Reuse Feature #11's canonical decimal/unit precision rules; require a strictly positive finite amount and compatibility with the Resource.
4. Define domain validation ports for logical Project/Resource/Task references, active Task membership in the Project when attributed, and optional active budget/allocation context without database foreign keys.
5. Define immutable correction semantics: original usage is retained, and a correction/reversal Record references what it corrects with an explicit signed aggregation effect rather than updating occurrence facts in place.

## Acceptance criteria

- [ ] Usage requires Project, Resource, strictly positive exact amount, compatible unit, and occurrence time.
- [ ] Task attribution is optional, but an attributed Task must belong to the named Project context.
- [ ] The Record and relations retain actor, recorded time, and optional execution context.
- [ ] Correction semantics are append-oriented and preserve the original usage entry.
- [ ] Planned budget/allocation relations are separate inputs and are never rewritten by the usage contract.
- [ ] Logical references are application/domain validated with no database foreign keys or framework assumption.

## Tests

- Unit-test required fields, timestamps, amount precision, unit compatibility, and optional attribution/context.
- Test valid and invalid Project/Task membership and missing/archived logical references with fake ports.
- Test correction/reversal invariants, including prevention of correction cycles or ambiguous double replacement.

## Dependencies

- Feature #6, Record occurrences as first-class domain data.
- Feature #11, Define resource catalogs and available capacity.
- Feature #12, Budget resources to projects.
- Feature #18, Manage tasks and project membership.

## Out of scope

- Usage write/query adapters and aggregate balances.
- Invoicing, payment reconciliation, automated external collection, accounting, and billing.

---

## 2. 中文翻译

## 成果

将实际资源消耗定义为追加导向的 `resource_usage` 记录，这些记录在语义上链接到其项目、可选任务和消耗的资源，并与计划预算和分配相区别。

父 Feature：#14

## 实施计划

1. 在 Feature #6 的 `records` 模型之上定义使用记录契约：UUID、描述、`record_type=resource_usage`、发生/记录时间戳、执行者，以及用于精确金额、单位、项目上下文、可选任务和执行上下文结构化载荷。
2. 定义从记录到项目和资源的必需语义链接，以及到任务的可选链接，仅使用 `Table-definetion.txt` 中允许的核心概念关系。
3. 复用 Feature #11 的规范小数/单位精度规则；要求严格正的有限金额，并与资源兼容。
4. 定义领域验证端口，用于验证逻辑项目/资源/任务引用、归属时任务在项目中的活跃成员关系，以及可选的活跃预算/分配上下文；不使用数据库外键。
5. 定义不可变的更正语义：保留原始使用记录，更正/冲销记录引用其所更正的内容，并带有明确的带符号聚合效果，而不是就地更新发生事实。

## 验收标准

- [ ] 使用记录需要项目、资源、严格正的精确金额、兼容单位和发生时间。
- [ ] 任务归属是可选的，但被归属的任务必须属于指定的项目上下文。
- [ ] 记录和关系保留执行者、记录时间和可选执行上下文。
- [ ] 更正语义是追加导向的，并保留原始使用条目。
- [ ] 计划预算/分配关系是独立输入，不会被使用契约重写。
- [ ] 逻辑引用在应用/领域层进行验证，且不做数据库外键或框架假设。

## 测试

- 对必填字段、时间戳、金额精度、单位兼容性以及可选归属/上下文进行单元测试。
- 使用模拟端口测试有效和无效的项目/任务成员关系以及缺失/归档的逻辑引用。
- 测试更正/冲销不变量，包括防止更正循环或模糊的双重替换。

## 依赖

- Feature #6：将发生记录作为一等领域数据。
- Feature #11：定义资源目录和可用容量。
- Feature #12：为项目预算资源。
- Feature #18：管理任务和项目成员资格。

## 排除范围

- 使用写入/查询适配器和聚合余额。
- 开票、付款对账、自动化外部采集、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define actual resource consumption as append-oriented Records. |
| link | 链接 | Link Records semantically to Project, Task, and Resource. |
| reuse | 复用 | Reuse canonical decimal/unit precision rules. |
| require | 要求 | Require a strictly positive finite amount. |
| retain | 保留 | Retain actor, recorded time, and context. |
| reference | 引用 | A correction Record references what it corrects. |
| update | 更新 | Avoid updating occurrence facts in place. |
| preserve | 保留 | Preserve the original usage entry. |
| validate | 验证 | Validate logical references in the domain layer. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| append-oriented records | 追加导向的记录 | define append-oriented `resource_usage` Records |
| semantic links | 语义链接 | linked semantically to their Project |
| planned budgets and allocations | 计划预算和分配 | distinct from planned budgets and allocations |
| structured payload | 结构化载荷 | structured payload for amount and unit |
| occurrence/recorded timestamps | 发生/记录时间戳 | occurrence/recorded timestamps |
| core-concept relations | 核心概念关系 | allowed core-concept relations |
| canonical decimal/unit precision rules | 规范小数/单位精度规则 | reuse canonical precision rules |
| strictly positive finite amount | 严格正的有限金额 | require a strictly positive finite amount |
| immutable correction semantics | 不可变的更正语义 | define immutable correction semantics |
| signed aggregation effect | 带符号的聚合效果 | explicit signed aggregation effect |
| occurrence facts | 发生事实 | update occurrence facts in place |

### 值得模仿的句式
1. **“Define actual resource consumption as append-oriented `resource_usage` Records linked semantically to their Project, optional Task, and consumed Resource, distinct from planned budgets and allocations.”** — “将实际资源消耗定义为追加导向的 `resource_usage` 记录，这些记录在语义上链接到其项目、可选任务和消耗的资源，并与计划预算和分配相区别。” — *Define actual resource consumption as append-oriented `resource_usage` Records linked semantically to their Project, optional Task, and consumed Resource, distinct from planned budgets and allocations.*
2. **“Define immutable correction semantics: original usage is retained, and a correction/reversal Record references what it corrects with an explicit signed aggregation effect rather than updating occurrence facts in place.”** — “定义不可变的更正语义：保留原始使用记录，更正/冲销记录引用其所更正的内容，并带有明确的带符号聚合效果，而不是就地更新发生事实。” — *Define immutable correction semantics: original usage is retained, and a correction/reversal Record references what it corrects with an explicit signed aggregation effect rather than updating occurrence facts in place.*

### 领域词汇
| English | 中文 |
|---|---|
| append-oriented record | 追加导向的记录 |
| resource_usage Record | resource_usage 记录 |
| structured payload | 结构化载荷 |
| semantic link | 语义链接 |
| core-concept relation | 核心概念关系 |
| immutable correction semantics | 不可变的更正语义 |
| correction/reversal Record | 更正/冲销记录 |
| signed aggregation effect | 带符号的聚合效果 |
| occurrence facts | 发生事实 |
| validation port | 验证端口 |

---

## 4. 小练习

1. Actual resource consumption is defined as append-oriented `resource_usage` Records linked ______ to their Project, optional Task, and consumed Resource.
2. The usage Record contract is built over Feature #6's ______ model.
3. We reuse Feature #11's canonical decimal/unit ______ rules.
4. Immutable correction semantics mean the original usage is ______ and a correction Record references what it corrects.
5. Correction Records use an explicit signed ______ effect rather than updating occurrence facts in place.

<details>
<summary>点击查看答案</summary>

1. semantically  
2. records  
3. precision  
4. retained  
5. aggregation

</details>
