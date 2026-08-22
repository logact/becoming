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

- [x] `start-time-and-date-input` §7。

验证证据（2026-08-22）：

- Goal / Task detail header 将 Start 与 Due 同时展示，两者都缺失时明确显示 **No schedule**；共享 `ScheduleEditor` 提供可选 Start / Due native picker，以本地日历日互设 `maximumDate` / `minimumDate`，支持同日、替换与单独清除任一日期，提交前 UI guard 与 domain 最终校验并存。
- Goal / Task 的 Schedule action 分别调用独立 `ScheduleGoalService` / `ScheduleTaskService`，生成 Record / Relation IDs；成功后关闭 editor 并刷新 header 与 activity，失败保留已选值并 inline 显示错误，write-in-flight guard 阻止重复提交。`AppServices` / `composeServices` 注册两个真实 service，Dashboard / Library 共用 Goal / Task route 均注入，SQLite-backed composition regression 验证两种实体的持久化与 activity 可见性。
- Dashboard、Goals、Tasks 对 `readyToStart` 统一使用 **Ready to start** copy 与 play icon；Dashboard reason→icon 为完整 typed mapping，reason switch 显式处理 ready 分支。已排期 `todo` 仍不进入 Doing，Task 的显式 **Start** 等 lifecycle labels 与行为未改。
- native picker boundary 测试覆盖 initial / set / replace / clear each date、同日互惠 bounds、非法 range UI guard / domain-service error、Cancel、错误值保留、duplicate-submit guard、成功刷新 activity、ready attention copy 与显式 Start 保留。focused：12 suites / 56 tests 通过；`npm run typecheck` 通过；full suite：96 suites / 660 tests 通过，0 snapshots。

### 8. 迁移其余日期输入

- [x] `start-time-and-date-input` §8。

验证证据（2026-08-22）：

- Create from Idea 的 Goal / Task 表单均使用一组可选 Start / Due `DatePickerRow`，Goal 不再重复显示旧 Target date；两个 creation service command 均直接接收本地日历 `Date` 值。Add to plan 的 Sub-goal / Task 同样传递可选 Start / Due，Milestone Date 改为 required picker 且无 Clear。
- Allocate resource 的 time span Start / End 改为 optional datetime picker，保留显式 Clear、Cancel 不提交中间值、minute precision、跨日能力与提交时 `startAt < endAt` 严格校验；quantity amount 流程未改。
- `rg` 确认 production 中无 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` 提示、无 `parseDateText` / `parseDateTimeText` caller；删除两个 parser 及其 parser-only tests，保留 shared locale-aware `dateFormat` helpers。Goal Project Management 的 Project Due 仍为 shared `DatePickerRow`；Quick Capture 未修改。
- focused Idea / Project / component / shared：12 suites / 80 tests 通过；`npm run typecheck` 通过；full suite：95 suites / 657 tests 通过，0 snapshots。

### 9. 文档、组合回归与全周期验收

- [x] `goal-project-management` §8。
- [x] `start-time-and-date-input` §9。
- [x] 按 `goal-project-management` §9、`start-time-and-date-input` §10 完成独立验收。
- [x] 对三份冻结计划执行跨计划集成回归，运行 `npm run typecheck` 与 `npm test -- --runInBand`。
- [ ] 生成 `docs/cycles/cycle-3/cycle-report.md`，按 domain、application、infrastructure、UI 分层记录产出、验证、偏差、遗留项及任务 commit。

跨计划集成回归证据（2026-08-22）：

- 共享 route / composition 审核确认 Dashboard 与 Library 复用同一 Goal / Task / Project / Idea / Note entity resolver；Goal wrapper 同时注入 `CreateGoalProjectService`、`SelectCurrentPlanService` 与 `ScheduleGoalService`，Task wrapper 同时注入 `TaskLifecycleService` 与 `ScheduleTaskService`，production composition 全部基于同一组 SQLite repositories 与 `SqliteTransactionRunner` 构造。Goal detail 的 Project 嵌套路由继续留在发起 destination 栈，Back 恢复原 Dashboard / Library 上下文。
- Dashboard 审核覆盖 Doing 与 Needs attention 的 typed entity navigation、Back / tab-bar 恢复、`readyToStart` Goal / Task 文案且 scheduled `todo` 不进入 Doing、Remove 阻止 row navigation 并通过真实 `AttentionService` 持久化 dismiss、Recent activity 维持非交互。既有 focused regression 同时覆盖所有 Dashboard entity types、ready 优先级 / 去重 / 排序与 dismissal。
- Goal detail 的 New Project、Choose current plan 与 Schedule 共用 shell 的单一 sheet slot；任一普通 sheet 存在时 Global Capture button 被 shell 抑制，关闭后恢复。Project creation 的 `goal-project-due` 与 Goal schedule 的 `goal-schedule-editor-*` 各自持有独立 controlled state / native picker test IDs；Project Due 仍受 Goal Due 前一个本地日历日的 native `maximumDate` 与提交 / domain 双重校验，未与 reciprocal Goal Start / Due bounds 冲突。
- Create from Idea 的 Goal / Task creation 将 picker 选出的本地日历 `Date` 直接传入真实 creation commands；创建后 Idea detail 刷新，derived Goal 使用 `openDetail`、derived Task 使用 `task:<id>` shared route，因而均进入已注入 schedule service 的详情页。Add to plan 的 Sub-goal / Task / Milestone 与 Allocate resource 的 datetime span 同样保留 semantic `Date` command values、required / optional、clear / cancel 与 range validation；Project detail 的 add-plan-item / allocate-resource 嵌套路由未退化。
- SQLite v4 审核确认 fresh Goal / Task DDL、conditional `start_at` migration、partial-v3 healing、repository epoch-ms round trip 与 `PRAGMA user_version = 4` 一致；`makeFakeRepos()` 继续使用 `NodeSqliteDatabase(':memory:')`、`migrate(db)` 与 production SQLite repository implementations。Quick Capture / CaptureComposer / GlobalCapture 相对 Cycle 3 准备基线无改动，SQLite integration 继续覆盖四种 capture intent 与 rollback。
- broad focused integration：32 suites / 257 tests 通过，0 snapshots；`npm run typecheck` 通过；full suite：95 suites / 657 tests 通过，0 snapshots。production `rg` 未发现 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm`、`parseDateText` / `parseDateTimeText`，所有 production date / datetime form call sites 均使用 shared `DatePickerRow`；`git diff --check` 通过。
- 未发现跨计划实现缺口或冻结计划偏差；本任务仅记录该集成验收证据，保留 cycle-report checkbox 待后续独立任务完成。

联合独立验收证据（2026-08-22）：

- 逐项复核 `goal-project-management` §9：Goal detail 的 New Project entry 在有/无 Project 时恒定存在；domain / application 双层拒绝空白名称与不合法 Due，新建 Project 永久归属 Goal 且默认为 `planning`。Goal-detail read model 只返回所属 Goal 的 non-archived Projects，并只将 `planning` / `paused` 标记为可选；UI 将 active 显示为 selected / disabled，首次选择直接执行，替换 active 时先确认。service 继续显式拒绝 archived / done / failed / foreign / unknown / already-active Project 及 unknown / archived Goal，并通过同一 SQLite transaction 原子暂停旧 active、激活所选项、写 immutable Record 与 Goal / selected Project 两条 timeline Relation；creation 同样原子写 Project、Record 及 Goal / new Project timelines。成功后 sheet 关闭、detail 刷新并更新 Project 列表 / Current plan marker；Dashboard 与 Library 复用同一个 Goal route wrapper 及同一组 production services，SQLite-backed composition regression 从两条 route 验证真实写入。`git diff 3c7a504..a486b71` 确认该 feature 未修改 schema / migration / SQLite repository。
- 逐项复核 `start-time-and-date-input` §10：Goal / Task 的 optional `startAt` / `due` 由 domain `setSchedule` 原子 set / change / clear，按本地日历日校验 `startAt <= due` 并接受同日时分倒序；`isReadyToStart` 只派生 non-archived `todo`，不改变 lifecycle。Dashboard / Goals / Tasks 均保留 failed、overdue / dueSoon、resource exhaustion、ready-to-start、pinned 优先级与单 target 去重，ready 项按最早 `startAt` 排序；scheduled `todo` 不进入 Doing，显式 Start 行为不变。SQLite fresh DDL、v4 conditional migration、repository epoch-ms mapping 覆盖 populated / absent 往返、v3 数据保留及单列 partial migration healing。Schedule services 覆盖四种 optional 组合、unknown / archived、linked immutable activity 及 late Relation failure rollback。
- Shared `DatePickerRow` 审核覆盖 date / datetime、本地 calendar / minute preservation、iOS draft Done / Cancel / backdrop、Android atomic date→time dialog、empty optional today seed、bounds、optional explicit Clear、required no-Clear 与 disabled 状态。Create from Idea、Add to plan、Milestone、Project Due、Allocate resource、Goal / Task detail 全部使用 native picker；structured Goal / Task creation 传递 semantic `Date`，Quick Capture / CaptureComposer 未增加 schedule。production `rg` 未发现 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` 指引、date text parser 或手工 date TextInput。
- 文档审核发现并修正 1 处矛盾：`docs/domain/domain.md` 的 AttentionEntry glossary 原先漏列 ready-to-start；现已与后文 domain rule 和 design 文档一致。未发现代码或测试缺口，也未产生实现偏差。
- focused domain / application / infrastructure / UI / composition：32 suites / 302 tests 通过，0 snapshots；`npm run typecheck` 通过；full suite：95 suites / 657 tests 通过，0 snapshots；`git diff --check` 通过。

`goal-project-management` §8 验证证据（2026-08-22）：

- `docs/design/design.md` 记录 Project 作为 Goal 的备选方案、新建默认为 `planning` 且不自动成为 current plan，并准确描述 non-archived `planning` / `paused` eligibility、首次激活、替换确认及旧 active Project 暂停。
- 文档同步 shared native optional Project Due picker 与 Goal Due 之前的边界，并明确 creation activity 只关联 Goal / 新 Project、selection activity 只关联 Goal / 所选 Project，未声称 replaced Project timeline 有该记录。
- 实现核对：`Project` / `Goal.activateProject`、`CreateGoalProjectService`、`SelectCurrentPlanService`、`GoalDetailService` 与 `GoalDetailPage`；`npm run typecheck` 与 `git diff --check` 通过。

`start-time-and-date-input` §9 验证证据（2026-08-22）：

- composition 审核确认 `AppServices` 声明、`composeServices` 构造及 Dashboard / Library 共用 Goal / Task detail route 已完整注册并注入 `ScheduleGoalService` / `ScheduleTaskService`；二者复用 production SQLite repositories 与同一个 `SqliteTransactionRunner`。现有 composition regression 已从两条共享 route 执行真实 schedule 写入、detail 刷新与 linked activity 查询，fixture 来自 `NodeSqliteDatabase(':memory:')` + migration + SQLite repository implementations，因此未新增重复 test double 或 composition code。
- `docs/domain/domain.md` 记录 date-only `startAt`、与 lifecycle `start(now)` 的分离、本地日历日 `startAt <= due`（同日有效）、原子 optional set / clear、`isReadyToStart` 边界及 attention 优先级 / 去重 / 排序；`docs/design/design.md` 记录 detail schedule editor、ready copy、structured creation scheduling 与不变的 Quick Capture；`docs/design/design-style.md` 固化 reusable native `DatePickerRow` 的外观、local date/datetime、iOS Done / Cancel、Android date→time、optional Clear / required 规则及移除键盘格式输入。
- production audit 未发现 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` 提示、`parseDateText` / `parseDateTimeText` caller 或手工 prompt；focused composition：1 suite / 2 tests 通过；`npm run typecheck` 通过；full suite：95 suites / 657 tests 通过，0 snapshots；`git diff --check` 通过。

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
