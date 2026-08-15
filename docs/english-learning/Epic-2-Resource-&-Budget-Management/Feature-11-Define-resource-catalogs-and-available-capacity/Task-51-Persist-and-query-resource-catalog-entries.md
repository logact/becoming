# Issue #51: Task: Persist and query resource catalog entries

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define resource catalogs and available capacity (#11)

---

## 1. Original English

## Outcome

Persist Resource catalogs according to the repository schema and expose storage/query ports for identity, type, and active or archived status.

Parent Feature: #11

## Implementation plan

1. Add the `resources` storage definition exactly at the domain boundary described in `Table-definetion.txt`, using UUID identity, exact DECIMAL capacity, timestamps, and nullable `archived_at`.
2. Implement a Resource repository adapter behind a framework-neutral port for insert, lookup by ID, replacement of mutable intrinsic fields, and optimistic/concurrency-safe writes consistent with the selected persistence stack.
3. Implement filters for resource type and active/archived status with deterministic ordering and pagination conventions if the project foundation provides them.
4. Map persisted decimal and optional unit/behavior values through the canonical value objects from #49.
5. Keep all integrity enforcement in the application/domain layer; do not introduce database foreign keys or a closed database enum for extensible resource categories.

## Acceptance criteria

- [ ] The Resource schema matches `Table-definetion.txt` and stores capacity as an exact decimal.
- [ ] Repository round-trips preserve UUIDs, optional values, precision, and archive state.
- [ ] Resources can be queried by type and by active, archived, or all status.
- [ ] Archived resources remain readable and are excluded from active-only queries.
- [ ] Storage code is accessed through a port and does not leak framework-specific types into the domain.
- [ ] No database foreign keys are added.

## Tests

- Add storage contract tests for insert, get, update, archive-state round-trip, filters, ordering, and empty results.
- Test high-precision fractional capacities and representative units for exact persistence.
- Test active/archived filters with mixed catalog data.

## Dependencies

- #49, Task: Model resource quantities and catalog invariants.

## Out of scope

- Resource command/API transport shape.
- Budgets, allocations, actual usage, general accounting, billing, and scheduling.

---

## 2. 中文翻译

## 成果

按照仓库模式持久化 Resource 目录，并公开用于身份、类型以及活跃或归档状态的存储/查询端口。

父 Feature：#11

## 实施计划

1. 严格按照 `Table-definetion.txt` 中描述的领域边界添加 `resources` 存储定义，使用 UUID 标识、精确 DECIMAL 容量、时间戳和可空的 `archived_at`。
2. 在框架无关的端口之后实现 Resource 仓库适配器，支持插入、按 ID 查找、可变内在字段的替换，以及与所选持久化栈一致的乐观/并发安全写入。
3. 实现资源类型和活跃/归档状态的过滤器，若项目基础提供，则使用确定性排序和分页约定。
4. 通过 #49 的规范值对象映射持久化的小数以及可选的单位/行为值。
5. 将所有完整性强制保留在应用/领域层；不要为可扩展资源类别引入数据库外键或封闭的数据库枚举。

## 验收标准

- [ ] Resource 模式与 `Table-definetion.txt` 匹配，并将容量存储为精确小数。
- [ ] 仓库往返保留 UUID、可选值、精度和归档状态。
- [ ] 可以按类型以及活跃、归档或全部状态查询资源。
- [ ] 归档资源保持可读，并从仅活跃查询中排除。
- [ ] 存储代码通过端口访问，不会将框架特定类型泄漏到领域。
- [ ] 不添加数据库外键。

## 测试

- 为插入、获取、更新、归档状态往返、过滤器、排序和空结果添加存储契约测试。
- 测试高精度分数容量和代表性单位的精确持久化。
- 使用混合目录数据测试活跃/归档过滤器。

## 依赖

- #49，任务：为资源数量和目录不变量建模。

## 排除范围

- Resource 命令/API 传输形态。
- 预算、分配、实际使用、通用会计、计费和调度。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| persist | 持久化 | Persist Resource catalogs according to the schema. |
| expose | 暴露、公开 | Expose storage/query ports for identity and status. |
| add | 添加 | Add the `resources` storage definition. |
| implement | 实现 | Implement a Resource repository adapter. |
| map | 映射 | Map persisted decimal values through canonical value objects. |
| keep | 保持 | Keep all integrity enforcement in the domain layer. |
| query | 查询 | Resources can be queried by type and status. |
| preserve | 保留 | Repository round-trips preserve UUIDs and precision. |
| leak | 泄漏 | Do not leak framework-specific types into the domain. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| storage definition | 存储定义 | add the `resources` storage definition |
| framework-neutral port | 框架无关端口 | behind a framework-neutral port |
| repository adapter | 仓库适配器 | implement a Resource repository adapter |
| optimistic/concurrency-safe writes | 乐观/并发安全写入 | support optimistic/concurrency-safe writes |
| persistence stack | 持久化栈 | consistent with the selected persistence stack |
| deterministic ordering | 确定性排序 | filters with deterministic ordering |
| pagination conventions | 分页约定 | deterministic ordering and pagination conventions |
| canonical value objects | 规范值对象 | map through canonical value objects |
| integrity enforcement | 完整性强制 | keep integrity enforcement in the domain layer |
| database foreign keys | 数据库外键 | do not introduce database foreign keys |

### 值得模仿的句式
1. **“Persist X according to Y and expose Z for identity, type, and active or archived status.”** — “根据 Y 持久化 X，并公开用于身份、类型以及活跃或归档状态的 Z。” — *Persist Resource catalogs according to the repository schema and expose storage/query ports for identity, type, and active or archived status.*
2. **“Implement filters for ... with deterministic ordering and pagination conventions.”** — “为……实现具有确定性排序和分页约定的过滤器。” — *Implement filters for resource type and active/archived status with deterministic ordering and pagination conventions.*
3. **“Keep all integrity enforcement in the application/domain layer.”** — “将所有完整性强制保留在应用/领域层。” — *Keep all integrity enforcement in the application/domain layer; do not introduce database foreign keys.*

### 领域词汇
| English | 中文 |
|---|---|
| Resource catalog | 资源目录 |
| repository adapter | 仓库适配器 |
| storage port | 存储端口 |
| UUID identity | UUID 标识 |
| exact DECIMAL | 精确 DECIMAL |
| nullable archived_at | 可空的 archived_at |
| optimistic/concurrency-safe writes | 乐观/并发安全写入 |
| deterministic ordering | 确定性排序 |
| pagination | 分页 |
| canonical value objects | 规范值对象 |
| database enum | 数据库枚举 |

---

## 4. 小练习

1. We must persist Resource catalogs according to the repository ______ described in `Table-definetion.txt`.
2. The repository adapter lives behind a ______ port to keep it framework-neutral.
3. Filters for resource type and active/archived status need ______ ordering and pagination conventions.
4. Storage code should not leak framework-specific types into the ______.
5. We should not introduce database ______ for extensible resource categories.

<details>
<summary>点击查看答案</summary>

1. schema  
2. framework-neutral  
3. deterministic  
4. domain  
5. foreign keys

</details>
