# Issue #89: Task: Implement Goal mutation commands with provenance

**Labels:** task  
**State:** CLOSED  
**Parent:** #17: Feature: Manage goals and success criteria

---

## 1. Original English

Parent Feature: #17 — Feature: Manage goals and success criteria

## Outcome

Application commands create, update, and archive Goals with correct timestamp semantics and atomic structured provenance.

## Implementation plan

1. Implement create-Goal using validated domain values and an injected clock/ID source; assign equal initial `created_at` and `updated_at` and leave `archived_at` empty.
2. Implement intrinsic updates for title, description, target state, and success criteria, changing `updated_at` while preserving `created_at`.
3. Implement archive as setting `archived_at` without deleting the Goal; define deterministic repeated-archive behavior and keep restoration out unless separately authorized.
4. Integrate create, update, and archive with the #30 provenance port so records identify Goal ID, action, actor, event time, and relevant before/after values in the same unit of work.

## Acceptance criteria

- [ ] Create rejects missing title or target state and persists no partial Goal or provenance.
- [ ] Updates preserve `created_at`, advance `updated_at`, and round-trip optional description and success criteria.
- [ ] Archive sets `archived_at` and preserves all intrinsic Goal data.
- [ ] Repeated archive behavior is explicit, deterministic, and tested.
- [ ] Important create, update, and archive mutations emit structured provenance with Goal identity, actor, action, and time.
- [ ] A mutation or provenance failure rolls back the entire application operation.

## Tests

- Command tests for minimal/full create, each intrinsic update, invalid values, archive, and repeated archive.
- Clock tests proving `created_at` stability and `updated_at`/`archived_at` behavior.
- Transaction tests with injected Goal-store and provenance failures.
- Provenance payload tests that include relevant before/after values and omit unrelated data.

## Dependencies

- Parent Feature: #17.
- Depends on Task: Define Goal domain and persistence boundary.

---

## 2. 中文翻译

父级 Feature：#17 —— 管理目标与成功标准

## 结果

应用命令使用经过验证的领域值创建、更新和归档 Goal，并具有正确的时间戳语义和原子化的结构化来源追溯。

## 实施计划

1. 使用经过验证的领域值和注入的时钟/ID 源实现 Goal 创建；将初始 `created_at` 和 `updated_at` 设为相同值，`archived_at` 留空。
2. 实现对标题、描述、目标状态和成功标准的内在更新，在保留 `created_at` 的同时修改 `updated_at`。
3. 将归档实现为设置 `archived_at`，而不删除 Goal；定义重复归档的确定性行为，并在未单独授权的情况下保持恢复操作不开放。
4. 将创建、更新和归档与 #30 来源追溯端口集成，使记录能在同一工作单元中识别 Goal ID、操作、执行者、事件时间以及相关的前后值。

## 验收标准

- [ ] 创建操作会拒绝缺少标题或目标状态的情况，不会持久化部分 Goal 或来源追溯。
- [ ] 更新保留 `created_at`，推进 `updated_at`，并保留可选描述和成功标准。
- [ ] 归档设置 `archived_at` 并保留所有 Goal 内在数据。
- [ ] 重复归档行为是明确、确定且经过测试的。
- [ ] 重要的创建、更新和归档变更会发出包含 Goal 标识、执行者、操作和时间的结构化来源追溯。
- [ ] 变更或来源追溯失败会回滚整个应用操作。

## 测试

- 针对最小/完整创建、每项内在更新、无效值、归档和重复归档的命令测试。
- 证明 `created_at` 稳定性和 `updated_at`/`archived_at` 行为的时钟测试。
- 使用注入的 Goal 存储和来源追溯失败的测试进行事务测试。
- 来源追溯负载测试，包含相关的前后值并省略无关数据。

## 依赖

- 父级 Feature：#17。
- 依赖任务：定义 Goal 领域和持久化边界。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| create | 创建 | Implement create-Goal using validated domain values |
| update | 更新 | Implement intrinsic updates for title, description |
| archive | 归档 | Implement archive as setting archived_at |
| preserve | 保留 | preserving created_at |
| advance | 推进 | advance updated_at |
| integrate | 集成 | Integrate create, update, and archive with the #30 provenance port |
| rollback | 回滚 | A mutation or provenance failure rolls back the entire operation |
| reject | 拒绝 | Create rejects missing title or target state |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| timestamp semantics | 时间戳语义 | correct timestamp semantics |
| atomic structured provenance | 原子化结构化来源追溯 | atomic structured provenance |
| injected clock/ID source | 注入的时钟/ID 源 | injected clock/ID source |
| intrinsic updates | 内在更新 | intrinsic updates for title, description |
| repeated archive | 重复归档 | deterministic repeated-archive behavior |
| unit of work | 工作单元 | in the same unit of work |
| before/after values | 前后值 | relevant before/after values |
| transaction rollback | 事务回滚 | transaction rollback tests |

### 值得模仿的句式
1. **"Implement A as B without C; define deterministic repeated-A behavior."** — 将 A 实现为 B 而不进行 C；定义重复 A 的确定性行为。 — Implement archive as setting archived_at without deleting the Goal; define deterministic repeated-archive behavior.
2. **"Important ... mutations emit structured provenance with ..."** — 重要的……变更会发出包含……的结构化来源追溯。 — Important create, update, and archive mutations emit structured provenance with Goal identity, actor, action, and time.
3. **"A or B failure rolls back the entire C."** — A 或 B 失败会回滚整个 C。 — A mutation or provenance failure rolls back the entire application operation.

### 领域词汇
| English | 中文 |
|---|---|
| Command | 命令 |
| Provenance | 来源追溯 |
| Clock | 时钟 |
| Idempotency | 幂等性 |
| Transaction | 事务 |
| Rollback | 回滚 |
| Timestamp | 时间戳 |
| Unit of work | 工作单元 |
| Actor | 执行者 |

---

## 4. 小练习

1. Implement create-Goal using validated domain values and an injected clock/______ source.
2. Archive is implemented as setting ______ without deleting the Goal.
3. Updates preserve created_at and ______ updated_at.
4. A mutation or provenance failure ______ the entire application operation.
5. Important mutations emit ______ provenance with Goal identity, actor, action, and time.

<details>
<summary>点击查看答案</summary>

1. ID
2. archived_at
3. advance
4. rolls back
5. structured
</details>
