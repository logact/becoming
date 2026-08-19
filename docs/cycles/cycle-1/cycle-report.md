# Cycle 1 报告

范围：`docs/exec-plans/project-detail-alignment/plan.md`（项目详情页全量对齐原型）。计划见 `cycle-plan.md`（引用原文任务），全部 8 步已完成。

## 验证结果

- `npm run typecheck`：通过。
- `npm test`：50 个测试套件 / 346 个测试，全部通过。
- 已逐屏静态对照原型（project-detail / add-plan-item / allocate-resource）：头部统计、Tree/List/Roadmap 三视图、Roadmap 今日线、Add/Allocate 流程均已覆盖（计划内简化项除外）。

## 各层产出

### 领域层（§1.1–1.4）
- `src/domain/shared/ids.ts`：新增 `MilestoneId`。
- `Task`：加回可选 `goalId`、新增可选 `milestoneId`，新增 `assignGoal` / `assignMilestone`。
- `Goal`：新增可选 `milestoneId` + `assignMilestone`。
- 新增 `src/domain/milestone/`：`Milestone`（id/projectId/title/date，无 status，Reached/Upcoming 由应用层派生）、`MilestoneRepository`、测试。
- `docs/domain/domain.md`：修订决策 3、新增 Milestone 条目。

### 基础设施（§2.1–2.2）
- `schema.ts` v3：tasks 加 `goal_id`/`milestone_id`，goals 加 `milestone_id`，新建 `milestones` 表；`MIGRATION_V3` + `user_version = 3`。
- `SqliteTaskRepository`（含 `TaskFilter.goalId?`）、`SqliteGoalRepository` 适配新列；新增 `SqliteMilestoneRepository`。

### 应用层（§3.1–3.3）
- `fakes.ts`：新增 `FakeMilestoneRepository`。
- `ProjectDetailService` 读模型扩展：`progress`（含 percent）、目标节点挂任务（无 goalId 挂根节点）、`weeks`、`milestones`（reached 派生 + items）、平铺 `tasks` 带 `goalTitle`、资源 `span?`。
- 新增 command 服务：`AddSubGoalService`、`AddTaskService`、`AddMilestoneService`（project/）、`AllocateResourceService`（resource/）。
- 计划外新增：`ResourcePoolsService`（allocate 页需要资源池列表读模型，遵循「新增而非修改应用服务」规则）。

### UI 层（§4.1–4.7）
- 新组件 `SegmentedControl`（含测试）。
- `ProjectDetailPage` 重写：头部（Week N of M、ProgressBar + 统计）、Plan 区三视图（拆分为 `PlanTreeView` / `PlanListView` / `PlanRoadmapView` + `planShared`）、资源区（时间资源显示 span 时长）、Activity 不变。
- 新增 `AddPlanItemPage`（Sub-goal/Task/Milestone 三 tab，`presentSheet` 选择器，行内校验提示）、`AllocateResourcePage`（数量/时间两种分配）；公共 `formRows.tsx`、`src/ui/shared/dateText.ts` 日期解析。
- `appDestinations.tsx`：`LibraryProjectScreen` 解析 `project:<id>:add-plan-item[:parent=<goalId>][:tab=milestone]` 与 `project:<id>:allocate-resource`。
- 组合根：`composeServices` 注册 `SqliteMilestoneRepository` + 5 个新服务；`AppServices` 字段改为必选；`devSeed` 补充里程碑、goalId/milestoneId 任务、span 时间资源示例数据。
- 补充修复：Tree 添加行携带触发节点（Under 默认带入）；Roadmap「Add milestone」预选 milestone tab。

## 与原计划的偏差

- 实体可变字段沿用代码库既有模式（`private _goalId` + getter），而非计划字面写的 `readonly`（与 `assignX` 方法冲突）。
- `TaskFilter.goalId?` 在步骤 2 中补加（原文 §2.2 有要求，步骤 1 未做）。
- command 服务签名含 `id`/`allocationId`/`now` 参数（遵循既有服务约定，由调用方生成）。
- `ProjectDetailService.getDetail(projectId, now = new Date())` 带默认值，页面调用处已显式传 `now`。
- 新增 `ResourcePoolsService`（见上）。
- devSeed 头部进度为 27%、「Week 6 of 15」，与原型示例数字（62%、16 周）不同——种子数据采用真实感小数据集，所有原型元素均可验收。

## 遗留 / 待决策

- Roadmap 原型里每个里程碑下的「Add sub-goal or task」行未做（原文 §4.2 未列，实现与计划一致）。
- 资源行的 schedule 副标题（如「Mon–Fri 6:30–7:30 AM」）、Due 行的「Must be earlier than the project due」提示未做（计划未要求）。
- Task tab 的 Goal 选择器不从 Tree 触发节点预选（§4.3 只要求 Sub-goal 的 Under）。

## 人工验收建议

运行 app（devSeed 数据），对照 `docs/design/prototype/pages/goals/project-detail.html` 检查详情页三视图与头部统计，并走一遍 Add sub-goal/task/milestone 与 Allocate resource 流程。
