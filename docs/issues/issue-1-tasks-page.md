# Issue 1: Tasks 页与 Task 详情页

来源：用户提出「设计 tasks 与 task 页面：tasks 页是所有任务的 dashboard；task 详情页展示描述与执行记录」。

已确认的决策（与用户对齐）：
- 入口：Library hub 新增 Tasks 行，与 Goals/Projects 页一致，底部导航不变。
- All tasks 列表：status 与 project 都要体现 —— 按 status 分组，每行副标题显示所属项目名。
- Task 详情页：本期包含生命周期操作（start / pause / resume / complete / reopen），不只是只读展示。
- 先落本 issue 文档，exec-plan 后续生成。

## 1. Tasks 页（所有任务的 dashboard）

对齐 `docs/design/design.md` 中 Goals 页的 dashboard 模式，自上而下：

1. Overview stats：`StatTile` 展示 doing / todo / done / overdue 数量。
2. Needs attention：过期任务、2 小时内到期任务（对齐 design.md 的 attention 规则）、failed 任务。
3. Doing now：doing + paused 任务，行副标题带所属项目名。
4. Breakdown：按 status、按 label 的分布。
5. All tasks：按 status 分组的 panel 列表（todo / doing / paused / done / failed），每行副标题显示项目名，trailing 为 `StatusPill`；点击行进 Task 详情页。
6. Recent activity：任务相关的 record 列表（design.md 决策：每个模型页底部放 activity）。

## 2. Task 详情页（`task:<id>` 推入）

1. Header：标题、`StatusPill`、due；所属 project 行（可点回 project detail）、所属 goal（若有）。
2. Description：完整描述；无描述时显示空态。
3. 生命周期操作区：按当前状态展示可用操作 ——
   - todo → Start
   - doing → Pause / Complete / Fail
   - paused → Resume / Fail
   - done / failed → Reopen
4. Execution records：经 `RecordRepository.listByTarget('task', id)` 取该任务的生命周期事件（taskCreated / taskStarted / taskPaused / taskResumed / taskCompleted / taskFailed / taskReopened），时间线展示，样式对齐 ProjectDetailPage 的 activity 区。

## 3. 分层影响（初步，exec-plan 细化）

### 领域层
- `Task` 生命周期方法已齐全，无需改动。

### 应用层（新建服务，不改现有服务）
- `TasksOverviewService`：读模型，聚合 stats / attention / doing / breakdown / 分组列表 / 任务相关 activity；需要项目名（`ProjectRepository`）与 label 名（`LabelRepository`）。
- `TaskDetailService`：读模型，任务本体 + 项目名 + 目标名 + execution records。
- `TaskLifecycleService`（写）：`start / pause / resume / complete / fail / reopen`，调用 `Task` 对应方法后 save，并按 `ConsumeResourceService` 的模式 append `Record` + `Relation`（record → task，kind 如 `logs`），让 execution records 有数据源。

### UI 层
- 新增 `src/ui/pages/tasks/TasksPage.tsx` 与 `TaskDetailPage.tsx`（+ 各自测试），复用 `StatTile / ListRow / ListSection / StatusPill / SectionHeader / SectionNote / InlineNavBar`。
- `src/ui/appDestinations.tsx`：library 目的地 renderList 的 hub 加 Tasks 行；renderScreen 增加 `'tasks'` 与 `'task:<id>'`。
- `src/ui/composition/composeServices.ts`：注册三个新服务；`devSeed.ts` 补任务生命周期 record 示例数据。

### 文档
- 实现时同步 `docs/design/design.md` 的 pages 列表（新增 tasks 页条目）。

## 4. 验收

- Tasks 页各区块数据正确（stats / attention / 分组 / activity）。
- Task 详情页展示描述与 execution records；生命周期操作可执行且产生对应 record，返回后列表状态更新。
- `npm run typecheck`、`npm test` 全绿。
