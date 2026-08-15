# Issue #27: Feature: Apply workflows to entities and initialize project machines

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Workflow & Lifecycle Management (#4)

---

## 1. Original English

## User outcome

Users can select the applicable reusable Workflow for managed work and initialize an independent lifecycle machine inside a Project.

## Scope

- Associate Workflows with Projects, Goals, Tasks, and other supported consumers through semantic relations.
- Resolve an applicable Workflow by purpose, entity type, label, Project context, and version.
- Copy selected Workflow States and transitions into Project States and transitions.
- Preserve source Workflow State and transition IDs as provenance.
- Perform initialization atomically.

## Acceptance criteria

- Applicable Workflows are referenced outside consumer entity tables.
- Applying a Workflow version yields the expected Project machine for each configured entity-type/label combination.
- All copied states and transitions belong to the target Project machine.
- Source template IDs are retained for provenance only.
- Missing, archived, ambiguous, or incompatible Workflows produce explicit errors.
- Partial initialization is rolled back.
- Applying the same Workflow twice follows an explicit idempotency or conflict policy.

## Dependencies

- Feature: Create and validate semantic relations.
- Feature: Define allowed workflow transitions and criteria.
- Feature: Manage projects and goal pursuit.

## Out of scope

- Silent synchronization after initialization.
- Runtime movement of entities between states.

Parent: #4

---

## 2. 中文翻译

## 用户收益

用户可以为受管工作选择适用的可复用工作流，并在项目内部初始化独立的生命周期机器。

## 范围

- 通过语义关系将工作流与项目、目标、任务和其他受支持的消费者关联。
- 按用途、实体类型、标签、项目上下文和版本解析适用的工作流。
- 将选定的工作流状态和转换复制到项目状态和转换中。
- 保留源工作流状态和转换 ID 作为溯源信息。
- 原子地执行初始化。

## 验收标准

- 适用的工作流在消费者实体表之外引用。
- 应用工作流版本会为每个配置的实体类型/标签组合生成预期的项目机器。
- 所有复制状态和转换都属于目标项目机器。
- 源模板 ID 仅作为溯源保留。
- 缺失、已归档、模糊或不兼容的工作流产生显式错误。
- 部分初始化会回滚。
- 重复应用同一工作流遵循显式的幂等或冲突策略。

## 依赖

- 特性：创建并验证语义关系。
- 特性：定义允许的工作流转换和标准。
- 特性：管理项目和目标追求。

## 范围外

- 初始化后的静默同步。
- 实体在状态之间的运行时移动。

父问题：#4

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Feature: Define allowed workflow transitions and criteria. |
| associate | 关联 | Associate Workflows with Projects, Goals, Tasks, and other supported consumers through semantic relations. |
| initialize | 初始化 | Users can select the applicable reusable Workflow for managed work and initialize an independent lifecycle machine inside a Project. |
| validate | 验证 | Feature: Create and validate semantic relations. |
| copy | 复制 | Copy selected Workflow States and transitions into Project States and transitions. |
| preserve | 保留 | Preserve source Workflow State and transition IDs as provenance. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| source template | 源模板 | Source template IDs are retained for provenance only. |
| semantic relations | 语义关系 | Associate Workflows with Projects, Goals, Tasks, and other supported consumers through semantic relations. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Lifecycle | 生命周期 |
| Transition | 转换/迁移 |
| Provenance | 溯源 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Template | 模板 |
| Idempotency | 幂等性 |

---

## 4. 小练习

1. Every material mutation should emit structured _______ in the same transaction.
2. Lifecycle transitions must be committed _______ to keep history consistent.
3. Applying a Workflow _______ its state templates into independent Project States.
4. Projects can reference an _______ to govern their lifecycle.
5. Workflow applicability is expressed through _______, not foreign-key columns.

<details>
<summary>点击查看答案</summary>

1. provenance
2. atomically
3. copies
4. applicable workflow
5. semantic relations

</details>
