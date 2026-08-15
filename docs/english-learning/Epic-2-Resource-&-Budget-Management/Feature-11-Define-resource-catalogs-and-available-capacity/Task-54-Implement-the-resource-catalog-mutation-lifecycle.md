# Issue #54: Task: Implement the resource catalog mutation lifecycle

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define resource catalogs and available capacity (#11)

---

## 1. Original English

## Outcome

Provide application commands to create, read, update, and archive Resources while preventing unit reinterpretation and emitting the required provenance evidence.

Parent Feature: #11

## Implementation plan

1. Implement create, get, update, archive, and catalog-query use cases over the domain and repository ports from #49 and #51.
2. On updates to unit, resource type, behavior, or precision policy, inspect logically related budget, allocation, and usage data through ports; reject changes that would silently reinterpret existing amounts, or require an explicit safe migration path owned by later work.
3. Validate active/archive transitions and make repeat archive requests deterministic without deleting historical Resource data.
4. Invoke Feature #30's provenance port for important create, update, and archive mutations, including actor/cause and before/after facts where applicable.
5. Expose transport-neutral request/response contracts and error mappings that a future CLI, API, or UI adapter can consume.

## Acceptance criteria

- [ ] Users can create, read, update, archive, and filter Resource entries through application use cases.
- [ ] Every command revalidates canonical decimal, unit, behavior, and required-field invariants.
- [ ] A semantics-changing update cannot silently reinterpret an existing budget, allocation, or usage quantity.
- [ ] Archive is historical rather than destructive, and archived Resources remain queryable.
- [ ] Important mutations emit provenance through the shared provenance contract.
- [ ] Command contracts remain independent of a particular framework or transport.

## Tests

- Test successful and rejected create/update/archive command paths with fake ports and the storage adapter.
- Test no-op/idempotent archive behavior and active/archived queries.
- Test that linked amounts block incompatible unit or precision changes and that provenance is emitted only for committed mutations.

## Dependencies

- #49, Task: Model resource quantities and catalog invariants.
- #51, Task: Persist and query resource catalog catalog entries.
- Feature #30, Capture provenance for core entity mutations.

## Out of scope

- Migrating existing quantities between units.
- Project budgets, Task allocations, consumption, general accounting, billing, and resource scheduling.

---

## 2. 中文翻译

## 成果

提供用于创建、读取、更新和归档 Resource 的应用命令，同时防止单位重新解释并生成所需的来源证据。

父 Feature：#11

## 实施计划

1. 基于 #49 和 #51 的领域与仓库端口，实现创建、获取、更新、归档和目录查询用例。
2. 在更新单位、资源类型、行为或精度策略时，通过端口检查逻辑相关的预算、分配和使用数据；拒绝会静默重新解释现有金额的更改，或要求后续工作提供明确的安全迁移路径。
3. 验证活跃/归档转换，并使重复归档请求具有确定性，且不会删除历史 Resource 数据。
4. 为重要的创建、更新和归档变更调用 Feature #30 的来源端口，包括适用时的执行者/原因以及前后事实。
5. 公开与传输无关的请求/响应契约和错误映射，供未来的 CLI、API 或 UI 适配器消费。

## 验收标准

- [ ] 用户可以通过应用用例创建、读取、更新、归档和过滤 Resource 条目。
- [ ] 每个命令都会重新验证规范小数、单位、行为和必填字段不变量。
- [ ] 改变语义的更新不能静默重新解释现有的预算、分配或用量数量。
- [ ] 归档是历史性的而非破坏性的，归档后的 Resource 仍保持可查询。
- [ ] 重要变更通过共享的来源契约发出来源记录。
- [ ] 命令契约保持独立于特定框架或传输方式。

## 测试

- 使用模拟端口和存储适配器测试成功与失败的创建/更新/归档命令路径。
- 测试空操作/幂等归档行为以及活跃/归档查询。
- 测试关联金额会阻止不兼容的单位或精度更改，并且只有在已提交的变更上才会发出来源记录。

## 依赖

- #49，任务：为资源数量和目录不变量建模。
- #51，任务：持久化并查询资源目录条目。
- Feature #30：为核心实体变更捕获数据来源。

## 排除范围

- 在各单位之间迁移现有数量。
- 项目预算、任务分配、消耗、通用会计、计费和资源调度。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| provide | 提供 | Provide application commands to create, read, update, and archive Resources. |
| prevent | 防止 | Prevent unit reinterpretation. |
| emit | 发出、生成 | Emit the required provenance evidence. |
| inspect | 检查 | Inspect logically related budget, allocation, and usage data. |
| reject | 拒绝 | Reject changes that would silently reinterpret existing amounts. |
| require | 要求 | Require an explicit safe migration path. |
| validate | 验证 | Validate active/archive transitions. |
| invoke | 调用 | Invoke Feature #30's provenance port. |
| expose | 暴露、公开 | Expose transport-neutral request/response contracts. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| application commands | 应用命令 | provide application commands |
| unit reinterpretation | 单位重新解释 | prevent unit reinterpretation |
| provenance evidence | 来源证据 | emit the required provenance evidence |
| logically related | 逻辑相关的 | inspect logically related data |
| safe migration path | 安全迁移路径 | require an explicit safe migration path |
| active/archive transitions | 活跃/归档转换 | validate active/archive transitions |
| repeat archive requests | 重复归档请求 | make repeat archive requests deterministic |
| transport-neutral contracts | 与传输无关的契约 | expose transport-neutral contracts |
| error mappings | 错误映射 | error mappings for adapters |
| committed mutations | 已提交的变更 | provenance is emitted only for committed mutations |

### 值得模仿的句式
1. **“Provide application commands to create, read, update, and archive X while preventing Y and emitting Z.”** — “提供用于创建、读取、更新和归档 X 的应用命令，同时防止 Y 并生成 Z。” — *Provide application commands to create, read, update, and archive Resources while preventing unit reinterpretation and emitting the required provenance evidence.*
2. **“On updates to ..., inspect ... through ports; reject changes that would silently reinterpret ..., or require ...”** — “在更新……时，通过端口检查……；拒绝会静默重新解释……的更改，或要求……” — *On updates to unit, resource type, behavior, or precision policy, inspect logically related budget, allocation, and usage data through ports; reject changes that would silently reinterpret existing amounts, or require an explicit safe migration path owned by later work.*
3. **“Archive is historical rather than destructive, and archived X remain queryable.”** — “归档是历史性的而非破坏性的，并且归档后的 X 仍保持可查询。” — *Archive is historical rather than destructive, and archived Resources remain queryable.*

### 领域词汇
| English | 中文 |
|---|---|
| application command | 应用命令 |
| unit reinterpretation | 单位重新解释 |
| provenance evidence | 来源证据 |
| active/archive transition | 活跃/归档转换 |
| migration path | 迁移路径 |
| transport-neutral contract | 与传输无关的契约 |
| error mapping | 错误映射 |
| committed mutation | 已提交的变更 |
| semantics-changing update | 改变语义的更新 |
| idempotent archive | 幂等归档 |

---

## 4. 小练习

1. Application commands must create, read, update, and archive Resources while preventing unit ______.
2. On semantics-changing updates, we ______ changes that would silently reinterpret existing amounts.
3. Archive should be historical rather than ______.
4. Important mutations emit provenance through the shared provenance ______.
5. Command contracts should remain independent of a particular framework or ______.

<details>
<summary>点击查看答案</summary>

1. reinterpretation  
2. reject  
3. destructive  
4. contract  
5. transport

</details>
