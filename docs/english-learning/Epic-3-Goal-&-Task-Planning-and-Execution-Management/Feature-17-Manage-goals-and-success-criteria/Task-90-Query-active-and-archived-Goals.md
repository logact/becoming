# Issue #90: Task: Query active and archived Goals

**Labels:** task  
**State:** CLOSED  
**Parent:** #17: Feature: Manage goals and success criteria

---

## 1. Original English

Parent Feature: #17 — Feature: Manage goals and success criteria

## Outcome

Callers can retrieve a Goal and list current or archived Goals with deterministic, explicitly scoped query behavior.

## Implementation plan

1. Define framework-neutral query contracts for get-by-ID and paginated listing of Goal projections containing all intrinsic fields and timestamps.
2. Implement an active-list view that excludes rows with `archived_at` set by default.
3. Implement explicit archived/all-history filters so archived Goals remain inspectable without contaminating current views.
4. Add deterministic ordering and pagination tie-breaking, and document not-found versus archived visibility behavior.

## Acceptance criteria

- [ ] Get returns title, description, target state, success criteria, and all timestamps without loss.
- [ ] Active lists exclude archived Goals by default and never physically delete them.
- [ ] An explicit historical/all filter can include archived Goals.
- [ ] Get/list semantics for archived rows are documented and tested.
- [ ] Listing order and pagination are deterministic.
- [ ] Query projections do not synthesize project, hierarchy, workflow, state, label, or resource fields into Goal storage.

## Tests

- Query contract tests for minimal/full, active, archived, and mixed datasets.
- Tests for not-found and archived visibility contracts.
- Ordering and cursor/offset stability tests with equal timestamps.

## Dependencies

- Parent Feature: #17.
- Depends on Task: Define Goal domain and persistence boundary.
- Depends on Task: Implement Goal mutation commands with provenance for archive semantics.

## Out of scope

- Project pursuit and decomposition graph queries.
- Lifecycle state, progress, labels, or resource summaries.
- A specific transport or user interface.

---

## 2. 中文翻译

父级 Feature：#17 —— 管理目标与成功标准

## 结果

调用方可以获取单个 Goal，并以确定性、明确范围的行为列出当前或已归档的 Goal。

## 实施计划

1. 定义按 ID 获取和分页列出 Goal 投影的与框架无关的查询约定，投影包含所有内在字段和时间戳。
2. 实现默认排除已设置 `archived_at` 行的活动列表视图。
3. 实现明确的已归档/所有历史筛选器，使已归档 Goal 可在不污染当前视图的情况下被检查。
4. 添加确定性排序和分页断点，并记录“未找到”与归档可见性行为。

## 验收标准

- [ ] 获取操作返回标题、描述、目标状态、成功标准和所有时间戳，且不会丢失。
- [ ] 活动列表默认排除已归档 Goal，并且不会物理删除它们。
- [ ] 明确的历史/所有筛选器可以包含已归档 Goal。
- [ ] 已归档行的获取/列表语义已被记录并测试。
- [ ] 列表顺序和分页是确定性的。
- [ ] 查询投影不会将项目、层级、工作流、状态、标签或资源字段合成为 Goal 存储。

## 测试

- 针对最小/完整、活动、已归档和混合数据集的查询约定测试。
- 针对未找到和归档可见性约定的测试。
- 在时间戳相等的情况下进行排序和游标/偏移稳定性测试。

## 依赖

- 父级 Feature：#17。
- 依赖任务：定义 Goal 领域和持久化边界。
- 依赖任务：使用来源追溯实现 Goal 变更命令，以了解归档语义。

## 超出范围

- 项目追求和分解图查询。
- 生命周期状态、进度、标签或资源摘要。
- 特定传输层或用户界面。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| retrieve | 检索 | Callers can retrieve a Goal |
| list | 列出 | list current or archived Goals |
| exclude | 排除 | excludes rows with archived_at set by default |
| contaminate | 污染 | without contaminating current views |
| document | 记录、形成文档 | document not-found versus archived visibility behavior |
| synthesize | 合成 | do not synthesize project fields into Goal storage |
| filter | 过滤 | explicit archived/all filter |
| paginate | 分页 | paginated listing of Goal projections |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral query | 与框架无关的查询 | Define framework-neutral query contracts |
| active list | 活动列表 | active-list view |
| archived visibility | 归档可见性 | not-found versus archived visibility behavior |
| deterministic ordering | 确定性排序 | Add deterministic ordering and pagination |
| cursor/offset stability | 游标/偏移稳定性 | cursor/offset stability tests |
| mixed datasets | 混合数据集 | active, archived, and mixed datasets |
| projection | 投影 | Goal projections |
| read model | 读模型 | two framework-neutral read models |

### 值得模仿的句式
1. **"Callers can retrieve A and list B with C behavior."** — 调用方可以获取 A 并以 C 行为列出 B。 — Callers can retrieve a Goal and list current or archived Goals with deterministic, explicitly scoped query behavior.
2. **"A excludes B by default and never physically deletes them."** — A 默认排除 B，并且不会物理删除它们。 — Active lists exclude archived Goals by default and never physically delete them.
3. **"Results are deterministically ordered."** — 结果是确定性排序的。 — Results are deterministically ordered.

### 领域词汇
| English | 中文 |
|---|---|
| Query | 查询 |
| Projection | 投影 |
| Pagination | 分页 |
| Cursor | 游标 |
| Offset | 偏移 |
| Read model | 读模型 |
| Active list | 活动列表 |
| Archived visibility | 归档可见性 |
| Deterministic | 确定性的 |

---

## 4. 小练习

1. Callers can ______ a Goal and list current or archived Goals.
2. Active lists ______ archived Goals by default.
3. Listing order and pagination must be ______.
4. Query projections do not synthesize project fields into Goal ______.
5. An explicit ______/all filter can include archived Goals.

<details>
<summary>点击查看答案</summary>

1. retrieve
2. exclude
3. deterministic
4. storage
5. archived
</details>
