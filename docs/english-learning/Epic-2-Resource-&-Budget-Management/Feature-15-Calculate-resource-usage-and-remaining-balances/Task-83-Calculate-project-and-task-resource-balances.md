# Issue #83: Task: Calculate project and task resource balances

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Calculate resource usage and remaining balances (#15)

---

## 1. Original English

## Outcome

Implement exact current Project and Task Resource balance calculations over budget, allocation, and effective usage query ports.

Parent Feature: #15

## Implementation plan

1. Implement a framework-neutral balance service over Feature #12 budget, Feature #13 allocation, and Feature #14 usage read ports using #82.
2. Group inputs by logical Resource and canonical unit, validate Resource/unit consistency, and use exact decimal arithmetic throughout.
3. Produce Project summaries with budgeted, allocated, unallocated, consumed, and remaining fields and contributor identifiers.
4. Produce Task summaries only where allocations exist, using Task-attributed usage for allocated, consumed, and remaining fields.
5. Detect malformed logical references or incompatible inputs and return explicit integrity errors rather than silently omitting or converting data.

## Acceptance criteria

- [ ] Project summaries expose all five required amounts per Resource.
- [ ] Task summaries expose allocated, attributed consumed, and remaining amounts where an allocation exists.
- [ ] Project consumption includes Project-only and Task-attributed usage exactly once.
- [ ] Results are deterministic, exact, and partitioned so incompatible units are never combined.
- [ ] Negative unallocated or remaining values are preserved for later exception detection.
- [ ] Every result reconciles to its contributing relation and Record IDs.

## Tests

- Test empty, single, and multiple Resource/Task scenarios with fractional exact amounts.
- Test Project-only versus Task-attributed usage and guard against double counting.
- Test over-allocation, over-consumption, incompatible units, missing logical references, and contributor reconciliation.

## Dependencies

- #82, Task: Specify unit-safe resource balance semantics.
- Features #12-#14 must expose their active relation and effective usage query ports.

## Out of scope

- Historical/as-of query interface, forecasting, currency conversion, exception remediation, accounting, and billing.

---

## 2. 中文翻译

## 成果

基于预算、分配和有效使用查询端口，实现精确的项目和任务资源余额计算。

父 Feature：#15

## 实施计划

1. 使用 #82，在 Feature #12 预算、Feature #13 分配和 Feature #14 使用只读端口之上实现一个与框架无关的余额服务。
2. 按逻辑资源和规范单位对输入进行分组，验证资源/单位一致性，并在整个过程中使用精确小数算术。
3. 生成项目汇总，包含预算、已分配、未分配、已消耗和剩余字段以及贡献者标识符。
4. 仅在存在分配时生成任务汇总，使用任务归属的使用情况计算已分配、已消耗和剩余字段。
5. 检测畸形的逻辑引用或不兼容输入，并返回明确的完整性错误，而不是静默省略或转换数据。

## 验收标准

- [ ] 项目汇总暴露每种资源的全部五个必需金额。
- [ ] 任务汇总在存在分配时暴露已分配、归属的已消耗和剩余金额。
- [ ] 项目消耗恰好包含一次仅项目使用和带任务归属的使用。
- [ ] 结果是确定性的、精确的，并经过分区，因此不兼容单位永远不会被组合。
- [ ] 保留负的未分配或剩余值，供后续异常检测使用。
- [ ] 每个结果都与其贡献的关系和记录 ID 对账。

## 测试

- 使用分数精确金额测试空、单资源/任务和多资源/任务场景。
- 测试仅项目使用与带任务归属的使用，并防止重复计数。
- 测试超额分配、超消耗、不兼容单位、缺失逻辑引用以及贡献者对账。

## 依赖

- #82，任务：指定单位安全的资源余额语义。
- Features #12-#14 必须公开其活跃关系和有效使用查询端口。

## 排除范围

- 历史/截至某个时间点的查询接口、预测、货币转换、异常修复、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| implement | 实现 | Implement exact current balance calculations. |
| group | 分组 | Group inputs by logical Resource and canonical unit. |
| validate | 验证 | Validate Resource/unit consistency. |
| produce | 生成 | Produce Project and Task summaries. |
| detect | 检测 | Detect malformed logical references. |
| return | 返回 | Return explicit integrity errors. |
| preserve | 保留 | Preserve negative values for later exception detection. |
| reconcile | 对账 | Every result reconciles to contributor IDs. |
| guard | 防止 | Guard against double counting. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| balance calculations | 余额计算 | exact current balance calculations |
| query ports | 查询端口 | effective usage query ports |
| framework-neutral balance service | 与框架无关的余额服务 | implement a framework-neutral balance service |
| logical Resource | 逻辑资源 | group by logical Resource |
| canonical unit | 规范单位 | group by canonical unit |
| exact decimal arithmetic | 精确小数算术 | use exact decimal arithmetic throughout |
| contributor identifiers | 贡献者标识符 | produce summaries with contributor identifiers |
| Task-attributed usage | 任务归属的使用 | using Task-attributed usage |
| malformed logical references | 畸形的逻辑引用 | detect malformed logical references |
| explicit integrity errors | 明确的完整性错误 | return explicit integrity errors |
| double counting | 重复计数 | guard against double counting |

### 值得模仿的句式
1. **“Implement exact current Project and Task Resource balance calculations over budget, allocation, and effective usage query ports.”** — “基于预算、分配和有效使用查询端口，实现精确的项目和任务资源余额计算。” — *Implement exact current Project and Task Resource balance calculations over budget, allocation, and effective usage query ports.*
2. **“Group inputs by logical Resource and canonical unit, validate Resource/unit consistency, and use exact decimal arithmetic throughout.”** — “按逻辑资源和规范单位对输入进行分组，验证资源/单位一致性，并在整个过程中使用精确小数算术。” — *Group inputs by logical Resource and canonical unit, validate Resource/unit consistency, and use exact decimal arithmetic throughout.*
3. **“Negative unallocated or remaining values are preserved for later exception detection.”** — “保留负的未分配或剩余值，供后续异常检测使用。” — *Negative unallocated or remaining values are preserved for later exception detection.*

### 领域词汇
| English | 中文 |
|---|---|
| balance calculation | 余额计算 |
| query port | 查询端口 |
| balance service | 余额服务 |
| logical Resource | 逻辑资源 |
| canonical unit | 规范单位 |
| exact decimal arithmetic | 精确小数算术 |
| Project summary | 项目汇总 |
| Task summary | 任务汇总 |
| Task-attributed usage | 任务归属的使用 |
| contributor identifier | 贡献者标识符 |
| integrity error | 完整性错误 |
| double counting | 重复计数 |

---

## 4. 小练习

1. We implement exact current Project and Task Resource ______ calculations over budget, allocation, and effective usage query ports.
2. Inputs are grouped by logical Resource and ______ unit.
3. Project summaries expose budgeted, allocated, unallocated, consumed, and ______ amounts.
4. Task summaries use Task-______ usage for allocated, consumed, and remaining fields.
5. We must ______ against double counting when Project-only and Task-attributed usage both exist.

<details>
<summary>点击查看答案</summary>

1. balance  
2. canonical  
3. remaining  
4. attributed  
5. guard

</details>
