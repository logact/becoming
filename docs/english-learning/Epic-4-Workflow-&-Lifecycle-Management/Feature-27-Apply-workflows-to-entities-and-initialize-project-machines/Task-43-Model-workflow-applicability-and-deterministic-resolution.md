# Issue #43: Task: Model workflow applicability and deterministic resolution

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Apply workflows to entities and initialize project machines (#27)

---

## 1. Original English

Parent Feature: #27

## Outcome

Projects and managed entities reference applicable Workflows through semantic relations, and the application can resolve one compatible version deterministically.

## Implementation plan

1. Define relation semantics and metadata for Workflow applicability by Project context, consumer/purpose, entity type, management Label, and selected version without adding workflow IDs to consumer tables.
2. Implement commands to create/end applicability relations using the semantic relation validation layer.
3. Implement a resolver that filters active relations and definitions, validates entity-type/Label compatibility, and returns explicit missing, archived, ambiguous, or incompatible errors.
4. Define deterministic exact-version/latest-version behavior and historical relation handling.

## Acceptance criteria

- [ ] Applicable Workflows are referenced outside Project, Goal, Task, and other consumer entity tables.
- [ ] Resolution accounts for purpose, entity type, Label, Project context, and version.
- [ ] Missing, archived, ambiguous, and incompatible candidates produce distinct domain outcomes.
- [ ] Ended applicability relations are not used for new initialization but remain historically queryable.
- [ ] Resolution never silently selects among ambiguous candidates.

## Tests

- Relation command tests for supported consumer types and logical-reference failures.
- Resolver matrix tests for every filter and error outcome.
- Historical relation test proving ended links remain inspectable.

## Dependencies

- Feature #19 semantic relations.
- Feature #20 Projects and Goal pursuit.
- Features #23-#26 reusable Workflow machines.

## Out of scope

- Copying templates into a Project.
- Automatic applicability inference.
- Embedding workflow IDs on consumer tables.

---

## 2. 中文翻译

父特性：#27

## 预期成果

项目和管理实体通过语义关系引用适用的工作流，应用可以确定性解析出一个兼容版本。

## 实现计划

1. 按项目上下文、消费者/用途、实体类型、管理标签和选定版本定义工作流适用性的关系语义和元数据，而不在消费者表中添加工作流 ID。
2. 使用语义关系验证层实现创建/结束适用性关系的命令。
3. 实现解析器：过滤活跃关系和定义，验证实体类型/标签兼容性，并返回显式的缺失、已归档、模糊或不兼容错误。
4. 定义确定性的精确版本/最新版本行为以及历史关系处理。

## 验收标准

- [ ] 适用的工作流在项目、目标、任务和其他消费者实体表之外引用。
- [ ] 解析会考虑用途、实体类型、标签、项目上下文和版本。
- [ ] 缺失、已归档、模糊和不兼容候选产生不同的领域结果。
- [ ] 已结束的适用性关系不用于新初始化，但仍可在历史上查询。
- [ ] 解析不会在模糊候选之间静默选择。

## 测试

- 受支持消费者类型和逻辑引用失败的关系命令测试。
- 每个过滤器和错误结果的解析器矩阵测试。
- 证明已结束链接仍可检查的历史关系测试。

## 依赖

- 特性 #19 语义关系。
- 特性 #20 项目和目标追求。
- 特性 #23-#26 可复用工作流机器。

## 范围外

- 将模板复制到项目中。
- 自动适用性推断。
- 在消费者表上嵌入工作流 ID。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define relation semantics and metadata for Workflow applicability by Project context, consumer/purpose, entity type, management Label, and selected version without adding workfl... |
| reference | 引用 | Projects and managed entities reference applicable Workflows through semantic relations, and the application can resolve one compatible version deterministically. |
| scope | 限定范围 | Scope Project States by project_id + entity_type + label_id. |
| end | 结束 | Implement commands to create/end applicability relations using the semantic relation validation layer. |
| implement | 实现 | Implement commands to create/end applicability relations using the semantic relation validation layer. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| semantic relations | 语义关系 | Projects and managed entities reference applicable Workflows through semantic relations, and the application can resolve one compatible version deterministically. |
| allowed transitions | 允许的转换 | Allowed transitions between lifecycle states are explicit. |
| invalid transitions | 无效的转换 | Invalid transitions are rejected by the engine. |
| workflow versioning | 工作流版本管理 | Support workflow versioning over time. |
| state machine integrity | 状态机完整性 | Enforce workflow state machine integrity. |

### 值得模仿的句式
1. **Define reusable rules for how ... are decomposed, executed, and moved through their lifecycle.** — 定义……如何被分解、执行并在其生命周期中推进的可复用规则。 — 例句：Define reusable rules for how Tasks are executed.
2. **A workflow can define ... and ...** — 工作流可以定义……和…… — 例句：A workflow can define decomposition rules and lifecycle states.
3. **... changes do not silently rewrite historical execution records.** — ……的变更不会悄悄改写历史执行记录。 — 例句：Workflow changes do not silently rewrite historical execution records.

### 领域词汇
| English | 中文 |
|---|---|
| Workflow | 工作流 |
| Acceptance criteria | 验收标准 |
| Label | 标签 |
| Semantic relation | 语义关系 |
| Lifecycle | 生命周期 |

---

## 4. 小练习

1. Archiving a Workflow must not invalidate historical project _______.
2. Workflow discovery must return _______ results when multiple candidates match.
3. Applying a Workflow _______ its state templates into independent Project States.
4. Projects can reference an _______ to govern their lifecycle.
5. Workflow applicability is expressed through _______, not foreign-key columns.

<details>
<summary>点击查看答案</summary>

1. execution
2. deterministic
3. copies
4. applicable workflow
5. semantic relations

</details>
