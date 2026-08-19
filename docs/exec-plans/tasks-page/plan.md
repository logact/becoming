# Tasks 页与 Task 详情页

来源：`docs/issues/issue-1-tasks-page.md`。目标：实现 Tasks 总览页（所有任务的 dashboard）与 Task 详情页（描述 + 生命周期操作 + execution records），对齐原型 `docs/design/prototype/pages/tasks/tasks.html` 与 `task-detail.html`。

已确认的决策（与用户对齐）：
- 入口：Library hub 的 Tasks 行可点击，`pushScreen('tasks')`；详情页为 `task:<id>` screen。底部导航不变。
- All tasks 按 status 分组，每行副标题显示所属项目名 + due。
- Task 详情页本期含生命周期操作（start/pause/resume/complete/fail/reopen），非只读。
- `Task` 新增 `isOverdue(now)`，与 `isDueImminent` 并列，overdue 规则单一出处。
- `AddTaskService` 补写 `taskCreated` record + relation（修改现有服务，用户已确认）。
- record kind 词汇集中在应用层常量：`taskCreated / taskStarted / taskPaused / taskResumed / taskCompleted / taskFailed / taskReopened`（动词语态与现有 UI `activityIcon` 的 `endsWith` 匹配兼容）。
- 暂停/失败的可选原因不进 Task 模型，写入 `Record.detail`。

## 1. 领域层

### 1.1 `src/domain/task/Task.ts` — 新增 isOverdue
- 新增 `isOverdue(now: Date): boolean`：archived 或 status 为 done/failed 或没有 due → false；否则 `due.getTime() < now.getTime()`（严格小于；恰等于 now 不算过期）。
- 注释与 `isDueImminent`（`Task.ts:188`）对齐：两者区分「已过期」与「2h 窗口内到期」。
- 更新 `src/domain/task/__tests__/task.test.ts`：无 due、done、failed、archived、due 已过、due 未来各一例。

## 2. 应用层

新建目录 `src/application/task/`（与 goal/project 平级）。fakes（`src/application/__tests__/fakes.ts`）已齐，无需新增。

### 2.1 新增 `TasksOverviewService.ts`（读模型）
- 构造：`tasks: TaskRepository, projects: ProjectRepository, labels: LabelRepository, records: RecordRepository`。
- `getOverview(now: Date): Promise<TasksOverviewView>`：
  - `stats: { doing, todo, done, overdue }`（overdue 用 `isOverdue`，其余按 status；均不含 archived）。
  - `attention: TaskAttentionItem[]`：`{ id, title, projectName, reason: 'failed' | 'overdue' | 'dueSoon', due? }`；failed 在前，然后 overdue，再 dueSoon（`isDueImminent(TASK_DUE_WINDOW_MS, now) && !isOverdue(now)`，复用 `DashboardService` 的 `TASK_DUE_WINDOW_MS`），各组内按 due 升序。
  - `doingNow: TaskListItem[]`：doing + paused，带 `projectName`。
  - `byStatus: Record<TaskStatus, number>`、`byLabel: LabelTaskCount[]`（复用 GoalsOverviewService 的 countByLabel 模式）。
  - `allTasks: Record<TaskStatus, TaskListItem[]>`；`TaskListItem = { id, title, status, projectName, due?, labelIds }`。
  - `recentActivity: ActivityItem[]`：`records.listRecent` 取较大条数后按 `kind.startsWith('task')` 过滤，截 `RECENT_ACTIVITY_LIMIT`。**有意的简化**：不做 relation 维度的「全部任务活动」查询（需要仓储 join），kind 前缀过滤足够且与 kind 词汇约定一致。
- projectName 解析：一次性 `projects.list()` 建 id→name map，未知项目回退为 id。
- 测试：`tasksOverviewService.test.ts`（stats、attention 排序与 reason 区分、分组、label 计数、activity 过滤）。

### 2.2 新增 `TaskDetailService.ts`（读模型）
- 构造：`tasks, projects, goals, records`。
- `getDetail(taskId): Promise<TaskDetailView>`：
  - `task: Task | null`（null 时页面渲染 Unknown task）。
  - `projectName?: string`、`goalTitle?: string`、`goalParentTitle?: string`（goal 有 parentGoalId 时解析父目标标题，供「Build base fitness · Run a half marathon」式副标题）。
  - `records: ActivityItem[]`：`records.listByTarget('task', taskId)`，截 `RECENT_ACTIVITY_LIMIT`。
- 测试：未知任务、无 goal、带父子 goal、records 截断。

### 2.3 新增 `TaskLifecycleService.ts`（写服务）
- 构造：`tasks, records, relations`。
- 同文件导出 kind 常量：`export const TASK_RECORD_KIND = { created: 'taskCreated', started: 'taskStarted', paused: 'taskPaused', resumed: 'taskResumed', completed: 'taskCompleted', failed: 'taskFailed', reopened: 'taskReopened' } as const;`
- 六个方法，统一签名 `xxx({ taskId, recordId, relationId, note?, now })`：
  1. `tasks.findById`，null → `DomainError('Unknown task: ...')`；
  2. 调用对应领域方法（非法转移由领域层抛 DomainError，原样冒泡）；
  3. `tasks.save`；
  4. `records.append(Record.create({ id: recordId, kind, detail: note ?? `动作默认文案（含任务标题）`, occurredAt: now }))`；
  5. `relations.save(Relation.create({ id: relationId, sourceType: 'record', sourceId: recordId, targetType: 'task', targetId: taskId, kind: 'logs', now }))`。
- 测试：每个方法的状态转移 + record/relation 落库 + note 透传；未知任务抛错；非法转移抛错且不写 record。

### 2.4 修改 `AddTaskService.ts` — 补 taskCreated record
- 构造增加 `records: RecordRepository, relations: RelationRepository`；`add()` 参数增加 `recordId: RecordId, relationId: RelationId`。
- `tasks.save` 成功后 append `taskCreated` record + `logs` relation（同 2.3 的模式）。
- 更新 `addTaskService.test.ts`；`AddPlanItemPage.tsx:291` 调用处补 `recordId: createId(), relationId: createId()`。

## 3. UI 层

### 3.1 新增 `src/ui/pages/tasks/TasksPage.tsx`
对齐 `prototype/pages/tasks/tasks.html`，复用现有组件：
- Overview stats：4 个 `StatTile`（Doing / Todo / Done / Overdue）。
- Needs attention：panel 列表，行 = chip 图标（failed→alert、overdue→alert、dueSoon→clock）+ 标题 + 副标题（projectName · due 描述）+ pill；底部 `SectionNote` 说明规则。
- Doing now：borderless 列表，行点击进详情。
- By status / By label：pill/tag + count 的 panel（复用 Goals 页模式）。
- All tasks：一个 panel，按 status 分组（`group-label` 等价的组标题 —— 检查 GoalsPage 是否已有分组实现可复用，没有则用局部 View + 文本），行 = 状态圆点/图标 + 标题 + 副标题（projectName · due）+ StatusPill，`onPress: pushScreen('task:' + id)`。
- Recent activity：activity 面板（图标映射复用/抽取 ProjectDetailPage 的 `activityIcon`——抽到 `src/ui/pages/activityIcon.ts` 或 shared，供两个详情页与列表页共用）。
- `failed` 状态沿用现有映射：`StatusPill` 无 failed state，映射到 `conflict`（同 `ProjectDetailPage.tsx:43-49`）。
- 测试：`tasksPage.test.tsx`（各区块渲染、点击行进 `task:<id>`）。

### 3.2 新增 `src/ui/pages/tasks/TaskDetailPage.tsx`
对齐 `task-detail.html`：
- `InlineNavBar(title='Task')` + header：大 chip（checkCircle）、标题、StatusPill + due meta。
- 操作区（按 status 渲染，对应 `Task` 的 `transition` 规则）：
  - todo → Start（主按钮）
  - doing → Complete（主）+ Pause / Fail（次）
  - paused → Resume（主）+ Fail（次）
  - done / failed → Reopen（主）
  - 次按钮需要 ghost 样式：`PrimaryChipButton` 增加 `variant: 'primary' | 'ghost' | 'danger'` prop（优先扩展现有组件而非新建），更新 components 测试。
  - 点击调 `taskLifecycle.xxx({ taskId, recordId: createId(), relationId: createId(), now: new Date() })` 后 `refresh()`；失败行内提示（DomainError 文案）。
  - **本期不带原因输入**：note 参数留接口，UI 暂不弹输入（原型也只是一行静态文案）。
- Belongs to：project 行（`pushScreen('project:' + projectId)`）、goal 行（有 goalId 时，`openDetail(goalId)`）。
- Description：panel 段落；无描述时 `SectionNote` 空态。
- Execution records：`detail.records` 列表（图标 + detail/标题 + relativeTime），底部 note 说明记录不可变。
- 测试：`taskDetailPage.test.tsx`（各 status 的按钮集合、操作后刷新、未知任务、records 渲染）。

### 3.3 `LibraryPage.tsx`
- Tasks 行（`LibraryPage.tsx:81-86`）加 `onPress: () => navigation.pushScreen('tasks')`；更新 libraryPage 测试。

### 3.4 `appDestinations.tsx`
- library 目的地 `renderScreen` 增加：`'tasks'` → TasksPage；`'task:<id>'` 前缀 → TaskDetailPage（解析 id）。
- TasksPage/TaskDetailPage 经 `useAppServices()` 取服务（新增包装组件，同 LibraryGoalsScreen 模式）。

### 3.5 组合根与种子
- `AppServicesProvider.tsx` 的 `AppServices` 接口增加 `tasksOverview`、`taskDetail`、`taskLifecycle`。
- `composeServices.ts`：注册三个新服务；`AddTaskService` 构造补 records/relations。
- `devSeed.ts`：deps 增加 `relations`；为示例任务（如 "Long run 14 km"）补生命周期 records + `logs` relations，使详情页 execution records 有数据；现有 seed records（`devSeed.ts:293-303`）补上对应 relations。

## 4. 文档

- `docs/design/design.md`：pages 列表增加 tasks 页条目（对齐 goals 页的描述风格）。

## 5. 验证

- `npm run typecheck`、`npm test` 全绿（含全部新增测试）。
- 手工对照原型：Tasks 页六区块、详情页操作按钮随状态切换、execution records 时间线、Library→Tasks→Task detail→返回 的导航流。

## 实施顺序

1. 领域层 isOverdue + 测试（1.1）
2. 三个新应用服务 + 测试（2.1–2.3）
3. AddTaskService 补 record + 调用方适配（2.4）
4. PrimaryChipButton variant + activityIcon 抽取（3.1/3.2 的前置）
5. TasksPage + TaskDetailPage + 测试（3.1–3.2）
6. Library 行 + 导航注册（3.3–3.4）
7. 组合根 + devSeed（3.5）
8. design.md、typecheck/jest 全绿、对照原型验收（4–5）
