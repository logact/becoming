# Issue #60: Task: Capture update, archive, and restoration provenance

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Capture provenance for core entity mutations (#30)

---

## 1. Original English

Parent Feature: #30 — Feature: Capture provenance for core entity mutations

## Outcome

Material updates and archive/restoration operations for every core concept preserve a structured, redacted before/after audit trail without allowing current state and provenance to diverge.

## Implementation plan

1. Integrate the shared provenance wrapper with update and archive commands for Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record.
2. Read the pre-mutation entity, apply domain validation, persist the new current state, and append one action-specific provenance Record containing only material changed fields.
3. If restoration is supported by an entity's domain contract, record it as `restore` rather than `update`; define the behavior for no-op updates and repeated archive/restore requests.
4. Commit the current-state change and audit Record atomically, including rollback on concurrency conflicts or provenance persistence failure.
5. Keep archived entities and their provenance resolvable for authorized historical queries; do not rewrite or delete earlier Records.

## Acceptance criteria

- [ ] Updates to all eight supported core entity types record only relevant changed fields with before/after values.
- [ ] Successful archives for all eight types produce distinguishable `archive` provenance Records.
- [ ] Restoration, wherever supported, produces a distinguishable `restore` Record.
- [ ] No-op and repeated archive/restore requests follow an explicit contract and never create misleading duplicate success history.
- [ ] Failed mutations create no success Record, and provenance failures roll back the current-state mutation.
- [ ] Earlier provenance remains append-oriented and cannot be erased through ordinary mutation operations.

## Tests

- Use table-driven tests for update and archive across Task, Goal, Project, Idea, Philosophy, Workflow, Resource, and Record.
- Assert per-entity relevant before/after fields, omission of unchanged/sensitive fields, actor, action, and event time.
- Test restoration for every entity that supports it and the explicit unsupported result elsewhere.
- Inject validation, concurrency, current-state persistence, and provenance persistence failures and assert full rollback.
- Test no-op/repeated-operation semantics and historical visibility after archival.

## Dependencies

- Parent Feature #30.
- Task: Define the atomic core-mutation provenance contract.
- Task: Capture creation provenance for all core concepts.
- Update/archive application services for the eight core concept Features.

## Out of scope

- Physical deletion where the core domain does not explicitly support it.
- Relation and lifecycle-transition-specific provenance.
- Read-access auditing.

---

## 2. 中文翻译

父功能：#30 — 功能：为核心实体变更捕获来源信息

## 成果

每个核心概念的实质性更新以及归档/恢复操作保留结构化、编辑后的前后审计线索，不允许当前状态和来源分离。

## 实施计划

1. 将共享来源包装器与任务、目标、项目、想法、理念、工作流、资源和记录的更新和归档命令集成。
2. 读取变更前实体，应用领域验证，持久化新当前状态，并追加一条仅包含实质变更字段的特定操作来源记录。
3. 如果实体的领域合同支持恢复，则将其记录为 `restore` 而不是 `update`；定义无操作更新和重复归档/恢复请求的行为。
4. 原子性提交当前状态变更和审计记录，包括在并发冲突或来源持久化失败时回滚。
5. 使归档实体及其来源对授权历史查询可解析；不要重写或删除早期记录。

## 验收标准

- [ ] 所有八种支持的核心实体类型的更新仅记录相关变更字段的前后值。
- [ ] 所有八种类型的成功归档产生可区分的 `archive` 来源记录。
- [ ] 在支持恢复的地方，恢复产生可区分的 `restore` 记录。
- [ ] 无操作和重复归档/恢复请求遵循显式合同，从不会创建误导性的重复成功历史。
- [ ] 失败的变更不会创建成功记录，来源失败会回滚当前状态变更。
- [ ] 早期来源保持追加导向，无法通过普通变更操作擦除。

## 测试

- 对任务、目标、项目、想法、理念、工作流、资源和记录使用表驱动测试进行更新和归档。
- 断言每个实体的相关前后字段、未变更/敏感字段省略、行为者、操作和事件时间。
- 测试每个支持它的实体的恢复以及在其他地方的显式不支持结果。
- 注入验证、并发、当前状态持久化和来源持久化失败，并断言完全回滚。
- 测试无操作/重复操作语义和归档后的历史可见性。

## 依赖

- 父功能 #30。
- 任务：定义原子核心变更来源合同。
- 任务：为所有核心概念捕获创建来源。
- 八种核心概念功能的更新/归档应用服务。

## 范围外

- 核心领域未明确支持的物理删除。
- 关系和生命周期转换特定来源。
- 读取访问审计。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| update | 更新 | Capture update, archive, and restoration provenance. |
| archive | 归档 | Successful archives produce distinguishable `archive` provenance Records. |
| restore | 恢复 | Restoration produces a distinguishable `restore` Record. |
| preserve | 保留 | Preserve a structured, redacted before/after audit trail. |
| diverge | 分离 | Without allowing current state and provenance to diverge. |
| read | 读取 | Read the pre-mutation entity. |
| apply | 应用 | Apply domain validation. |
| distinguish | 区分 | Produce distinguishable `archive` and `restore` Records. |
| erase | 擦除 | Earlier provenance cannot be erased through ordinary mutation. |
| inject | 注入 | Inject validation, concurrency, and persistence failures. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| update/archive/restoration provenance | 更新/归档/恢复来源 | 不同操作的来源记录 |
| material updates | 实质性更新 | 有实质字段变化的更新 |
| redacted before/after audit trail | 编辑后的前后审计线索 | 隐藏敏感信息后的变更记录 |
| current-state mutation | 当前状态变更 | 对当前状态的修改 |
| no-op updates | 无操作更新 | 没有实质变化的更新 |
| repeated archive/restore requests | 重复归档/恢复请求 | 多次归档或恢复同一实体 |
| explicit contract | 显式合同 | 明确的行为约定 |
| misleading duplicate history | 误导性重复历史 | 看起来多次成功但实际重复的记录 |
| concurrency conflicts | 并发冲突 | 同时操作导致的冲突 |
| historical visibility | 历史可见性 | 历史记录的可见性 |

### 值得模仿的句式
1. **“Material updates and archive/restoration operations for every core concept preserve a structured, redacted before/after audit trail...”** — 每个核心概念的实质性更新以及归档/恢复操作保留结构化、编辑后的前后审计线索... — 例句：Material updates preserve a structured before/after audit trail.
2. **“...without allowing current state and provenance to diverge.”** — ...不允许当前状态和来源分离。 — 例句：Keep the cache and database in sync without allowing them to diverge.
3. **“No-op and repeated archive/restore requests follow an explicit contract and never create misleading duplicate success history.”** — 无操作和重复归档/恢复请求遵循显式合同，从不会创建误导性的重复成功历史。 — 例句：No-op and repeated requests follow an explicit idempotency contract.

### 领域词汇
| English | 中文 |
|---|---|
| Material update | 实质性更新 |
| Archive/restoration | 归档/恢复 |
| Before/after audit trail | 前后审计线索 |
| Current-state mutation | 当前状态变更 |
| No-op update | 无操作更新 |
| Misleading duplicate history | 误导性重复历史 |
| Concurrency conflict | 并发冲突 |
| Historical visibility | 历史可见性 |
| Action-specific | 特定于操作的 |
| Physical deletion | 物理删除 |

---

## 4. 小练习

1. Material updates and archive/restoration operations preserve a structured, ______ before/after audit trail.
2. We must not allow current state and provenance to ______.
3. If restoration is supported, record it as `restore` rather than `______`.
4. No-op and repeated archive/restore requests follow an explicit contract and never create misleading ______ success history.
5. Earlier provenance remains append-oriented and cannot be ______ through ordinary mutation operations.

<details>
<summary>点击查看答案</summary>

1. redacted
2. diverge
3. update
4. duplicate
5. erased

</details>
