# Issue #106: Task: Bootstrap the V1 domain and persistence test architecture

**Labels:** task  
**State:** CLOSED  
**Parent:** Feature: Record occurrences as first-class domain data (#6)

---

## 1. Original English

Parent Feature: #6 — Feature: Record occurrences as first-class domain data

## Outcome

The empty repository has one documented, executable architecture for the first Record vertical slice and all later V1 domain work: domain/application boundaries, exact persistence and migration conventions, transaction support, and a repeatable test harness.

## Implementation plan

1. Select and document the initial language/runtime, package/build tooling, database and migration approach, and test stack using a short architecture decision record; keep transport/UI framework selection outside this decision.
2. Establish the repository layout for domain, application, persistence adapters, migrations, and unit/integration tests, updating `AGENTS.md` when the chosen layout supersedes its scaffold guidance.
3. Define shared primitives for UUID identity, UTC timestamps, injectable clock/ID generation, structured domain errors, exact decimal values, and transaction execution.
4. Create the migration and isolated database-test harness needed to verify schemas with logical references and no database foreign keys.
5. Add the minimum CI/local commands for formatting, static checks, unit tests, integration tests, and migration verification, with one smoke vertical slice proving the wiring.

## Acceptance criteria

- [ ] A documented architecture decision selects the initial runtime, build, persistence, migration, and test tooling with explicit tradeoffs.
- [ ] Production and test directories are established and documented.
- [ ] Shared identity, time, error, decimal, and transaction contracts are usable without depending on a web/UI framework.
- [ ] The test database can apply migrations in isolation and verify the no-database-foreign-key policy.
- [ ] Local/CI commands execute formatting, static analysis, unit tests, integration tests, and migration checks successfully.
- [ ] A smoke vertical slice proves an application command can commit domain data atomically through the selected persistence adapter.

## Tests

- Run the complete bootstrap validation command from a clean checkout.
- Apply all migrations to an empty isolated database and verify repeatability.
- Exercise transaction commit and rollback, injected clock/ID behavior, exact decimal round-trip, and structured domain-error mapping.
- Verify schema inspection finds no database foreign keys and no `entities` table.

## Dependencies

- Parent Feature #6.
- `Table-definetion.txt` and repository guidelines are the authoritative V1 schema and integrity constraints.

## Out of scope

- Selecting an HTTP, UI, or deployment framework.
- Implementing the complete Record feature or any other core entity.
- Authentication, authorization, production hosting, and observability platform selection.

---

## 2. 中文翻译

父功能：#6 — 功能：将发生记录作为一等领域数据

## 成果

空仓库拥有第一个记录垂直切片及所有后续 V1 领域工作的文档化、可执行架构：领域/应用边界、精确的持久化和迁移约定、事务支持以及可重复的测试工具。

## 实施计划

1. 使用简短架构决策记录选择并记录初始语言/运行时、包/构建工具、数据库和迁移方法以及测试栈；将传输/UI 框架选择排除在此决策之外。
2. 建立领域、应用、持久化适配器、迁移以及单元/集成测试的仓库布局，在选定布局取代其脚手架指导时更新 `AGENTS.md`。
3. 定义 UUID 身份、UTC 时间戳、可注入时钟/ID 生成、结构化领域错误、精确十进制值和事务执行的共享原语。
4. 创建验证逻辑引用且没有数据库外键的迁移和隔离数据库测试工具所需的工具。
5. 添加格式化、静态检查、单元测试、集成测试和迁移验证的最少 CI/本地命令，并用一个冒烟垂直切片证明线路通畅。

## 验收标准

- [ ] 架构决策记录选择初始运行时、构建、持久化、迁移和测试工具，并说明明确的权衡。
- [ ] 生产和测试目录已建立并有文档记录。
- [ ] 共享身份、时间、错误、十进制和事务约定可在不依赖 Web/UI 框架的情况下使用。
- [ ] 测试数据库可以隔离应用迁移，并验证无数据库外键策略。
- [ ] 本地/CI 命令成功执行格式化、静态分析、单元测试、集成测试和迁移检查。
- [ ] 一个冒烟垂直切片证明应用命令可以通过选定的持久化适配器原子性地提交领域数据。

## 测试

- 从干净检出运行完整的引导验证命令。
- 将所有迁移应用到空的隔离数据库并验证可重复性。
- 练习事务提交和回滚、注入时钟/ID 行为、精确十进制往返和结构化领域错误映射。
- 验证模式检查未发现数据库外键，也没有 `entities` 表。

## 依赖

- 父功能 #6。
- `Table-definetion.txt` 和仓库指南是权威的 V1 模式和完整性约束。

## 范围外

- 选择 HTTP、UI 或部署框架。
- 实现完整的记录功能或任何其他核心实体。
- 认证、授权、生产托管和可观察性平台选择。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| bootstrap | 引导 | Bootstrap the V1 domain and persistence test architecture. |
| establish | 建立 | Establish the repository layout for domain, application, and persistence adapters. |
| document | 记录 | Select and document the initial language/runtime. |
| select | 选择 | Select the initial language/runtime, package/build tooling, and database approach. |
| update | 更新 | Updating `AGENTS.md` when the chosen layout supersedes its scaffold guidance. |
| define | 定义 | Define shared primitives for UUID identity, UTC timestamps, and injectable clock. |
| create | 创建 | Create the migration and isolated database-test harness. |
| add | 添加 | Add the minimum CI/local commands for formatting, static checks, and tests. |
| prove | 证明 | A smoke vertical slice proves the wiring. |
| verify | 验证 | Verify schema inspection finds no database foreign keys. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| V1 domain | V1 领域 | 第一版领域系统 |
| persistence test architecture | 持久化测试架构 | 测试持久化层的架构 |
| vertical slice | 垂直切片 | 贯穿多层的功能切片 |
| architecture decision record | 架构决策记录 | 记录架构选择的文档 |
| build tooling | 构建工具 | 编译、打包等工具 |
| migration approach | 迁移方法 | 数据库迁移策略 |
| test stack | 测试栈 | 使用的测试工具组合 |
| repository layout | 仓库布局 | 代码目录结构 |
| shared primitives | 共享原语 | 跨模块共享的基础类型 |
| injectable clock | 可注入时钟 | 可替换的时间源 |
| ID generation | ID 生成 | 生成唯一标识符 |
| structured domain errors | 结构化领域错误 | 结构化的错误对象 |
| exact decimal values | 精确十进制值 | 无精度损失的十进制数 |
| transaction execution | 事务执行 | 事务的运行和管理 |
| smoke vertical slice | 冒烟垂直切片 | 最小端到端验证 |

### 值得模仿的句式
1. **“The empty repository has one documented, executable architecture for the first Record vertical slice...”** — 空仓库拥有第一个记录垂直切片的文档化、可执行架构... — 例句：The team defined one documented, executable architecture for the first payment vertical slice.
2. **“...keep transport/UI framework selection outside this decision.”** — ...将传输/UI 框架选择排除在此决策之外。 — 例句：Keep deployment details outside this design decision.
3. **“A smoke vertical slice proves the wiring.”** — 一个冒烟垂直切片证明线路通畅。 — 例句：A smoke test proves the wiring between the layers.

### 领域词汇
| English | 中文 |
|---|---|
| Bootstrap | 引导 / 搭建 |
| Vertical slice | 垂直切片 |
| Architecture decision record | 架构决策记录 |
| Shared primitives | 共享原语 |
| Injectable clock | 可注入时钟 |
| Exact decimal | 精确十进制 |
| Transaction execution | 事务执行 |
| Migration verification | 迁移验证 |
| Schema inspection | 模式检查 |
| Persistence adapter | 持久化适配器 |

---

## 4. 小练习

1. We need to ______ the V1 domain and persistence test architecture.
2. The architecture decision record documents the initial runtime, build, persistence, migration, and test tooling with explicit ______.
3. Shared identity, time, error, decimal, and transaction contracts are usable without depending on a web/______ framework.
4. A smoke vertical slice proves an application command can commit domain data ______ through the selected persistence adapter.
5. Schema inspection finds no database foreign keys and no `entities` ______.

<details>
<summary>点击查看答案</summary>

1. bootstrap
2. tradeoffs
3. UI
4. atomically
5. table

</details>
