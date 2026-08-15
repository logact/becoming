# Issue #11: Feature: Define resource catalogs and available capacity

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Resource & Budget Management (#2)

---

## 1. Original English

## User outcome

Users can define the limited resources available to their work with meaningful units, behavior, and capacity.

## Scope

- Create, read, update, and archive Resource entities.
- Capture resource type, measurement unit, behavior, and optional capacity.
- Support time, money, AI tokens, compute, energy, people, and equipment without hard-coding a closed set.
- Validate decimal precision and unit consistency.

## Acceptance criteria

- A Resource requires a title and resource type.
- Capacity supports fractional amounts where appropriate without floating-point drift.
- Unit and behavior are optional but validated when supplied.
- Resources can be queried by type and active/archived status.
- Updating a Resource cannot silently reinterpret existing budget, allocation, or usage amounts.
- Important mutations produce provenance records.

## Dependencies

- Feature: Capture provenance for core entity mutations.

## Out of scope

- General accounting or billing.
- Scheduling people or equipment.

Parent: #2

---

## 2. 中文翻译

## 用户价值

用户可以定义工作中可用的有限资源，并为它们设置有意义的单位、行为和容量。

## 范围

- 创建、读取、更新和归档 Resource 实体。
- 记录资源类型、计量单位、行为和可选容量。
- 支持时间、金钱、AI token、计算能力、精力、人员和设备，而无需硬编码一个封闭集合。
- 验证小数精度和单位一致性。

## 验收标准

- Resource 必须有标题和资源类型。
- 容量在适当时支持分数数量，且不会出现浮点漂移。
- 单位和行为是可选的，但在提供时会进行验证。
- 可以按类型以及活跃/归档状态查询资源。
- 更新 Resource 时不能静默地重新解释现有的预算、分配或用量金额。
- 重要变更会产生来源记录。

## 依赖

- Feature：为核心实体变更捕获数据来源。

## 排除范围

- 通用会计或计费。
- 人员或设备的调度。

父 issue：#2

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| define | 定义 | Define the limited resources available to their work. |
| capture | 记录、捕获 | Capture resource type, measurement unit, behavior, and capacity. |
| support | 支持 | Support time, money, AI tokens, and more. |
| validate | 验证 | Validate decimal precision and unit consistency. |
| query | 查询 | Resources can be queried by type and status. |
| update | 更新 | Updating a Resource cannot silently reinterpret existing amounts. |
| reinterpret | 重新解释 | Do not silently reinterpret existing budget amounts. |
| produce | 产生 | Important mutations produce provenance records. |
| archive | 归档 | Create, read, update, and archive Resource entities. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| limited resources | 有限资源 | define the limited resources available |
| meaningful units | 有意义的单位 | resources with meaningful units |
| resource type | 资源类型 | capture resource type and unit |
| measurement unit | 计量单位 | the measurement unit of a resource |
| optional capacity | 可选容量 | capture optional capacity |
| floating-point drift | 浮点漂移 | avoid floating-point drift in capacity |
| active/archived status | 活跃/归档状态 | query by active/archived status |
| closed set | 封闭集合 | without hard-coding a closed set |
| provenance records | 来源记录 | produce provenance records |
| general accounting | 通用会计 | out of scope for general accounting |

### 值得模仿的句式
1. **“Users can define X with meaningful units, behavior, and capacity.”** — “用户可以定义具有有意义单位、行为和容量的 X。” — *Users can define the limited resources available to their work with meaningful units, behavior, and capacity.*
2. **“Support X without hard-coding a closed set.”** — “支持 X，而无需硬编码一个封闭集合。” — *Support time, money, AI tokens, compute, energy, people, and equipment without hard-coding a closed set.*
3. **“Updating X cannot silently reinterpret existing Y.”** — “更新 X 时不能静默地重新解释现有的 Y。” — *Updating a Resource cannot silently reinterpret existing budget, allocation, or usage amounts.*
4. **“Important mutations produce provenance records.”** — “重要变更会产生来源记录。” — *Important mutations produce provenance records.*

### 领域词汇
| English | 中文 |
|---|---|
| Resource catalog | 资源目录 |
| Resource entity | 资源实体 |
| resource type | 资源类型 |
| measurement unit | 计量单位 |
| behavior | 行为 |
| capacity | 容量 |
| decimal precision | 小数精度 |
| unit consistency | 单位一致性 |
| active/archived status | 活跃/归档状态 |
| provenance records | 来源记录 |

---

## 4. 小练习

1. Users can define the limited resources available to their work with meaningful units, behavior, and ______.
2. The catalog must support time, money, AI tokens, compute, energy, people, and equipment without ______ a closed set.
3. Capacity supports fractional amounts without ______ drift.
4. Updating a Resource cannot silently ______ existing budget, allocation, or usage amounts.
5. Important mutations produce ______ records.

<details>
<summary>点击查看答案</summary>

1. capacity  
2. hard-coding  
3. floating-point  
4. reinterpret  
5. provenance

</details>
