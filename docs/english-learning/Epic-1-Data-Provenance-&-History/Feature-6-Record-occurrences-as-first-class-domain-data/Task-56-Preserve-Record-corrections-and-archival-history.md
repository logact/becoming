# Issue #56: Task: Preserve Record corrections and archival history

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Record occurrences as first-class domain data (#6)

---

## 1. Original English

Parent Feature: #6 — Feature: Record occurrences as first-class domain data

## Outcome

Users can correct or archive a Record without erasing the occurrence originally captured, preserving an append-oriented and inspectable history.

## Implementation plan

1. Define an explicit correction command that appends a `correction` Record containing the target Record ID, actor, time, changed fields, and relevant before/after values rather than silently overwriting the original occurrence.
2. Link the correction to the original Record through the semantic-relation application boundary, committing the correction Record and its link atomically while keeping both endpoints in the independent `records` table.
3. Implement archive behavior by setting `archived_at` and retaining the Record row, with an explicit idempotency/error contract for repeated archival; prohibit ordinary physical deletion.
4. Add read behavior that exposes original facts and their corrections to authorized history consumers without replacing the stored original.

## Acceptance criteria

- [ ] A correction is an explicit appended Record and the original Record's occurrence data remains inspectable.
- [ ] Correction payloads preserve the relevant before/after values, actor, and event time without copying unrelated or sensitive fields.
- [ ] A correction and its semantic link to the corrected Record succeed or fail as one application operation.
- [ ] Archiving retains the Record and distinguishes active from archived data through `archived_at`.
- [ ] Ordinary application operations cannot physically delete an occurrence or correction Record.
- [ ] Repeated archive requests follow a documented idempotent or explicit-error contract.

## Tests

- Unit-test correction payload construction, allowed correctable fields, and sensitive-field filtering.
- Integration-test atomic correction Record plus relation creation, including rollback on either failure.
- Test archival retention, repeated archival behavior, and rejection of ordinary destructive deletion.
- Test that both the original and correction remain retrievable by an authorized history query.

## Dependencies

- Parent Feature #6.
- Task: Establish the Record domain model and persistence.
- Feature #19 — Create and validate semantic relations, for the logical Record-to-Record correction link; no database foreign key may be introduced.

## Out of scope

- General automatic provenance for mutations (Feature #30).
- Timeline aggregation across arbitrary entities.
- Authorization policy design beyond honoring the caller's archive visibility decision.

---

## 2. 中文翻译

父功能：#6 — 功能：将发生记录作为一等领域数据

## 成果

用户可以修正或归档记录，而不会擦除最初捕获的发生信息，从而保留追加导向且可检查的历史。

## 实施计划

1. 定义显式的修正命令，追加一条 `correction` 记录，包含目标记录 ID、行为者、时间、变更字段以及相关的前后值，而不是默默地覆盖原始发生记录。
2. 通过语义关系应用边界将修正链接到原始记录，原子性地提交修正记录及其链接，同时使两个端点保持在独立的 `records` 表中。
3. 通过设置 `archived_at` 并保留记录行来实现归档行为，对重复归档有显式的幂等/错误合同；禁止普通物理删除。
4. 添加读取行为，向授权历史消费者公开原始事实及其修正，而不替换存储的原始记录。

## 验收标准

- [ ] 修正是显式追加的记录，原始记录的发生数据保持可检查。
- [ ] 修正载荷保留相关的前后值、行为者和事件时间，不复制无关或敏感字段。
- [ ] 修正及其到被修正记录的语义链接作为一个应用操作成功或失败。
- [ ] 归档保留记录并通过 `archived_at` 区分活动数据与归档数据。
- [ ] 普通应用操作无法物理删除发生记录或修正记录。
- [ ] 重复归档请求遵循文档化的幂等或显式错误合同。

## 测试

- 对修正载荷构建、允许的可修正字段和敏感字段过滤进行单元测试。
- 对原子性修正记录加关系创建进行集成测试，包括任一失败时的回滚。
- 测试归档保留、重复归档行为以及拒绝普通破坏性删除。
- 测试原始记录和修正都可通过授权历史查询检索。

## 依赖

- 父功能 #6。
- 任务：建立记录领域模型和持久化。
- 功能 #19 — 创建并验证语义关系，用于逻辑上的记录到记录修正链接；不得引入数据库外键。

## 范围外

- 变更的通用自动来源（功能 #30）。
- 跨任意实体的时间线聚合。
- 除遵守调用者的归档可见性决策之外的授权策略设计。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| correct | 修正 | Users can correct or archive a Record. |
| archive | 归档 | ...without erasing the occurrence originally captured. |
| preserve | 保留 | ...preserving an append-oriented and inspectable history. |
| append | 追加 | Define an explicit correction command that appends a `correction` Record. |
| link | 链接 | Link the correction to the original Record through the semantic-relation boundary. |
| retain | 保留 | Implement archive behavior by setting `archived_at` and retaining the Record row. |
| distinguish | 区分 | ...distinguishes active from archived data through `archived_at`. |
| prohibit | 禁止 | Prohibit ordinary physical deletion. |
| submit | 提交 | ...committing the correction Record and its link atomically. |
| expose | 暴露 | Add read behavior that exposes original facts and their corrections. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| Record corrections | 记录修正 | 对已有记录的修正操作 |
| archival history | 归档历史 | 归档操作和相关历史 |
| first-class domain data | 一等领域数据 | 与核心实体同等重要的数据 |
| append-oriented history | 追加导向的历史 | 只追加不修改的历史 |
| correction Record | 修正记录 | 表示修正的来源记录 |
| target Record ID | 目标记录 ID | 被修正记录的标识符 |
| original occurrence | 原始发生记录 | 最初捕获的事件记录 |
| semantic link | 语义链接 | 通过语义关系建立的链接 |
| archived_at | 归档时间字段 | 表示归档时间的时间戳 |
| idempotency contract | 幂等性合同 | 重复操作的处理约定 |
| physical deletion | 物理删除 | 从存储中真正删除 |
| authorized history query | 授权历史查询 | 有权限的历史查询 |

### 值得模仿的句式
1. **“Users can correct or archive a Record without erasing the occurrence originally captured...”** — 用户可以修正或归档记录，而不会擦除最初捕获的发生信息... — 例句：Users can correct or archive a note without erasing the original text.
2. **“...rather than silently overwriting the original occurrence.”** — ...而不是默默地覆盖原始发生记录。 — 例句：Append a correction rather than silently overwriting the original value.
3. **“...committing the correction Record and its link atomically...”** — ...原子性地提交修正记录及其链接... — 例句：Commit the update and its audit entry atomically.

### 领域词汇
| English | 中文 |
|---|---|
| Correction | 修正 |
| Archival | 归档 |
| Append-oriented | 追加导向的 |
| Occurrence data | 发生数据 |
| Semantic link | 语义链接 |
| Idempotency | 幂等性 |
| Physical deletion | 物理删除 |
| Authorized history query | 授权历史查询 |
| Sensitive field | 敏感字段 |
| Archive visibility | 归档可见性 |

---

## 4. 小练习

1. Users can correct or archive a Record without ______ the occurrence originally captured.
2. A correction appends a Record containing the target Record ID, actor, time, changed fields, and relevant before/after ______.
3. We link the correction to the original Record through the semantic-relation application ______.
4. Archive behavior sets `archived_at` and retains the Record row, with an explicit ______/error contract.
5. Ordinary application operations cannot physically delete an occurrence or ______ Record.

<details>
<summary>点击查看答案</summary>

1. erasing
2. values
3. boundary
4. idempotency
5. correction

</details>
