# Issue #49: Task: Model resource quantities and catalog invariants

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Define resource catalogs and available capacity (#11)

---

## 1. Original English

## Outcome

Establish a framework-neutral Resource domain model and exact quantity rules that later budget, allocation, and consumption work can share without floating-point drift or unit ambiguity.

Parent Feature: #11

## Implementation plan

1. Introduce the minimal domain/application boundary needed by the repository's eventual runtime (domain types and ports, without selecting a web framework or database library in this task).
2. Model Resource fields from `Table-definetion.txt`: UUID, title, description, open-ended `resource_type`, optional unit, optional behavior, optional capacity, timestamps, and archive timestamp.
3. Add reusable decimal quantity and unit value objects. Require finite decimal input, preserve scale without binary floating point, reject negative capacity, and define per-unit precision/normalization rules that can be extended for time, money, tokens, compute, energy, people, and equipment.
4. Validate optional unit and behavior values when present while keeping resource types and behaviors extensible rather than a closed enum.
5. Define domain errors and serialization/reconstitution contracts so persistence and application adapters receive canonical values.

## Acceptance criteria

- [ ] A Resource cannot be constructed without a nonblank title and resource type.
- [ ] Optional capacity is a nonnegative finite decimal and round-trips without floating-point drift.
- [ ] Optional unit and behavior are canonicalized and validated when supplied.
- [ ] Resource types remain open to future categories rather than being hard-coded to the examples.
- [ ] Unit-specific precision rules are centralized and reusable by budgets, allocations, usage, and summaries.
- [ ] The design adds no database foreign keys and makes no framework assumption.

## Tests

- Unit-test valid and invalid Resource construction, including blank required fields and optional fields.
- Use boundary/table-driven tests for zero, fractional, excessive-scale, non-finite, and negative quantities across representative units.
- Verify canonical serialization and exact decimal round-trips.

## Dependencies

- Feature #30, Capture provenance for core entity mutations, defines the mutation-recording contract consumed by later Resource commands.

## Out of scope

- Resource persistence and CRUD orchestration.
- Project budgets, Task allocations, consumption, accounting, billing, and people/equipment scheduling.

---

## 2. 中文翻译

## 成果

建立一个与框架无关的 Resource 领域模型和精确数量规则，以便后续的预算、分配和消耗工作可以共享，而不会出现浮点漂移或单位歧义。

父 Feature：#11

## 实施计划

1. 引入仓库最终运行时所需的最小领域/应用边界（领域类型和端口，本任务不选择 Web 框架或数据库库）。
2. 根据 `Table-definetion.txt` 建模 Resource 字段：UUID、标题、描述、开放式的 `resource_type`、可选单位、可选行为、可选容量、时间戳和归档时间戳。
3. 添加可复用的小数数量和单位值对象。要求输入为有限小数，保留精度而不使用二进制浮点数，拒绝负容量，并定义可按时间、金钱、token、计算能力、精力、人员和设备扩展的每单位精度/归一化规则。
4. 在资源类型和行为保持可扩展而非封闭枚举的前提下，对提供的可选单位和行为值进行验证。
5. 定义领域错误以及序列化/重建契约，以便持久化和应用适配器接收规范值。

## 验收标准

- [ ] Resource 必须有非空标题和资源类型才能构造。
- [ ] 可选容量是非负有限小数，且往返过程中无浮点漂移。
- [ ] 可选单位和行为在提供时会被规范化并验证。
- [ ] 资源类型保持对未来类别开放，而不是硬编码为示例中的值。
- [ ] 单位相关的精度规则集中管理，并可供预算、分配、使用和汇总复用。
- [ ] 设计不添加数据库外键，也不对框架做任何假设。

## 测试

- 对有效和无效的 Resource 构造进行单元测试，包括空必填字段和可选字段。
- 使用边界/表驱动测试覆盖代表性单位下的零、分数、过大精度、非有限和负数数量。
- 验证规范化序列化和精确小数往返。

## 依赖

- Feature #30：为核心实体变更捕获数据来源，定义了后续 Resource 命令使用的变更记录契约。

## 排除范围

- Resource 的持久化与 CRUD 编排。
- 项目预算、任务分配、消耗、会计、计费和人员/设备调度。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| establish | 建立 | Establish a framework-neutral Resource domain model. |
| model | 建模 | Model Resource fields from `Table-definetion.txt`. |
| introduce | 引入 | Introduce the minimal domain/application boundary. |
| preserve | 保留 | Preserve scale without binary floating point. |
| reject | 拒绝 | Reject negative capacity. |
| define | 定义 | Define per-unit precision/normalization rules. |
| validate | 验证 | Validate optional unit and behavior values. |
| keep | 保持 | Keep resource types extensible. |
| canonicalize | 规范化 | Optional unit and behavior are canonicalized. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| framework-neutral | 与框架无关的 | a framework-neutral domain model |
| exact quantity rules | 精确数量规则 | exact quantity rules for resources |
| floating-point drift | 浮点漂移 | avoid floating-point drift |
| unit ambiguity | 单位歧义 | avoid unit ambiguity |
| domain/application boundary | 领域/应用边界 | the minimal domain/application boundary |
| value objects | 值对象 | reusable decimal quantity and unit value objects |
| finite decimal input | 有限小数输入 | require finite decimal input |
| binary floating point | 二进制浮点数 | preserve scale without binary floating point |
| closed enum | 封闭枚举 | keep types extensible rather than a closed enum |
| serialization/reconstitution contracts | 序列化/重建契约 | define serialization/reconstitution contracts |

### 值得模仿的句式
1. **“Establish X and Y that later work can share without A or B.”** — “建立 X 和 Y，以便后续工作可以在没有 A 或 B 的情况下共享。” — *Establish a framework-neutral Resource domain model and exact quantity rules that later budget, allocation, and consumption work can share without floating-point drift or unit ambiguity.*
2. **“Require finite decimal input, preserve scale without binary floating point, reject negative capacity, and define ... rules.”** — “要求有限小数输入、不使用二进制浮点数保留精度、拒绝负容量并定义……规则。” — *Require finite decimal input, preserve scale without binary floating point, reject negative capacity, and define per-unit precision/normalization rules.*
3. **“Validate optional unit and behavior values when present while keeping X extensible rather than a closed enum.”** — “在存在时对可选单位和行为值进行验证，同时保持 X 可扩展而非封闭枚举。” — *Validate optional unit and behavior values when present while keeping resource types and behaviors extensible rather than a closed enum.*

### 领域词汇
| English | 中文 |
|---|---|
| framework-neutral | 与框架无关的 |
| domain/application boundary | 领域/应用边界 |
| value object | 值对象 |
| decimal quantity | 小数数量 |
| finite decimal | 有限小数 |
| scale | 精度/小数位 |
| binary floating point | 二进制浮点 |
| precision rules | 精度规则 |
| normalization rules | 归一化规则 |
| closed enum | 封闭枚举 |
| canonical value | 规范值 |
| serialization/reconstitution contract | 序列化/重建契约 |

---

## 4. 小练习

1. We need a ______ Resource domain model that later budget, allocation, and consumption work can share.
2. Optional capacity must be a nonnegative ______ decimal and round-trip without floating-point drift.
3. We should reject ______ capacity and define per-unit precision rules.
4. Resource types should remain extensible rather than being a ______ enum.
5. Domain errors and ______ contracts help persistence and application adapters receive canonical values.

<details>
<summary>点击查看答案</summary>

1. framework-neutral  
2. finite  
3. negative  
4. closed  
5. serialization/reconstitution

</details>
