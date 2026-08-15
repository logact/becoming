# Issue #6: Feature: Record occurrences as first-class domain data

**Labels:** Feature  
**State:** OPEN  
**Parent:** Epic: Data Provenance & History (#1)

---

## 1. Original English

## User outcome

Users and system capabilities can record what actually happened separately from the current state of a domain entity.

## Scope

- Create, read, correct, archive, and classify Record entities.
- Preserve both occurrence time and recording time.
- Capture record type, actor, human-readable description, and optional structured payload.
- Support linking Records to core concepts through semantic relations.
- Protect occurrence history from ordinary destructive mutation.

## Acceptance criteria

- A valid Record requires a description, record type, occurred-at time, and recorded-at time.
- Occurrence time and recording time remain independently queryable.
- Optional actor and structured payload data round-trip without loss.
- Corrections are explicit and do not conceal the previously recorded fact.
- Archived Records remain available to authorized history queries.
- Invalid record types or malformed payloads are rejected with domain errors.

## Dependencies

- Semantic relation support from the planning/execution epic for linking Records to other core concepts.

## Out of scope

- Timeline aggregation across entities.
- Automatic capture of every domain mutation.

Parent: #1

---

## 2. 中文翻译

## 用户价值

用户和系统能力可以脱离领域实体的当前状态，单独记录实际发生的事情。

## 范围

- 创建、读取、修正、归档和分类记录实体。
- 保留发生时间和记录时间。
- 捕获记录类型、行为者、人类可读的描述以及可选的结构化载荷。
- 通过语义关系支持将记录链接到核心概念。
- 保护发生历史免受普通破坏性变更。

## 验收标准

- 有效记录需要描述、记录类型、发生时间和记录时间。
- 发生时间和记录时间保持独立可查询。
- 可选的行为者和结构化载荷数据往返无丢失。
- 修正是显式的，不会掩盖之前记录的事实。
- 归档记录仍可供授权历史查询使用。
- 无效记录类型或格式错误的载荷会被领域错误拒绝。

## 依赖

- 规划/执行 Epic 的语义关系支持，用于将记录链接到其他核心概念。

## 范围外

- 跨实体时间线聚合。
- 自动捕获每次领域变更。

父项：#1

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| record | 记录 | Users and system capabilities can record what actually happened. |
| preserve | 保留 | Preserve both occurrence time and recording time. |
| capture | 捕获 | Capture record type, actor, human-readable description, and optional structured payload. |
| support | 支持 | Support linking Records to core concepts through semantic relations. |
| protect | 保护 | Protect occurrence history from ordinary destructive mutation. |
| require | 需要 | A valid Record requires a description, record type, occurred-at time, and recorded-at time. |
| remain | 保持 | Occurrence time and recording time remain independently queryable. |
| round-trip | 往返 | Optional actor and structured payload data round-trip without loss. |
| reject | 拒绝 | Invalid record types or malformed payloads are rejected with domain errors. |
| classify | 分类 | Create, read, correct, archive, and classify Record entities. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| first-class domain data | 一等领域数据 | 与核心实体同等重要的数据 |
| current state | 当前状态 | 实体现在的状态 |
| record entities | 记录实体 | 用于记录发生的实体 |
| occurrence time | 发生时间 | 事件实际发生的时间 |
| recording time | 记录时间 | 事件被写入系统的时间 |
| record type | 记录类型 | 记录的分类 |
| human-readable description | 人类可读的描述 | 供人阅读的说明文字 |
| structured payload | 结构化载荷 | 结构化数据载荷 |
| semantic relations | 语义关系 | 带有业务含义的关系 |
| destructive mutation | 破坏性变更 | 会删除或覆盖原有数据的变更 |
| domain errors | 领域错误 | 业务规则层面的错误 |

### 值得模仿的句式
1. **“Users and system capabilities can record what actually happened separately from the current state of a domain entity.”** — 用户和系统能力可以脱离领域实体的当前状态，单独记录实际发生的事情。 — 例句：We can record what actually happened separately from the planned schedule.
2. **“Corrections are explicit and do not conceal the previously recorded fact.”** — 修正是显式的，不会掩盖之前记录的事实。 — 例句：Amendments are explicit and do not conceal the previously approved decision.
3. **“Protect occurrence history from ordinary destructive mutation.”** — 保护发生历史免受普通破坏性变更。 — 例句：Protect audit history from ordinary destructive mutation.

### 领域词汇
| English | 中文 |
|---|---|
| First-class domain data | 一等领域数据 |
| Occurrence time | 发生时间 |
| Recording time | 记录时间 |
| Structured payload | 结构化载荷 |
| Semantic relation | 语义关系 |
| Destructive mutation | 破坏性变更 |
| Domain error | 领域错误 |
| Round-trip | 往返 |
| Archive | 归档 |
| Classify | 分类 |

---

## 4. 小练习

1. Users and system capabilities can record what actually happened ______ from the current state of a domain entity.
2. A valid Record requires a description, record type, occurred-at time, and ______-at time.
3. Optional actor and structured payload data ______ without loss.
4. Corrections are explicit and do not ______ the previously recorded fact.
5. Invalid record types or malformed payloads are ______ with domain errors.

<details>
<summary>点击查看答案</summary>

1. separately
2. recorded
3. round-trip
4. conceal
5. rejected

</details>
