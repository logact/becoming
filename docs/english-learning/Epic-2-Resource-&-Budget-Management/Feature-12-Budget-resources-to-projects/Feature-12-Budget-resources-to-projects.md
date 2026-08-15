# Issue #12: Feature: Budget resources to projects

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can reserve an explicit amount of an available Resource for a Project.

## Scope

- Represent Project-to-Resource budget relationships.
- Store amount, unit, and optional validity or context in relation metadata.
- Validate Projects, Resources, positive amounts, unit compatibility, and available capacity.
- Preserve changes as temporal relationships rather than overwriting history.

## Acceptance criteria

- A Project can hold budgets for multiple Resources.
- A budget identifies the funding Resource, amount, and compatible unit.
- Creating or changing a budget validates logical references at the domain layer.
- The service exposes the active budget for a Project and Resource.
- Superseded budgets remain inspectable through ended relations and provenance.
- A budget that exceeds available capacity is rejected or explicitly surfaced according to the configured policy.

## Dependencies

- Feature: Define resource catalogs and available capacity.
- Feature: Create and validate semantic relations.
- Feature: Track relationship changes over time.
- Feature: Manage projects and goal pursuit.

## Out of scope

- Task allocation.
- Actual consumption.
- Automated rebudgeting.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以为项目预留可用资源的明确数量。

## 范围

- 表示项目到资源的预算关系。
- 在关系元数据中存储金额、单位以及可选的有效期或上下文。
- 验证项目、资源、正数金额、单位兼容性和可用容量。
- 将变更保留为时态关系，而不是覆盖历史。

## 验收标准

- 一个项目可以持有多种资源的预算。
- 预算标明资金来源资源、金额和兼容单位。
- 创建或更改预算时，在领域层验证逻辑引用。
- 服务会公开某个项目与资源的活跃预算。
- 被取代的预算仍可通过已结束的关系和来源记录进行审查。
- 超出可用容量的预算会根据配置策略被拒绝或明确暴露出来。

## 依赖

- Feature：定义资源目录和可用容量。
- Feature：创建并验证语义关系。
- Feature：跟踪关系随时间的变化。
- Feature：管理项目和目标追求。

## 排除范围

- 任务分配。
- 实际消耗。
- 自动重新预算。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| reserve | 预留 | Reserve an explicit amount of an available Resource. |
| represent | 表示 | Represent Project-to-Resource budget relationships. |
| store | 存储 | Store amount, unit, and optional context in relation metadata. |
| validate | 验证 | Validate Projects, Resources, positive amounts, and unit compatibility. |
| preserve | 保留 | Preserve changes as temporal relationships. |
| expose | 暴露、公开 | Expose the active budget for a Project and Resource. |
| supersede | 取代 | Superseded budgets remain inspectable. |
| exceed | 超出 | A budget that exceeds available capacity is rejected. |
| surface | 暴露、呈现 | Exceeding capacity is surfaced according to policy. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| explicit amount | 明确数量 | reserve an explicit amount of a Resource |
| available Resource | 可用资源 | reserve an amount of an available Resource |
| budget relationships | 预算关系 | Project-to-Resource budget relationships |
| relation metadata | 关系元数据 | store amount and unit in relation metadata |
| unit compatibility | 单位兼容性 | validate unit compatibility |
| available capacity | 可用容量 | do not exceed available capacity |
| temporal relationships | 时态关系 | preserve changes as temporal relationships |
| active budget | 活跃预算 | expose the active budget for a Project |
| funding Resource | 资金来源资源 | a budget identifies the funding Resource |
| configured policy | 配置的策略 | according to the configured policy |

### 值得模仿的句式
1. **“Users can reserve an explicit amount of an available Resource for a Project.”** — “用户可以为项目预留可用资源的明确数量。” — *Users can reserve an explicit amount of an available Resource for a Project.*
2. **“Preserve changes as temporal relationships rather than overwriting history.”** — “将变更保留为时态关系，而不是覆盖历史。” — *Preserve changes as temporal relationships rather than overwriting history.*
3. **“A budget that exceeds available capacity is rejected or explicitly surfaced according to the configured policy.”** — “超出可用容量的预算会根据配置策略被拒绝或明确暴露出来。” — *A budget that exceeds available capacity is rejected or explicitly surfaced according to the configured policy.*
4. **“Superseded budgets remain inspectable through ended relations and provenance.”** — “被取代的预算仍可通过已结束的关系和来源记录进行审查。” — *Superseded budgets remain inspectable through ended relations and provenance.*

### 领域词汇
| English | 中文 |
|---|---|
| Project-to-Resource budget | 项目到资源的预算 |
| relation metadata | 关系元数据 |
| validity/context | 有效期/上下文 |
| temporal relationship | 时态关系 |
| active budget | 活跃预算 |
| funding Resource | 资金来源资源 |
| compatible unit | 兼容单位 |
| logical reference | 逻辑引用 |
| ended relation | 已结束的关系 |
| superseded budget | 被取代的预算 |
| capacity policy | 容量策略 |
| over-capacity | 超容量 |

---

## 4. 小练习

1. Users can ______ an explicit amount of an available Resource for a Project.
2. We need to represent Project-to-Resource ______ relationships.
3. Changes should be preserved as temporal relationships rather than ______ history.
4. The service exposes the ______ budget for a Project and Resource.
5. A budget that exceeds available capacity is ______ or explicitly surfaced according to the configured policy.

<details>
<summary>点击查看答案</summary>

1. reserve  
2. budget  
3. overwriting  
4. active  
5. rejected

</details>
