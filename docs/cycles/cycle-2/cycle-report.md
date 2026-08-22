# Cycle 2 报告

状态：**已完成**。

范围：

- `ideas-workflow`
- `tasks-page`
- `project-detail-alignment`
- `notes`
- `universal-capture`

执行依据为 `docs/cycles/cycle-2/cycle-plan.md` 及 `docs/cycles/cycle-2/snapshots/` 中五份冻结计划。`project-detail-alignment` 的产品实现继承 Cycle 1，本周期完成集成回归；其余四项完成领域、应用、基础设施、UI、文档与验收工作。

## 最终验证

- 2026-08-22 终验：`npm run typecheck` 通过。
- 2026-08-22 终验：`npm test -- --runInBand` 通过，**88 个测试套件 / 536 个测试**全部通过，0 snapshots。
- Cycle 2 准备时基线为 51 suites / 350 tests；终验净增 37 suites / 186 tests。
- Ideas / Notes 阶段验收：82 suites / 490 tests；Universal Capture 阶段验收：87 suites / 534 tests；全周期与 Project Detail 回归终态：88 suites / 536 tests。
- 五份冻结计划的自动验证与可在仓库环境完成的原型/设计静态对照均已复核，未发现阻塞交付的已知缺口。

## 各计划交付结果

### Tasks 页与 Task 详情

- 领域：`Task.isOverdue(now)` 成为过期判断的单一规则来源，覆盖无 due、完成、失败、归档、严格早于 now 与未来 due 边界。
- 应用：新增 `TasksOverviewService`、`TaskDetailService`、`TaskLifecycleService`；总览包含统计、attention 排序、状态分组、label 计数和近期活动，详情与 start/pause/resume/complete/fail/reopen 均写入 activity。按计划确认的例外扩展现有 `AddTaskService`，补齐 `taskCreated` record 与 `logs` relation。
- UI：新增 Tasks 总览、Task 详情和生命周期操作；Library → Tasks → `task:<id>` 导航、返回、Dashboard/Goal/Project 中的 Task 跳转和 activity icon 均已接通。
- 验收：覆盖 overdue 边界、六个内容区块、attention 顺序、全部生命周期按钮、record detail、Add Task activity 与导航往返。

### Ideas 工作流

- 领域：补齐 Idea content/status 工作流规则；派生关系统一为 `goal|task|note --derivedFrom--> idea`，并保持原 Idea，不采用复制后删除。
- 应用：新增 Ideas overview/detail、capture、edit、change-status、Create Goal、Create Task 服务；派生服务在共享 transaction 中创建实体、复制 labels、写 relation/activity 并将 Idea 标记为 handled。`IdeaDerivationOptionsService` 为 Project/Goal picker 提供 UI 专用读模型。
- 基础设施：Idea 使用现有 SQLite repository；共享 `TransactionRunner` 端口、Node/Expo SQLite transaction adapter 在本阶段落地，供 Ideas、Notes 与 Universal Capture 复用。
- UI：Library → Ideas → Idea detail、Open/Handled 与 captured/exploring/paused 分组、状态/内容编辑、Goal/Task/Note 派生、详情跳转和 toast 已接通。
- 验收：覆盖 content trim/blank、status、overview/detail、六类写用例、派生 Project/Goal 约束、多仓储失败回滚、列表与详情交互。

### Notes 工作流

- 领域：Note 增加 `pinnedAt`、pin/unpin、restore；pin 不改变 `updatedAt`，archive 与 pin 独立。关系沿用通用 `derivedFrom` / `relatesTo`。
- 应用：新增 Notes overview/detail、capture、edit、pin、archive、从 Idea 提取、link、delete 与 link-options 服务；Library overview 增加 Notes count。
- 基础设施：新增 notes schema/migration、`SqliteNoteRepository`、entity-label 往返与测试；归档保留 labels/links，事务失败可回滚。
- UI：Library → Notes、Active/Archived/Pinned/Linked 分组、Note detail、编辑、置顶、归档/恢复、删除、Goal/Project link，以及 Ideas 中的 Note 派生入口均已接通。
- 验收：覆盖 pin/restore/archive 语义、repository 过滤/往返、链接、Idea handled 与双侧 activity、归档后 labels/links 保留。

### Universal Capture

- 领域：按计划不新增 Capture model、table 或独立 Inbox；inbox/idea 映射为 captured Idea，Goal 为 top-level todo，Task 保持 required Project，Note 为普通未归档 Note。
- 应用：新增 `CaptureOptionsService` 与 `QuickCaptureService`。四类实体创建统一 trim/blank 校验，写入对应 `quickCaptured*` record 和 `record --logs--> entity` relation；Task 在服务层拒绝 unknown/archived Project。
- 基础设施：复用同一 SQLite connection、现有 entity/record/relation repositories 与共享 transaction runner；集成测试覆盖四类 round-trip、Task Project context、activity 查询及第二/第三次写入失败回滚，无 Capture 专属 migration。
- UI：新增 app-shell 级 FAB、composer、`GlobalCapture`、NavigationShell ownership、Project picker、toast 与 `captureRevision`。Dashboard / Ideas / Goals / Tasks / Notes 成功创建后不 remount 刷新；tab、pushed detail、safe area、普通 sheet 抑制、键盘滚动、focus、loading/error/reset、accessibility 与防重复提交均有覆盖。
- 文档/原型：修正 Task required Project picker，同步 app-shell、FAB/composer 样式、状态与交互说明；未新增 prototype page，因此未修改页面索引。

### Project Detail Alignment（继承与回归）

- 领域、应用、基础设施、UI 的 §1–§4 已在 Cycle 1 commit `60d9e7a` 完成，本周期没有重复实现或重新归属这些产出。
- Cycle 2 重点验证 Tasks §2.4 对 `AddTaskService` 构造与调用参数的影响。新增 SQLite-backed 组合回归，覆盖 Library → Project → Add Task → 返回后 Tree 刷新、`taskCreated` record + `logs` relation，以及 dev seed 中嵌套 Goal、3 个 milestone、数量/时间资源和 Task activity。
- 再次静态对照 project-detail / add-plan-item / allocate-resource 原型，头部周数/进度、Tree/List/Roadmap、Today/Project due、Add/Allocate、导航、组合根与 seed 保持一致；未发现需修改的产品代码。

## 分层汇总

### 领域层

- Task 过期边界；Idea 状态/content 与派生关系；Note pinned/archive/restore 语义均落在各自 domain。
- Capture 保持应用层用例，没有为了 UI 引入新领域实体或放宽 Task 的 Project invariant。
- Goal/Task/Note/Idea 的既有 lifecycle 定义未因跨领域入口而改变。

### 应用层

- 读写服务按用例拆分，主要新增 Tasks、Ideas、Notes、Capture 四组服务。
- 跨 repository 写入统一使用 `TransactionRunner`；页面不直接访问 repository。
- 轻量 options/read 服务为 picker 与 Library count 提供最小 UI contract。

### 基础设施层

- 新增共享 SQLite transaction adapter、notes migration/repository；Ideas、Tasks、Universal Capture 复用既有 repositories。
- 集成测试覆盖 Note 持久化、各类 capture、relation/activity 查询和事务回滚。
- 测试 fake 保持 Node SQLite `:memory:` + migrate + 正式 SQLite repository 的实现方式，不复制业务逻辑。

### UI 与组合层

- Library 新增 Tasks、Ideas、Notes 可达入口及详情 routes。
- 新增各总览/详情/派生与生命周期页面，并在 composition root 注册所需服务。
- Universal Capture 位于 NavigationShell，保持当前 destination/stack，规避 sheet 叠层并通过 revision 刷新受影响集合。

### 文档与原型

- `docs/design/design.md`、`docs/design/design-style.md`、`docs/domain/domain.md` 与共享 prototype 脚本/样式同步实现决策。
- Cycle 2 聚合计划持续记录每阶段验收；五份冻结计划在 planning commit `1c41e8c` 中建立。

## 跨计划裁决与偏差

- Notes 计划的替代条款优先于 Ideas 原计划对 Note 的排除：最终 Create from Idea 同时保留 Goal / Task / Note。Note 派生同样 handled 原 Idea、注册 `note:<id>` 并记录双侧 activity。
- `TransactionRunner` 只实现一次，Ideas、Notes、Universal Capture 共用，避免重复 adapter 与非原子写入。
- Tasks 先注册 `task:<id>` route，Ideas 的派生 Task 与 Project Add Task 后续直接复用该详情入口。
- Project Detail §1–§4 继承 Cycle 1，仅对本周期 AddTask activity contract 做回归，不重复提交产品实现。
- Tasks 的 recent activity 保留冻结计划中的有意简化：按 `task*` record kind 过滤，不增加 relation join 查询。
- Note 删除按冻结计划只删除 Note 与 entity labels；可能悬空的 relations 由查询端防御，本周期不实现 relation unlink/cascade。
- 为满足 UI 的专用读模型与完整交互，除主体服务外增加 `IdeaDerivationOptionsService`、`NoteLinkOptionsService`、`DeleteNoteService`，并扩展 `LibraryOverviewService` Notes count；这些服务维持 UI 不直连 repository 和“优先新增应用服务”的结构规则。
- Universal Capture 为键盘手工验收风险增加可滚动 keyboard container；这是交互加固，不改变产品语义。
- 没有新增 Capture table、全局 event bus 或 Capture domain；刷新采用 UI 层 `captureRevision`。

## 任务与 commit 对照

| 任务 | Commit |
| --- | --- |
| 周期计划、冻结副本、批准与基线审计 | `1c41e8c`, `1e547b5`, `f418304` |
| Tasks §1.1 领域边界 | `675a6ba` |
| Tasks §2 应用服务与 AddTask activity | `37da3db` |
| Tasks §3–§5 UI、导航与验收 | `c4882ae` |
| Ideas 领域与共享 transaction 基础 | `321a1e8` |
| Notes 领域与 SQLite 基础 | `69c7f12` |
| Ideas overview/detail/capture/edit/status | `41a396e` |
| Idea → Goal / Task 派生 | `d0f3953` |
| Notes overview/detail/capture/edit/pin/archive | `4768c3c` |
| Idea → Note 与 Note linking | `2cc2f63` |
| Ideas UI 与接线 | `18a8a26` |
| Notes UI 与接线 | `b731144` |
| Ideas / Notes 独立验收 | `15ea16d` |
| Universal Capture 原型、设计与领域边界 | `cecaafc` |
| Universal Capture 应用服务与 SQLite 集成 | `65dbf7b` |
| Universal Capture shell UI、接线与刷新 | `5e63ad4` |
| Universal Capture 独立验收 | `5571fcb` |
| Project Detail 继承结果回归 | `e89e71c` |
| 五计划全周期验收 | `6aad85f` |
| 本报告与周期完成状态 | 本报告提交 |

`b5213b5`（`refactor:refactor the fake repo in the unit test`）是 Cycle 2 planning commit 之前已经存在的用户提交，不是 Cycle 2 agent task commit；本报告不把它计入上述任务映射或 Cycle 2 产出。

## 遗留与明确不在范围内

Cycle 2 没有已知阻塞项。以下保持为冻结计划明确排除或既有简化，不应被误报为未完成的周期任务：

- Ideas：删除、批量操作、全文搜索、高级 label 筛选；创建新 Project；在派生 Task 时创建 Goal/Milestone。
- Notes：全文搜索、label 筛选 UI、unlink/relation 编辑；Note relation 级联清理仍采用查询端悬空防御。
- Universal Capture：附件/图片/语音/OCR/share sheet/widget/快捷指令、AI 类型识别与拆解、composer 内完整 due/label/milestone/link 编辑、创建 Project/sub-goal/无 Project Task、可拖动 FAB、独立 Inbox domain、同步与冲突处理。
- Project Detail：goal 级资源分配、资源周期单位、allocate 中创建新资源，以及 Cycle 1 报告列出的非计划原型细节仍不在本周期范围。
- Tasks：近期活动仍采用 kind 前缀过滤这一已确认简化，不扩展 repository join。

## 工作树归属说明

- 报告完成时，工作树中已有未提交的 `AGENTS.md` 修改和五个 `docs/cycles/cycle-2/snapshots/*.md` 删除；它们不是本报告任务的改动，未被 stage、restore 或纳入 Cycle 2 agent commit。
- 五份冻结 snapshot 虽在当前工作树显示删除，仍由 planning commit `1c41e8c` 创建并在本报告生成前的 `HEAD` 中保持 tracked；Cycle 2 的执行与验收依据没有丢失。
- 本报告提交只包含 `docs/cycles/cycle-2/cycle-report.md` 与 `docs/cycles/cycle-2/cycle-plan.md` 的完成状态更新。
