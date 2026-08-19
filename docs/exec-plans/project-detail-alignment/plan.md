# 项目详情页全量对齐原型

来源：用户反馈「项目详情页与计划和原型差距大」。目标：让 `src/ui/pages/projects/ProjectDetailPage.tsx` 与 `docs/design/prototype/pages/goals/project-detail.html` 全量对齐，含 Tree/List/Roadmap 三视图、头部进度统计、任务挂到子目标下、里程碑、Add 表单与 Allocate resource 流程。

已确认的决策（与用户对齐）：
- 全量对齐原型（含 Roadmap/里程碑）。
- 给 `Task` 加回 `goalId`（可选；缺省视为挂在项目根目标下）。
- Add 表单（add-plan-item、allocate-resource）本周期一并实现。
- 不引入新依赖：日期用 `YYYY-MM-DD` 文本输入 + 校验；选择器用 `presentSheet` 选项列表。

**有意的简化（原型有、本周期不做）**：
- add-plan-item 里的「Allocate from project resources」小节（子目标级资源池）需要 allocation 指向 goal 的领域扩展，本周期跳过，资源分配保持项目级。
- 资源区的「8 h / wk」周期单位领域无此概念：时间资源显示 span 时长，数量资源显示数值。
- allocate-resource 的「New resource…」入口不做（资源池创建属另一流程）。

## 1. 领域层

### 1.1 `src/domain/shared/ids.ts`
- 新增 `export type MilestoneId = string;`

### 1.2 `src/domain/task/Task.ts` — 加回 goalId、新增 milestoneId
- 构造参数新增 `readonly goalId: GoalId | undefined`、`readonly milestoneId: MilestoneId | undefined`（restore/create 同步；create 两者可选）。
- 更新字段注释（不再写「goal derived via project」），加 `assignGoal(goalId, now)` / `assignMilestone(milestoneId | undefined, now)` 方法。
- 更新 `src/domain/task/__tests__/task.test.ts`。

### 1.3 `src/domain/goal/Goal.ts` — 新增 milestoneId
- 新增 `readonly milestoneId: MilestoneId | undefined`（create/restore 可选参数）+ `assignMilestone(milestoneId | undefined, now)`。
- 更新 goal 测试。

### 1.4 新增 `src/domain/milestone/`
- `Milestone.ts`：字段 `id`、`projectId`（required）、`_title`（非空校验）、`_date: Date`、`createdAt`、`_updatedAt`；`create`/`restore`；`rename`/`reschedule`。**无 status 字段**——Reached/Upcoming 由应用层按 `date <= now` 派生。
- `repository/MilestoneRepository.ts`：`save / findById / list(filter?: { projectId?: ProjectId }) / delete`，与其他仓储同模式。
- `__tests__/milestone.test.ts`。

### 1.5 文档
- `docs/domain/domain.md`：修订决策 3（Task 重新携带可选 goalId/milestoneId；Goal 可挂 milestoneId），新增 Milestone 模型条目与层级描述。

## 2. 基础设施层（sqlite）

### 2.1 `src/infrastructure/sqliteRepository/schema.ts` — v3
- V1 DDL：`tasks` 加 `goal_id TEXT`、`milestone_id TEXT`；`goals` 加 `milestone_id TEXT`；新建 `milestones(id TEXT PK, project_id TEXT NOT NULL, title TEXT NOT NULL, date INTEGER NOT NULL, created_at, updated_at)`。
- 新增 `MIGRATION_V3: ColumnStep[]`（条件 ADD COLUMN ×3 + CREATE TABLE milestones），`migrate()` 对 v2 库应用后 `user_version = 3`；`EXPECTED_COLUMNS` 同步。
- 更新 `schemaMigration.test.ts`。

### 2.2 仓储实现
- `SqliteTaskRepository`：TaskRow/save/list/hydrate 增加 `goal_id`、`milestone_id`；`TaskFilter` 增加 `goalId?`。
- `SqliteGoalRepository`：增加 `milestone_id` 列映射。
- 新增 `SqliteMilestoneRepository.ts` + 测试。
- 更新 task/goal 仓储测试。

## 3. 应用层

### 3.1 `src/application/__tests__/fakes.ts`
- 新增 `FakeMilestoneRepository`；task/goal fake 适配新字段。

### 3.2 扩展 `ProjectDetailService`（读模型）
`ProjectDetailView` 扩展：
- `progress: { doneSubGoals, totalSubGoals, doneTasks, totalTasks, percent } | null`（percent = done 合计/总合计，对齐原型 62% 口径）。
- `ProjectGoalNode` 增加 `tasks: ProjectTaskItem[]`（按 `task.goalId` 挂到对应节点；无 goalId 的任务挂根节点，不再单独平铺）。节点增加 `due?`、`milestoneId?`。
- `weeks: { current, total } | null`（由 `project.createdAt → due` 推算，供「Week 6 of 16」）。
- `milestones: Array<{ id, title, date, reached: boolean, items: Array<{ kind: 'goal'|'task', id, title, status, context?: string }> }>`（按 date 排序；items 来自 goal/task 的 milestoneId）。
- `tasks` 平铺列表保留（List 视图用，带 `goalTitle` 上下文）。
- 资源项增加 `span?: { startAt, endAt }`（时间资源显示时长）。
- 更新 `projectDetailService.test.ts`。

### 3.3 新增 command 服务（每个独立文件 + 测试）
- `AddSubGoalService.add({ projectId, parentGoalId?, title, due?, milestoneId? })`：校验标题非空、parent 属于该项目树、`due < project.due`（有 due 时）；内部 `Goal.create` + save。
- `AddTaskService.add({ projectId, goalId?, title, due?, milestoneId? })`：校验 goalId 属于该项目树。
- `AddMilestoneService.add({ projectId, title, date })`。
- `AllocateResourceService.allocate({ resourceId, projectId, amount?, span? })`：调用 `Resource.allocate` 后 save；数量资源传 amount，时间资源传 span（领域已强制不超池、span 不重叠）。

## 4. UI 层

### 4.1 新组件 `src/ui/components/SegmentedControl.tsx`
- props: `{ options: { key, label }[], selected, onSelect, testID? }`，样式按 `docs/design/design-style.md`（track 用 `colors.track`）。加入 components 测试。

### 4.2 重写 `src/ui/pages/projects/ProjectDetailPage.tsx`
- **头部**：IconChip + 标题 + 状态 pill +「Week N of M · ends X」；`ProgressBar height={7}` + 「62% complete / 2 of 3 sub-goals · 13 of 21 tasks」。
- **Plan 区**：SegmentedControl（Tree/List/Roadmap）+ 本地 state 切换：
  - Tree：递归渲染目标节点（缩进），节点下渲染其任务行（check 图标 + 状态 meta，任务行点击暂不进详情），每层尾部「Add task or sub-goal」行 → `pushScreen('project:<id>:add-plan-item')`。
  - List：Sub-goals 组（含父级上下文）+ Tasks 组（含所属目标上下文）。
  - Roadmap：里程碑按日期排列（Reached/Upcoming pill），今日标记线（按 now 插入位置），末尾「Project due」行 +「Add milestone」行 → add-plan-item（milestone tab）。
  - 三个视图拆成同目录局部组件（`PlanTreeView.tsx` 等），保持页面可读。
- **资源区**：数量显示数值，时间显示 span 时长（h）；尾部「Allocate resource」行 → `pushScreen('project:<id>:allocate-resource')`。
- Activity 区不变。
- 更新 `projectDetailPage.test.tsx`（三视图切换、进度统计、导航）。

### 4.3 新增 `src/ui/pages/projects/AddPlanItemPage.tsx`
- `InlineNavBar` + SegmentedControl（Sub-goal/Task/Milestone）。
- Sub-goal：标题输入（`TextInput`）、Under（父目标，默认带入触发处节点）、Due（`YYYY-MM-DD` 文本输入，留空=无）、Milestone（可选）；底部主按钮 `PrimaryChipButton`。
- Task：标题、Goal（树内任意节点）、Due、Milestone。
- Milestone：名称 + Date（必填）。
- 父目标/目标/里程碑选择：`presentSheet` 弹出简单选项列表（页面内局部组件）。
- 提交调用对应 command 服务（props 注入，`Pick<..., 'add'>`），成功后 `goBack()`；校验失败行内提示。
- 数据（目标树、里程碑列表）通过扩展后的 `ProjectDetailService.getDetail` 载入。
- 不做原型的「Allocate from project resources」小节（见上有意的简化）。

### 4.4 新增 `src/ui/pages/projects/AllocateResourcePage.tsx`
- 顶部目标项目行；资源池列表（名称、类型、可用量，点击选中）；选中数量资源显示 Amount 输入（≤ 可用量提示）；选中时间资源显示 start/end 两个 `YYYY-MM-DD HH:mm` 文本输入（span）。
- 提交调 `AllocateResourceService`，成功 `goBack()`。
- 不做「New resource…」入口（资源池创建属另一流程）。

### 4.5 导航注册 `src/ui/appDestinations.tsx`
- library 目的地 renderScreen 增加 `'project:<id>:add-plan-item'`、`'project:<id>:allocate-resource'`（解析 screenId 前缀取 projectId）。

### 4.6 `src/ui/composition/`
- `composeServices.ts`：new `SqliteMilestoneRepository`、注册 4 个 command 服务；`AppServicesProvider.tsx` 的 `AppServices` 接口同步。
- `devSeed.ts`：补 goalId/milestoneId、里程碑、span 时间资源示例数据，便于对原型验收。

### 4.7 页面测试
- `addPlanItemPage.test.tsx`（三种 tab 提交、校验失败）、`allocateResourcePage.test.tsx`（数量/时间两种提交）。

## 5. 验证

- `npm run typecheck`、`npm test` 全绿。
- 逐屏对照原型 html 检查：头部统计、三视图、Roadmap 今日线、Add/Allocate 流程。

## 实施顺序

1. 领域层（1.1–1.4）+ 领域测试
2. sqlite schema v3 + 仓储（2.1–2.2）
3. fakes + ProjectDetailService 扩展（3.1–3.2）
4. 4 个 command 服务（3.3）
5. SegmentedControl + ProjectDetailPage 重写（4.1–4.2）
6. AddPlanItemPage + AllocateResourcePage + 导航注册（4.3–4.5）
7. 组合根 + devSeed（4.6）
8. 页面测试、typecheck/jest、domain.md 更新（1.5、4.7、5）
