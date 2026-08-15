# Issue #74: Task: Implement policy-validated relation create and end operations

**Labels:** task  
**State:** CLOSED  
**Parent:** #19: Feature: Create and validate semantic relations

---

## 1. Original English

Parent Feature: #19 — Feature: Create and validate semantic relations

## Outcome

Application operations create and end semantic relations atomically while enforcing endpoint, direction, metadata, and active-cardinality policies and preserving relationship history.

## Implementation plan

1. Implement a create-relation command that resolves both typed endpoints, selects the relation policy, validates direction and metadata, and checks active cardinality before persistence.
2. Define the active-duplicate identity used by each policy and reject disallowed duplicate active relations while allowing historical ended rows.
3. Implement end-relation as an update that sets `ended_at`; define a documented idempotency contract for an already-ended relation and forbid ordinary hard deletion.
4. Integrate relation create/end with the provenance/unit-of-work boundary so relationship changes can identify both endpoints, relation type, metadata, actor, and event time without leaving partial state.

## Acceptance criteria

- [ ] A relation is created only when both typed endpoints exist and a matching domain policy permits its exact direction.
- [ ] Invalid type, direction, endpoint, cardinality, or metadata failures are distinct application/domain errors and persist nothing.
- [ ] Duplicate active relationships are rejected wherever the selected policy disallows them.
- [ ] Ending a relation sets `ended_at` and preserves the original row, endpoints, direction, metadata, and `created_at`.
- [ ] The already-ended behavior is explicit, deterministic, and tested.
- [ ] Relation and provenance writes share one atomic operation; either both succeed or neither does when provenance integration is available.
- [ ] No database foreign keys or database triggers substitute for application/domain logical validation.

## Tests

- Command tests for each validation failure, allowed many-to-many relations, and policy-specific active duplicates.
- Tests for ending, repeated ending, and re-establishing a relation after it has ended.
- Transaction/provenance payload tests and concurrency tests for competing duplicate starts.
- Schema guards proving no membership/relation columns in entity tables.

## Dependencies

- Parent Feature: #19.
- Depends on Task: Define relation domain and logical integrity contracts.
- Depends on #5 relationship-change provenance and #30 core-mutation provenance conventions.

---

## 2. 中文翻译

父级 Feature：#19 —— 创建并验证语义关系

## 结果

应用操作以原子方式创建和结束语义关系，同时强制执行端点、方向、元数据和活动基数策略，并保留关系历史。

## 实施计划

1. 实现创建关系命令，解析两个带类型的端点，选择关系策略，验证方向和元数据，并在持久化前检查活动基数。
2. 定义每种策略使用的活动重复标识，拒绝不允许的重复活动关系，同时允许历史已结束行。
3. 将结束关系实现为设置 `ended_at` 的更新；为已结束关系定义文档化的幂等性约定，并禁止普通的硬删除。
4. 将关系创建/结束与来源追溯/工作单元边界集成，使关系变更能够识别两个端点、关系类型、元数据、执行者和事件时间，而不会留下部分状态。

## 验收标准

- [ ] 只有当两个带类型的端点存在且匹配的域策略允许其精确方向时，才创建关系。
- [ ] 无效类型、方向、端点、基数或元数据失败是不同的应用/领域错误，并且不会持久化任何内容。
- [ ] 在所选策略不允许的情况下，重复活动关系会被拒绝。
- [ ] 结束关系会设置 `ended_at`，并保留原始行、端点、方向、元数据和 `created_at`。
- [ ] 已结束行为是明确、确定且经过测试的。
- [ ] 关系和来源追溯写入共享一个原子操作；当来源追溯集成可用时，要么两者都成功，要么两者都不成功。
- [ ] 没有数据库外键或数据库触发器替代应用/领域逻辑验证。

## 测试

- 针对每种验证失败、允许的_many-to-many_关系以及策略特定的活动重复的命令测试。
- 针对结束、重复结束和关系结束后重新建立的测试。
- 事务/来源追溯负载测试以及针对竞争重复开始的并发测试。
- 证明实体表中没有成员关系/关系列的模式防护测试。

## 依赖

- 父级 Feature：#19。
- 依赖任务：定义关系领域和逻辑完整性约定。
- 依赖 #5 关系变更来源追溯和 #30 核心变更来源追溯约定。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| enforce | 强制执行 | enforcing endpoint, direction, metadata policies |
| resolve | 解析 | resolves both typed endpoints |
| validate | 验证 | validates direction and metadata |
| reject | 拒绝 | reject disallowed duplicate active relations |
| preserve | 保留 | preserving relationship history |
| forbid | 禁止 | forbid ordinary hard deletion |
| integrate | 集成 | Integrate relation create/end with the provenance boundary |
| substitute | 替代 | No database foreign keys substitute for logical validation |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| active-cardinality policy | 活动基数策略 | active-cardinality policies |
| duplicate active relation | 重复活动关系 | duplicate active relations |
| already-ended behavior | 已结束行为 | idempotency contract for an already-ended relation |
| hard deletion | 硬删除 | forbid ordinary hard deletion |
| unit-of-work boundary | 工作单元边界 | provenance/unit-of-work boundary |
| partial state | 部分状态 | without leaving partial state |
| competing duplicate starts | 竞争的重复开始 | concurrency tests for competing duplicate starts |
| schema guards | 模式防护 | Schema guards proving no membership columns |

### 值得模仿的句式
1. **"A create and end B atomically while enforcing C and preserving D."** — A 以原子方式创建和结束 B，同时强制执行 C 并保留 D。 — Application operations create and end semantic relations atomically while enforcing endpoint, direction, metadata, and active-cardinality policies and preserving relationship history.
2. **"A is created only when B exist and C permits its exact D."** — 只有当 B 存在且 C 允许其精确的 D 时，才创建 A。 — A relation is created only when both typed endpoints exist and a matching domain policy permits its exact direction.
3. **"A and B share one atomic operation; either both succeed or neither does."** — A 和 B 共享一个原子操作；要么都成功，要么都不成功。 — Relation and provenance writes share one atomic operation; either both succeed or neither does.

### 领域词汇
| English | 中文 |
|---|---|
| Relation | 关系 |
| Policy | 策略 |
| Cardinality | 基数 |
| Idempotency | 幂等性 |
| Atomic operation | 原子操作 |
| Provenance | 来源追溯 |
| Endpoint | 端点 |
| Metadata | 元数据 |
| Hard deletion | 硬删除 |

---

## 4. 小练习

1. Application operations create and end semantic relations ______ while enforcing policies.
2. A relation is created only when both typed endpoints exist and a domain policy permits its exact ______.
3. Ending a relation sets ______ and preserves the original row.
4. The already-ended behavior must be explicit, deterministic, and ______.
5. Relation and provenance writes share one ______ operation.

<details>
<summary>点击查看答案</summary>

1. atomically
2. direction
3. ended_at
4. tested
5. atomic
</details>
