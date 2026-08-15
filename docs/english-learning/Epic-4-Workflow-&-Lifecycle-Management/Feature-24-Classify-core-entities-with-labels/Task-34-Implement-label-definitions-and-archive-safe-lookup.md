# Issue #34: Task: Implement label definitions and archive-safe lookup

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Classify core entities with labels (#24)

---

## 1. Original English

Parent Feature: #24

## Outcome

Labels are durable supporting concepts that can be managed independently of core entities and remain historically resolvable after archival.

## Implementation plan

1. Define Label domain values and an explicit name-normalization/uniqueness policy, including required name, optional description, timestamps, and archive state.
2. Add `labels` persistence and repository contracts for create, get, update, archive, list-active, and historical lookup, without database foreign keys.
3. Implement commands and queries with explicit duplicate-name, invalid-input, not-found, and archived-definition behavior.
4. Provide the transaction hooks needed for label-definition provenance without coupling Labels to semantic `relations`.

## Acceptance criteria

- [ ] Label definitions can be created, read, updated, archived, and listed.
- [ ] The documented normalization policy deterministically detects active duplicate names.
- [ ] Archived labels are excluded from active discovery but resolvable by ID in historical queries.
- [ ] Optional descriptions and timestamps round-trip correctly.
- [ ] No `entities` table or database foreign key is introduced.

## Tests

- Domain tests for normalization, required names, duplicates, and archive semantics.
- Repository contract tests for CRUD, active filtering, historical lookup, and deterministic ordering.
- Migration/schema verification tests for `labels`.

## Dependencies

- Feature #24.
- Feature #30 for mutation provenance integration.

## Out of scope

- Assigning labels to entities.
- Hierarchical labels.
- Label-based authorization.

---

## 2. 中文翻译

父特性：#24

## 预期成果

标签是持久的辅助概念，可以独立于核心实体进行管理，并在归档后仍可在历史上解析。

## 实现计划

1. 定义标签领域值和显式的名称规范化/唯一性策略，包括必填名称、可选描述、时间戳和归档状态。
2. 添加 `labels` 持久化和仓库契约，支持创建、获取、更新、归档、列出活跃和历史查询，不包含数据库外键。
3. 实现命令和查询，具有显式的重复名称、无效输入、未找到和已归档定义行为。
4. 提供标签定义溯源所需的事务钩子，同时不将标签与语义 `relations` 耦合。

## 验收标准

- [ ] 可以创建、读取、更新、归档和列出标签定义。
- [ ] 文档化的规范化策略可以确定性检测活跃的重复名称。
- [ ] 已归档标签从活跃发现中排除，但可以在历史查询中按 ID 解析。
- [ ] 可选描述和时间戳正确无损往返。
- [ ] 不引入 `entities` 表或数据库外键。

## 测试

- 规范化、必填名称、重复项和归档语义的领域测试。
- CRUD、活跃过滤、历史查询和确定性排序的仓库契约测试。
- `labels` 的迁移/模式验证测试。

## 依赖

- 特性 #24。
- 特性 #30 用于变更溯源集成。

## 范围外

- 将标签分配给实体。
- 层级标签。
- 基于标签的授权。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define Label domain values and an explicit name-normalization/uniqueness policy, including required name, optional description, timestamps, and archive state. |
| archive | 归档 | Define Label domain values and an explicit name-normalization/uniqueness policy, including required name, optional description, timestamps, and archive state. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| implement | 实现 | Implement commands and queries with explicit duplicate-name, invalid-input, not-found, and archived-definition behavior. |
| add | 添加 | Add labels persistence and repository contracts for create, get, update, archive, list-active, and historical lookup, without database foreign keys. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |
| domain entities | 领域实体 | Workflows are first-class domain entities. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Provenance | 溯源 |
| Persistence | 持久化 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Workflow | 工作流 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Archiving a Workflow must not invalidate historical project _______.
3. Workflow discovery must return _______ results when multiple candidates match.

<details>
<summary>点击查看答案</summary>

1. provenance
2. execution
3. deterministic

</details>
