# Cycle 3 聚合计划

状态：**已批准**（2026-08-22）。

范围：

- `docs/exec-plans/dashboard-item-navigation/plan.md`
- `docs/exec-plans/goal-project-management/plan.md`
- `docs/exec-plans/start-time-and-date-input/plan.md`

本文件只引用原 exec-plan 的章节，不重写原任务。Cycle 3 的冻结计划副本位于 `docs/cycles/cycle-3/snapshots/`；执行与验收以冻结副本为准，原始计划后续变化不自动扩大本周期范围。本周期准备时的完整原型快照位于 `docs/cycles/cycle-3/prototype-snapshot/`。

## 计划边界与依赖裁决

- `dashboard-item-navigation` 原文 Source issue 限定条款与 §1 优先：只实施 Dashboard entity navigation；issue 末尾的 Goal-detail 句子由 `goal-project-management` 负责。
- 先完成 `dashboard-item-navigation` §2–§5，建立 Dashboard / Library 共用的详情 route rendering，再向所有 Goal-detail wrapper 注入本周期新增服务。
- `start-time-and-date-input` §2 的 shared picker 是所有本周期日期表单的先决条件。
- `start-time-and-date-input` §8.5 优先于 `goal-project-management` §6.4 的旧式日期文本输入描述：新建 Goal Project 的可选 Due 必须使用 shared native date picker，不新增或保留手工 `YYYY-MM-DD` 输入。
- `start-time-and-date-input` §3–§6 先于其 §7–§8；`goal-project-management` §2–§5 先于其 §6–§7。两个计划共同修改 Goal detail 与 composition 时，先完成 Goal Project Management UI，再叠加 Goal scheduling UI，并在集成验收中同时覆盖两组行为。
- `docs/issues/future/`、`docs/exec-plans/archived/` 与没有列入“范围”的文档不属于 Cycle 3。
- 保留准备周期前工作树中的用户改动；Cycle 3 的任务提交不得夹带无关改动。

## 执行清单（引用冻结 exec-plan 原文章节）

### 0. 批准与基线

- [x] 用户批准本聚合计划（2026-08-22）。
- [x] 冻结三份范围内 exec-plan，并复制本周期原型快照。
- [x] 记录准备时自动验证基线与工作树状态。

### 1. Dashboard entity navigation

- [x] `dashboard-item-navigation` §2。
- [x] `dashboard-item-navigation` §3。
- [x] `dashboard-item-navigation` §4–§5。
- [x] 按 `dashboard-item-navigation` §6 完成独立验收。

独立验收证据（2026-08-22）：

- 逐项审核 §6 与 §4 矩阵：Doing now 的 Goal / Task / Idea、Needs attention 的 Goal / Task / Project / Idea 均按类型进入 Dashboard 详情栈；Back 回到 Dashboard 并恢复 tab bar；Remove 阻止冒泡、只持久化 dismiss；Recent activity 无交互语义；Dashboard / Library 共用 Goal、Project、Task、Idea、Note 详情解析，Project 嵌套路由保持在发起 destination 栈；`attention-pin`、Library collection 与 unknown-route 边界未变。
- 验收发现并修复 1 个过时测试：将 Library Projects “行仍不可点击”断言替换为真实 `project:<id>` 行导航 / route contract 回归，保留全局 `ListRow` 的 button 可访问性语义。未发现其他实现缺口。
- 集中回归：Dashboard / navigation / composition / Projects，12 suites / 81 tests 通过，0 snapshots。
- 最终验证：`npm run typecheck` 通过；`npm test -- --runInBand` 88 suites / 549 tests 通过，0 snapshots。

### 2. Shared native date picker

- [x] `start-time-and-date-input` §2。

验证证据（2026-08-22）：

- 共享 `DatePickerRow` 覆盖 date / datetime、optional / required、显式 Clear、min/max、本地时区与 locale 展示；iOS Done/Cancel 草稿面板和 Android 原子 date→time dialog 均只在确认后提交。
- focused：2 suites / 11 tests 通过；`npm run typecheck` 通过；full suite：90 suites / 560 tests 通过，0 snapshots。

### 3. Goal / Task schedule 领域与持久化

- [x] `start-time-and-date-input` §3。
- [x] `start-time-and-date-input` §4。

§3 验证证据（2026-08-22）：

- Goal / Task 增加可选 `startAt`、原子 `setSchedule`、日期顺序不变量与 `isReadyToStart`；`startAt` / `due` 均按本地日历日比较，同日时分差不影响顺序或当日就绪语义；保留生命周期语义，并让旧 due API 复用同一不变量。
- focused：2 suites / 58 tests 通过；`npm run typecheck` 通过；full suite：90 suites / 580 tests 通过，0 snapshots。

§4 验证证据（2026-08-22）：

- SQLite v4 为 Goal / Task 条件式增加 nullable `start_at INTEGER`，fresh DDL 与 `EXPECTED_COLUMNS` 同步；fresh、v1、v2、v3 及只迁移一列的开发数据库均收敛且保留已有行，旧行以 `NULL` 恢复为 `undefined`。
- Goal / Task repository 的 insert、upsert 与 hydration 均以 epoch milliseconds 往返 `startAt`；覆盖 populated / undefined 及原始整数存储。
- focused：3 suites / 23 tests 通过；`npm run typecheck` 通过；full suite：90 suites / 582 tests 通过，0 snapshots。

### 4. Goal / Task schedule 应用层与读模型

- [x] `start-time-and-date-input` §5。
- [x] `start-time-and-date-input` §6。

§5 验证证据（2026-08-22）：

- 新增独立 `ScheduleGoalService` / `ScheduleTaskService`，在同一 SQLite transaction 中原子替换可选 Start / Due、保存实体、追加 `goalScheduleChanged` / `taskScheduleChanged` immutable Record，并以 `logs` Relation 关联目标；unknown / archived 在 mutation 前拒绝，末段 Relation 写入失败时实体与 Record 均回滚。
- 四种 optional 组合、跨本地日历日非法顺序、同日本地日期（即使 Start 时刻晚于 Due 时刻）、Record / Relation 持久化和 rollback 均有 SQLite-backed application tests；`AddSubGoalService`、`AddTaskService`、`CreateGoalFromIdeaService`、`CreateTaskFromIdeaService` 一致传递可选 `startAt` / `due`，保留原有 labels、derivation 与 creation records，未修改 Quick Capture / CaptureComposer。
- focused：6 suites / 45 tests 通过；`npm run typecheck` 通过；full suite：92 suites / 598 tests 通过，0 snapshots。

§6 验证证据（2026-08-22）：

- Dashboard、Goals、Tasks 的 attention reason 增加 `readyToStart`，严格调用 Goal / Task 的 `isReadyToStart(now)` 领域规则；既有 failed、overdue / dueSoon、resource exhaustion、ready-to-start、pinned 优先级保持，每个 target 只出现一次，ready 项按最早 `startAt` 排序。
- Goal / Task 的 Dashboard、overview 与 Project detail 扁平读项透传 `startAt`；Goal / Task detail 继续返回携带完整 schedule 的领域实体。Doing 仍由既有 status 规则决定，已到 Start 日期的 `todo` 不会进入 Doing。
- 既有 pin / dismiss 状态直接覆盖 ready 项，无新增持久化；测试覆盖 schedule 暴露、优先级重叠与去重、ready 排序、status / archive 边界、pin / dismiss 及 Doing 行为。
- focused：6 suites / 59 tests 通过；`npm run typecheck` 通过；full suite：92 suites / 611 tests 通过，0 snapshots。

### 5. Goal Project Management 领域、应用与读模型

- [x] `goal-project-management` §2。
- [x] `goal-project-management` §3。
- [x] `goal-project-management` §4。
- [x] `goal-project-management` §5。

§2 验证证据（2026-08-22）：

- `Project.create` 与 `rename` 一致拒绝空白名称；`Project.activate` 仅允许 `planning` / `paused` 转为 `active`，并拒绝 `active` / `done` / `failed`，失败时保留原状态与 `updatedAt`。
- 保留 Project Due 严格早于 serving Goal Due 的不变量，以及 `Goal.activateProject` 的归属校验、旧方案暂停与新方案激活行为。
- focused：2 suites / 50 tests 通过；`npm run typecheck` 通过；full suite：92 suites / 613 tests 通过，0 snapshots。

§3 验证证据（2026-08-22）：

- 新增独立 `CreateGoalProjectService`：载入并校验 serving Goal，通过 `Project.create` 构造永久关联 Goal 的 `planning` Project，传入 Goal Due 执行严格早于约束，并返回新 Project ID。
- Project、`projectCreated` immutable Record 与 Goal / Project 两条 `logs` Relation 全部由同一 `TransactionRunner` 原子写入；unknown / archived Goal、空白名称、等于或晚于 Goal Due 均在任何写入前拒绝，第二条 timeline Relation 失败时完整回滚。
- SQLite-backed focused：1 suite / 9 tests 通过；`npm run typecheck` 通过；full suite 首跑遇到无关 `CaptureComposer` async timing 失败，该 suite 单独复跑通过，随后 full suite：93 suites / 622 tests 通过，0 snapshots。

§4 验证证据（2026-08-22）：

- 新增独立 `SelectCurrentPlanService`：校验 Goal 与所选 Project 的存在性、archive、归属及 lifecycle eligibility，并通过 `Goal.activateProject` 统一执行首次激活、paused 重激活和当前方案切换，不在应用层复制状态切换规则。
- 当前 active Project 查询刻意不添加 archived 过滤，确保 archived active Project 也会在切换时暂停；所选与原 active Project、`projectActivated` immutable Record、Goal / 所选 Project 两条 `logs` Relation 全部通过同一 `TransactionRunner` 原子持久化，activity detail 在切换时同时标明新旧 Project。
- SQLite-backed focused：1 suite / 15 tests 通过，覆盖全部拒绝路径无 mutation、两侧 timeline 可见性及第二条 Relation 失败时两个 Project 状态与 activity 的完整回滚；`npm run typecheck` 通过；full suite：94 suites / 637 tests 通过，0 snapshots。

§5 验证证据（2026-08-22）：

- Goal detail 继续通过 Goal ID 与 `archived: false` 只返回所属 Goal 的非 archived Projects，并保留 Project 行导航所需的 `id` / `name` / `status`、sub-goal count 与由唯一 `active` Project 推导的 `activeProjectId`。
- 每个 Project read item 新增必填应用层字段 `canSelectAsCurrentPlan`：仅 `planning` / `paused` 为 `true`，`active` / `done` / `failed` 为 `false`，UI 无需读取或复刻 domain lifecycle 规则；archived 与 foreign Projects 仍不进入读模型。
- SQLite-backed integration 覆盖真实 `CreateGoalProjectService` 与 `SelectCurrentPlanService` 写入后，`projectCreated` / `projectActivated` Records 均按 newest-first 出现在 Goal recent activity，并验证激活后的 current-plan 与 eligibility 输出。
- focused：1 suite / 8 tests 通过；`npm run typecheck` 通过；full suite：94 suites / 638 tests 通过，0 snapshots。

### 6. Goal Project Management UI 与接线

- [x] `goal-project-management` §6–§7；Project Due 按本计划“计划边界与依赖裁决”使用 shared native date picker。

验证证据（2026-08-22）：

- Goal detail 的 Projects 区始终显示 **New project — another way to reach this goal**（包括空列表），存在可选 Project 时显示 **Choose current plan**；原 Project 行详情导航、loading、unknown 与 read-error 状态保持。
- 新建 Project sheet 使用 shared native `DatePickerRow`，Goal 有 Due 时将 UI 最大可选日期限制为其前一个本地日历日，同时提交前继续执行严格早于校验并由 domain 作最终校验；必填名称、inline error、service error 后保留输入值、loading / duplicate-submit guard、成功关闭与刷新均已覆盖。
- current-plan picker 只展示当前 active 与 read model 标记为可选的 planning / paused Project；active 项 selected / disabled，首次选择立即提交，替换时明确提示原方案将暂停并要求确认，成功后关闭、刷新并更新 Current plan marker。
- `AppServices` / `composeServices` 注册真实 `CreateGoalProjectService` 与 `SelectCurrentPlanService`，Dashboard / Library 共用 Goal wrapper 注入二者；SQLite-backed composition regression 逐一从两条 destination route 验证真实 create / select 写入与刷新。
- focused：3 suites / 15 tests 通过；`npm run typecheck` 通过；full suite：95 suites / 648 tests 通过，0 snapshots。

### 7. Goal / Task scheduling UI

- [ ] `start-time-and-date-input` §7。

### 8. 迁移其余日期输入

- [ ] `start-time-and-date-input` §8。

### 9. 文档、组合回归与全周期验收

- [ ] `goal-project-management` §8。
- [ ] `start-time-and-date-input` §9。
- [ ] 按 `goal-project-management` §9、`start-time-and-date-input` §10 完成独立验收。
- [ ] 对三份冻结计划执行跨计划集成回归，运行 `npm run typecheck` 与 `npm test -- --runInBand`。
- [ ] 生成 `docs/cycles/cycle-3/cycle-report.md`，按 domain、application、infrastructure、UI 分层记录产出、验证、偏差、遗留项及任务 commit。

## 执行与提交规则

- 获批后，每个上述实施任务使用一个全新的 sub-agent；同一 sub-agent 不复用于后续任务。
- 每完成一个任务项，立即更新本计划、创建独立 commit，并在 commit message 中包含 `cycle-3` 与任务范围。
- 跨计划共享能力只实现和提交一次，后续任务引用该提交，不复制实现。
- 每个任务开始前检查工作树；只暂存该任务文件，保留用户改动与其他任务改动。
- 周期报告必须明确记录相对冻结计划的裁决或偏差，不把范围外改动归入本周期。

## 准备时基线

- 准备日期：2026-08-22（Asia/Shanghai）。
- 基线 HEAD：`16c7c5d`。
- `npm run typecheck`：通过。
- `npm test -- --runInBand`：88 个测试套件 / 536 个测试通过，0 snapshots。
- 工作树在准备前已有未提交的 AGENTS、issues 与 exec-plans 文档改动；这些改动不属于本计划文件和快照创建提交。

## 批准门

用户已于 2026-08-22 批准按本计划启动 Cycle 3，可从“1. Dashboard entity navigation”开始实施。
