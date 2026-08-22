# Cycle 3 报告

状态：**已完成**。

范围：

- `dashboard-item-navigation`
- `goal-project-management`
- `start-time-and-date-input`

执行依据为 `docs/cycles/cycle-3/cycle-plan.md` 与 `docs/cycles/cycle-3/snapshots/` 中三份冻结计划。周期准备时的完整原型快照保存在 `docs/cycles/cycle-3/prototype-snapshot/`；本周期按该快照及冻结计划实施、验收，没有以后续 source issue / exec-plan 的移动或改写扩大范围。

## 最终验证

- 2026-08-22 终验：`npm run typecheck` 通过。
- 2026-08-22 终验：`npm test -- --runInBand` 通过，**95 个测试套件 / 657 个测试**全部通过，0 snapshots。
- Cycle 3 准备时基线为 88 suites / 536 tests；终验净增 **7 suites / 121 tests**。
- `git diff --check` 通过；最终工作树检查确认本报告提交只包含 cycle plan/report，准备前已有用户改动继续保持未提交且未被改写。
- 各阶段 focused、full-suite 与跨计划验收均记录于 `cycle-plan.md`；最终跨计划 broad focused regression 为 32 suites / 257 tests，联合独立验收 focused regression 为 32 suites / 302 tests。
- Goal Project creation 阶段曾出现一次与该任务无关的 `CaptureComposer` async timing 失败；报告终验的第一次 full-suite 运行又命中同一 dismissal wait（94/95 suites、656/657 tests 通过）。两次均在该 suite 单独复跑后通过；本次随后完整重跑收敛为上述 95 suites / 657 tests。该瞬时失败没有被隐藏，也没有导致为通过测试而修改 Quick Capture。

## 各计划交付结果

### Dashboard Navigation

- Dashboard 与 Library 共用 Goal detail wrapper 及 Task / Project / Idea / Note typed entity resolver；Project 的 add-plan-item / allocate-resource 嵌套路由继续保留在发起 destination 的 stack。
- Doing now 与 Needs attention 的 Goal、Task、Project、Idea 行按实体类型进入正确详情；Back 回到 Dashboard 并恢复 tab bar 与原上下文。
- Remove 是独立 trailing action，会阻止 row navigation、只持久化 dismiss；Recent activity 因读模型不携带 target entity 而保持非交互；`attention-pin` 和 unknown-route 边界保持原行为。
- 验收修正了一项过时的 Projects UI 测试：Library Project 行现在应遵循 `project:<id>` 导航 contract，同时保留全局 `ListRow` 的 button 可访问性语义。该修正对齐既有真实产品行为，不是功能范围扩张。

### Goal Project Management

- `Project.create` / `rename` 统一拒绝空白名称；activation 只允许 `planning` / `paused` 进入 `active`。`Goal.activateProject` 继续负责归属检查、暂停旧 current plan 与激活新方案。
- 新增独立 `CreateGoalProjectService` 与 `SelectCurrentPlanService`。创建时 Project 默认为 `planning` 并永久关联 Goal；选择首个方案直接激活，替换时原 active Project 在同一事务内暂停。两种命令都写 immutable activity，并通过 Relation 出现在约定的 Goal / Project timeline；后段写入失败会完整回滚。
- Goal detail read model 只返回所属 Goal 的 non-archived Projects，保留 sub-goal count 与 navigation data，并用 `canSelectAsCurrentPlan` 明确标记只有 `planning` / `paused` 可选。
- Goal detail 始终显示 **New project — another way to reach this goal**，有 eligible Project 时显示 **Choose current plan**。active 方案 selected / disabled；替换方案先确认；成功后关闭 sheet、刷新列表和 Current plan marker。
- Dashboard 与 Library 的 Goal route 注入同一组真实 create/select services，SQLite-backed composition tests 从两个 destination 验证了创建、切换、刷新与 activity。
- 本计划没有引入 schema 变更；Project、Record、Relation 与既有 transaction infrastructure 足以完成全部行为。

### Start-Date / Date Input

- Goal / Task 新增可选 date-only `startAt`、原子 `setSchedule` 与 `isReadyToStart`。Start 是计划元数据，不自动改变 lifecycle；同一 calendar date 的 Start / Due 合法，只有跨本地日历日的 `startAt > due` 才拒绝。
- SQLite schema 升级为 v4，为 Goals / Tasks 条件式增加 nullable `start_at INTEGER`；fresh、v1、v2、v3 和只存在一列的 partial migration 均收敛，repository 以 epoch milliseconds 往返，旧行恢复为 `undefined`。
- 新增独立 `ScheduleGoalService` / `ScheduleTaskService`，在同一 SQLite transaction 中保存 schedule、immutable Record 与 Relation；unknown / archived target、非法日期顺序与 late-write rollback 均有 SQLite-backed tests。AddSubGoal、AddTask、Idea → Goal / Task 的 structured creation commands 同步传递可选 Start / Due。
- Dashboard、Goals、Tasks 的 attention 增加 `readyToStart`，直接调用 domain rule，保持 failed、overdue / dueSoon、resource exhaustion、ready-to-start、pinned 的优先级和单 target 去重；ready items 按最早 `startAt` 排序。scheduled `todo` 不进入 Doing，既有显式 Start 操作不变。
- 新增共享 `DatePickerRow`，统一 date / datetime、optional / required、Clear、bounds、本地 locale 展示，以及 iOS Done/Cancel draft 和 Android 原子 date→time dialog。Goal / Task schedule、Idea structured creation、Project Add to plan、Milestone、Goal Project Due 与 resource allocation 全部迁移为 semantic `Date` 值；production 不再包含手工 `YYYY-MM-DD` / `YYYY-MM-DD HH:mm` 输入或 date-text parser caller。
- Quick Capture / CaptureComposer 保持紧凑且不接受 schedule；快速创建后的 Goal / Task 可从详情页排期。

## 分层汇总

### 领域层

- Goal / Task 持有 schedule invariant 与 ready-to-start rule；local-calendar 比较避免时区或同日时分导致错误拒绝。
- Project 持有名称与 lifecycle eligibility；Goal 持有 current-plan ownership/switch invariant。
- lifecycle 状态没有因 `startAt` 自动迁移，应用/UI 不复制领域判断。

### 应用层

- 新增 `ScheduleGoalService`、`ScheduleTaskService`、`CreateGoalProjectService`、`SelectCurrentPlanService`，保持按用例拆分而非扩张既有服务。
- Dashboard / Goals / Tasks / Goal detail / Project detail 读模型暴露 schedule、ready attention、Project eligibility 与 current plan 所需的最小 contract。
- structured creation paths 传递 semantic dates；Quick Capture command contract 保持不变。

### 基础设施层

- SQLite v4 migration、fresh DDL、expected columns 与 Goal / Task repository mapping 同步；partial-v3 healing 和旧数据保留均已覆盖。
- Goal Project Management 没有 schema change；所有跨 repository 写入复用 `SqliteTransactionRunner`。
- Application tests 继续使用 `NodeSqliteDatabase(':memory:')` + `migrate(db)` + production SQLite repositories，没有用手写 fake 复制 persistence/business logic。

### UI、导航与组合层

- Dashboard / Library 复用同一 entity route resolver 与详情 implementations；Dashboard stack、Back、tab bar、nested Project routes 和 attention actions 均保持 destination-local 语义。
- Goal detail 在同一 sheet slot 中协调 New Project、Choose current plan 与 Schedule；普通 sheet 打开时 shell 继续抑制 Global Capture。
- Goal / Task 详情使用共享 `ScheduleEditor`；所有 production date/date-time forms 使用共享 native picker。
- `AppServices` / `composeServices` 注册四个新 command service，并从 Dashboard / Library 共用 wrappers 注入；全部 production service 复用同一 SQLite repositories 与 transaction runner。

### 文档与原型

- `docs/domain/domain.md` 记录 `startAt`、本地日历不变量、lifecycle 分离及 ready attention；并在验收中补齐 AttentionEntry glossary 对 ready-to-start 的遗漏。
- `docs/design/design.md` 记录 Dashboard entity navigation、Project alternative/current-plan 行为、schedule 与 Quick Capture 边界；`docs/design/design-style.md` 固化 native picker 交互。
- 三份冻结计划和完整 prototype snapshot 均在准备提交中建立并作为本周期不变输入保留。

## 跨计划裁决与偏差

- `start-time-and-date-input` §8.5 优先于 `goal-project-management` §6.4 的旧文本输入描述：Project Due 使用 shared native picker，不实现手工 `YYYY-MM-DD` TextInput。Goal 有 Due 时，UI 最大值为其前一个本地日历日，提交与 domain 仍执行严格早于校验。
- 初版 schedule domain 按 instant 比较会错误拒绝“同一 local calendar date、Start 时刻晚于 Due 时刻”；后续 correction 将 Goal / Task 的 schedule order 与 readiness 统一为本地日历语义，符合冻结计划的 date-only 决策。
- Dashboard 与 Library 的 typed routes、Goal / Task detail services、SQLite transaction runner、native picker 与 ScheduleEditor 均共享一次实现，后续计划只注入/复用，没有复制能力。
- Goal Project Management 明确不改 schema；Start-Date 计划单独把 Goal / Task schema 升到 v4。报告分别归属这两项，避免把 v4 误算为 Project management migration。
- Quick Capture / CaptureComposer / GlobalCapture 未增加 schedule 字段或行为；structured creation 与 detail scheduling 承担日期能力。
- Library Projects 的旧测试仍断言行不可点击，与已建立的共享 `project:<id>` route 及 button accessibility contract 冲突；独立验收将它改为真实导航回归。
- 除上述两项按冻结计划裁决/语义修正，以及测试/文档对实际 contract 的纠正外，未发现冻结计划实现偏差。一次 `CaptureComposer` timing flake 已在“最终验证”中透明记录。

## 任务与 commit 对照

| 任务 | Commit |
| --- | --- |
| 周期计划、三份冻结计划与完整原型快照 | `73b7f09` |
| 用户批准与自动验证基线 | `3269e52` |
| Dashboard §2：共享 entity routes | `c26140e` |
| Dashboard §3：Dashboard rows navigation / Remove propagation | `e6242b2` |
| Dashboard §4–§5：tests 与设计文档 | `6c9cd5f` |
| Dashboard §6：独立验收与 stale Projects test 修正 | `ed3b613` |
| Start-Date §2：shared native date picker | `58781ee` |
| Start-Date §3：Goal / Task schedule domain | `3631b41` |
| Start-Date §3 correction：local-calendar semantics | `800db15` |
| Start-Date §4：SQLite v4 migration / repository mapping | `f1fb2d1` |
| Start-Date §5：schedule services / structured creation commands | `14c1cd5` |
| Start-Date §6：ready attention / read models | `3c7a504` |
| Goal Project §2：Project domain invariants | `7154f7d` |
| Goal Project §3：CreateGoalProjectService | `0870c58` |
| Goal Project §4：SelectCurrentPlanService | `df08c5f` |
| Goal Project §5：Goal detail Project read model | `a486b71` |
| Goal Project §6–§7：UI、composition 与 shared Project Due picker | `95548bd` |
| Start-Date §7：Goal / Task scheduling UI、composition、ready copy | `7fb643f` |
| Start-Date §8：迁移其余 manual date/date-time forms | `339c3f5` |
| Goal Project §8：设计文档与实现核对 | `5dec5f5` |
| Start-Date §9：domain/design docs 与 composition audit | `52d62d7` |
| Goal Project §9 / Start-Date §10：联合独立验收与 glossary correction | `b7f51de` |
| 三计划跨计划集成回归 | `7d4e1b4` |
| 本报告与周期完成状态 | 本报告提交 |

## 遗留与明确不在范围内

Cycle 3 没有已知阻塞项。以下是冻结计划明确排除或未授权的后续方向，不应被误报为本周期未完成：

- Quick Capture 内直接排期，以及 Capture composer 的 due/start/label 等完整编辑能力。
- Goal / Task 的 hour/minute scheduling 或由 `startAt` 自动触发 lifecycle transition。
- Project / Milestone 的 `startAt`，Project-management 专属 schema 或新 repository。
- Dashboard Recent activity target navigation；当前 read model 不提供 target entity。
- Archived / done / failed Project 的 current-plan selection，以及新 Project 自动替换 current plan。
- `docs/issues/future/`、`docs/exec-plans/archived/` 和未列入 Cycle 3 范围的 issues / plans。

## 工作树归属说明

- Cycle 3 准备前工作树已经存在未提交的 `AGENTS.md` 以及 issues / exec-plans 重组：旧 issue 路径的删除、`docs/issues/archieved/`、`docs/issues/future/`、`docs/issues/plan/` 与 `docs/exec-plans/{dashboard-item-navigation,goal-project-management,start-time-and-date-input}/` 等新增路径均属于用户改动，不是 Cycle 3 输出。
- 报告任务没有 archive、move、restore 或修改上述 source issue / exec-plan 文件；只更新 `docs/cycles/cycle-3/cycle-plan.md` 并新增本报告。
- 三份冻结 snapshots 与 prototype snapshot 由 `73b7f09` 提交并保持 tracked，是 Cycle 3 的执行证据，不受当前用户侧 source docs 重组影响。
