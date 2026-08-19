# Ideas 总览、Idea 详情与派生 Goal / Task

来源：用户提出重新设计 Ideas 页与 Idea 详情页，并要求可以从 Idea 创建 Goal 或 Task、在详情页直接修改 Idea status。目标：实现 `docs/design/prototype/pages/ideas/ideas.html` 与 `idea-detail.html` 所表达的 Ideas 工作流，并接入真实领域模型、SQLite、应用服务与 React Native UI。

已确认的决策（与用户对齐）：
- Idea status 是用户可直接修改的工作流分类：`captured / exploring / paused / handled`。
- 从 Idea 创建新对象采用“派生”语义：保留原 Idea，以 `Relation(kind='derivedFrom')` 连接新对象与 Idea，不复制后删除原 Idea。
- 本计划只支持从 Idea 创建 **Goal** 或 **Task**；**不实现 Note 创建、不新增 Note SQLite 仓储、不修改 Note 领域模型**。
- Goal 默认创建为 top-level Goal。
- Task 必须选择 Project；Goal 可选且必须属于所选 Project 的目标树。
- 新对象创建成功后自动将 Idea 置为 `handled`；handled Idea 仍可继续派生其他 Goal / Task。
- 标签默认从 Idea 复制到新 Goal / Task。
- 派生关系方向固定为：新对象作为 source，Idea 作为 target，例如 `goal --derivedFrom--> idea`。
- Ideas 页面默认分为 Open（captured / exploring / paused）与 Handled；Open 内再按 status 分组。
- 多仓储写入必须在同一事务内完成，避免出现“对象已创建但关系或 Idea 状态未保存”的部分成功。

**明确不在本计划范围内**：
- 从 Idea 创建 Note，以及 Notes 列表、详情、SQLite 表和仓储。
- Idea 删除、批量操作、全文搜索和高级 label 筛选。
- 新建 Project；创建 Task 时只能选择已有 Project。
- 在创建 Task 时新建 Goal / Milestone。
- 修改 Goal / Task 自身的生命周期规则。
- Tasks 页与 Task 详情页本体由 `docs/exec-plans/tasks-page/plan.md` 负责；本计划只在对应 route 已存在时接入派生 Task 的详情跳转。

## 1. 原型与产品文档先对齐范围

### 1.1 Ideas 原型
- 修改 `docs/design/prototype/pages/ideas/ideas.html`：Create from Idea 选择器只保留 Goal / Task，移除 Note。
- 修改 `docs/design/prototype/pages/ideas/idea-detail.html`：Create from this idea 改为 Goal / Task 两项；Created from this idea 示例移除 Note。
- 修改 `docs/design/prototype/pages/shared/prototype.js` 中的派生选择与表单，删除 Note 分支；保留 Goal / Task 的交互演示。
- 同步 `docs/design/prototype/index.html` 的 Ideas / Idea detail 汇总画面。

### 1.2 产品与领域文档
- `docs/design/design.md` 增加 Ideas 页面与 Idea 详情页面结构、Open/Handled 分组规则、status picker 和派生区说明。
- `docs/domain/domain.md` 明确 `handled` 含义：Idea 已被处理，不等于 archived，也不禁止继续派生。
- 记录固定关系方向：`goal|task --derivedFrom--> idea`。

## 2. 领域层

### 2.1 `src/domain/idea/Idea.ts` — 统一 status 修改规则
- 新增 `changeStatus(next: IdeaStatus, now: Date): void`：
  - 四种 status 均可由用户直接选择，符合详情页 status picker。
  - next 与当前 status 相同时为 no-op，不更新时间，也不产生应用层 record。
  - status 实际变化时更新 `_status` 与 `_updatedAt`。
- `explore(now)` / `pause(now)` 改为调用 `changeStatus`，并新增 `handle(now)` / `returnToInbox(now)` 作为语义化包装；单一 status 写入逻辑只保留在 `changeStatus`。
- 修正现有 `explore()` 的实现与注释不一致问题（当前实现意外允许 handled → exploring）。
- `Idea.create()` 增加非空校验，并保存 trim 后的 content；`edit()` 使用相同规则。
- 更新 `src/domain/idea/__tests__/idea.test.ts`：
  - 四种 status 的直接切换。
  - 相同 status no-op。
  - `handle` / `returnToInbox`。
  - status 改变时 updatedAt 更新。
  - 创建空内容失败及 trim 行为。

### 2.2 `src/domain/relation/Relation.ts` — 固化 Idea 派生语义
- 保留通用 `Relation.create()`，避免影响现有 `logs / consumes / allocates` 等关系。
- 新增 `IdeaDerivedType = 'goal' | 'task'` 与静态工厂 `Relation.derivedFromIdea(...)`：
  - sourceType 只允许 goal / task。
  - targetType 固定为 idea。
  - kind 固定为 `derivedFrom`。
- 更新 relation 领域测试，验证 Goal / Task 两种派生关系的方向和 kind。
- 不在 `Idea` 中保存 `derivedEntityIds`，也不向 Goal / Task 增加 `ideaId`；跨模型来源统一由 Relation 表达。

## 3. 应用层

新建 `src/application/idea/`。读服务和写服务分开，页面通过 `Pick<Service, 'method'>` 注入，保持现有页面测试模式。

### 3.1 事务端口 `src/application/shared/TransactionRunner.ts`
- 定义应用层端口：`run<T>(work: () => Promise<T>): Promise<T>`。
- Idea 派生服务将创建对象、创建 relation、更新 Idea、追加 record 全部放入一次 `run`。
- `src/application/__tests__/fakes.ts` 新增立即执行的 fake transaction runner，供应用服务单测使用。

### 3.2 Idea record kind 常量
- 新增 `src/application/idea/ideaRecordKinds.ts`：
  - `ideaCaptured`
  - `ideaEdited`
  - `ideaStatusChanged`
  - `ideaDerivedGoal`
  - `ideaDerivedTask`
- 所有 Idea 写服务统一使用这些常量；kind 以 `idea` 开头，Ideas 总览可沿用现有 `listRecent + startsWith('idea')` 模式筛选活动。

### 3.3 `IdeasOverviewService.ts`
- 构造：`ideas: IdeaRepository, records: RecordRepository`。
- `getOverview()` 返回：
  - `counts: { open, handled }`。
  - `open: { captured, exploring, paused }`，每组按 `updatedAt` 倒序。
  - `handled`，按 `updatedAt` 倒序。
  - `recentActivity`：`records.listRecent` 后按 `kind.startsWith('idea')` 过滤并截 `RECENT_ACTIVITY_LIMIT`。
- `IdeaListItem` 包含 `id / content / status / labelIds / updatedAt`；UI 从 content 生成单行 title/excerpt，不给 Idea 领域模型增加 title 字段。
- 测试覆盖 archived 排除、分组、计数、排序、activity 过滤。

### 3.4 `IdeaDetailService.ts`
- 构造：`ideas, goals, tasks, labels, relations, records`。
- `getDetail(ideaId)` 返回：
  - `idea: Idea | null`。
  - 已解析的 labels（id/name/color）。
  - `derivedItems: Array<{ type: 'goal'|'task', id, title, status, context? }>`。
  - `recentActivity`：`records.listByTarget('idea', ideaId)`，按时间倒序并截断。
- derivedItems 查询：`relations.list({ targetType: 'idea', targetId: ideaId, kind: 'derivedFrom' })`，再按 sourceType 分别从 GoalRepository / TaskRepository hydrate；对象不存在时跳过悬空 relation。
- Task context 显示 projectId；项目名称解析可在 UI 第一版只显示 id，或给服务注入 ProjectRepository 解析名称。为对齐原型，正式实现选择注入 ProjectRepository 并返回 projectName。
- 测试覆盖未知 Idea、Goal/Task 混合派生、悬空 relation、labels、activity。

### 3.5 `CaptureIdeaService.ts`
- `capture({ ideaId, content, recordId, recordRelationId, now })`：
  1. `Idea.create()`；
  2. 保存 Idea；
  3. append `ideaCaptured` Record；
  4. 保存 `record --logs--> idea` Relation。
- 全部写入同一事务。
- 测试空内容失败时无任何写入、成功时 Idea/record/relation 完整落库。

### 3.6 `EditIdeaService.ts`
- `edit({ ideaId, content, recordId, recordRelationId, now })`：加载 Idea → `idea.edit` → save → append `ideaEdited` → 保存 logs relation。
- 未知 Idea 抛 `DomainError`；内容未变化时可直接 no-op，不写 record。
- 本期不实现独立 label 编辑 command；详情页先只读展示 label，派生时复制现有 labelIds。

### 3.7 `ChangeIdeaStatusService.ts`
- `change({ ideaId, status, recordId, recordRelationId, now })`：
  1. 加载 Idea，未知 id 抛 `DomainError`；
  2. 保存 previous status；
  3. 调用 `idea.changeStatus(status, now)`；
  4. status 未变化直接返回；
  5. save Idea；
  6. append `ideaStatusChanged` Record，detail 保存 `previous → next`；
  7. 保存 `record --logs--> idea` Relation。
- 写入使用事务；测试四种目标 status、no-op、未知 id 与 record/relation。

### 3.8 `CreateGoalFromIdeaService.ts`
- 输入包含：`ideaId / goalId / title / description? / due? / derivedRelationId / recordId / ideaRecordRelationId / goalRecordRelationId / now`。
- 事务内：
  1. 加载 Idea；未知或 archived Idea 拒绝。
  2. 校验 title，创建 top-level `Goal`；description 默认使用完整 Idea content（UI 可覆盖）。
  3. 将 Idea 的 labelIds 复制到 Goal。
  4. 保存 Goal。
  5. 保存 `goal --derivedFrom--> idea` Relation。
  6. 若 Idea 尚非 handled，调用 `idea.handle(now)` 并保存。
  7. append `ideaDerivedGoal` Record。
  8. 保存两条 logs relation，使该 record 同时出现在 Idea 与 Goal 的 activity。
- handled Idea 仍允许再次创建 Goal；Idea 已 handled 时不重复产生额外 `ideaStatusChanged` record，派生 record 已表达这次动作。
- 测试标签复制、关系方向、自动 handled、多次派生、archived/unknown Idea、事务失败回滚。

### 3.9 `CreateTaskFromIdeaService.ts`
- 输入包含：`ideaId / taskId / projectId / goalId? / title / derivedRelationId / recordId / ideaRecordRelationId / taskRecordRelationId / now`。
- 事务内：
  1. 加载并校验 Idea。
  2. 加载 Project，必须存在且未 archived。
  3. 若有 goalId，验证 Goal 属于该 Project 的目标树（与 AddTaskService 相同规则）。
  4. 创建 Task；description 默认使用完整 Idea content。
  5. 复制 Idea labelIds，保存 Task。
  6. 保存 `task --derivedFrom--> idea` Relation。
  7. 自动将 Idea 置为 handled 并保存。
  8. append `ideaDerivedTask` Record，并分别关联到 Idea 与 Task。
- 不在本服务中新建 Project / Goal / Milestone。
- 测试 required project、goal tree 校验、标签复制、关系方向、自动 handled、事务失败回滚。

## 4. 基础设施层

### 4.1 SQLite transaction runner
- 扩展 SQLite adapter，使 Expo 与 Node 测试实现都能执行应用层 `TransactionRunner`：成功 commit，异常 rollback 后原样抛出。
- 所有参与事务的 repository 必须共享同一 database connection；composition root 注入该 runner。
- 增加 Node SQLite 集成测试：在派生流程中间故意抛错，确认 Idea、Goal/Task、relations、records 均无部分写入。

### 4.2 现有仓储复用
- `ideas` 表已有 status/content/archive/timestamps，无需 schema column 迁移。
- `relations` 已支持 goal/task/idea 与 `derivedFrom`，无需新表。
- `records` 与 `entity_labels` 直接复用。
- **不新增 notes 表、不实现 SqliteNoteRepository。**
- 可在当前 migration 的 ensure 阶段补 relation 查询索引：`(target_type, target_id, kind)`；若本地数据规模尚小，可作为非阻塞优化延后。

## 5. UI 层

### 5.1 `src/ui/pages/ideas/IdeasPage.tsx`
- `InlineNavBar('Ideas')` + capture panel。
- SegmentedControl：Open / Handled，显示对应计数。
- Open 按 To process（captured）/ Exploring / Paused 分组；Handled 独立列表。
- 点击 row：`pushScreen('idea:' + id)`。
- 每行 `+`：`presentSheet` 打开 Create from Idea，只有 Goal / Task 两项；点击 `+` 时阻止 row navigation。
- capture 成功后清空输入并 refresh；失败显示行内错误。
- 页面底部 Recent activity。
- 测试分组、切换、capture、row 导航、quick-create sheet。

### 5.2 `src/ui/pages/ideas/IdeaDetailPage.tsx`
- Header：Idea content、当前 StatusPill、更新时间、labels。
- StatusPill + pencil 为按钮；点击打开 status picker，四个 status 均可选。成功调用 ChangeIdeaStatusService 并 refresh；同 status 不产生 record。
- 顶部 pencil 打开 content 编辑表单；成功调用 EditIdeaService 并 refresh。
- Create from this idea：Goal / Task 两个按钮。
- Created from this idea：展示 IdeaDetailService.derivedItems；Goal 行进入现有 Goal detail，Task 行在 `task:<id>` route 可用时进入 Task detail。
- Recent activity 展示 Idea 相关 records。
- 未知 Idea 与加载/提交失败有明确空态或行内错误。
- 测试 status picker、编辑、两种 create sheet、derived items、activity、未知 Idea。

### 5.3 Create from Idea sheets
- 抽取 `src/ui/pages/ideas/CreateFromIdeaSheet.tsx`，同时供列表 quick action 与详情页使用。
- 首层只显示 Goal / Task：
  - Goal 表单：Title（用 Idea preview 预填）、Description（完整 content 预填）、Target date（可选）。
  - Task 表单：Title（预填）、Project（required）、Goal（optional，仅显示所选 Project 的目标树）。
- Project / Goal picker 复用 shell `presentSheet` 的选项列表模式；Project 数据新增轻量 read service 或复用 ProjectsOverviewService 的合适读模型，不能由 UI 直接访问 repository。
- submit 期间禁用按钮，防止双击创建两个对象；成功 dismiss sheet、显示 toast、刷新当前 Ideas/Idea detail 页面。
- 创建成功后的 Handled 状态由应用服务保证，UI 不自行写 status。

### 5.4 Library、导航与组合根
- `LibraryPage.tsx` 的 Ideas row 增加 `onPress: () => navigation.pushScreen('ideas')`。
- `appDestinations.tsx` 注册：
  - `ideas` → IdeasPage。
  - `idea:<id>` → IdeaDetailPage。
  - derived Goal 继续使用现有 Goal detail 导航。
  - derived Task 使用 tasks plan 约定的 `task:<id>`；若该 route 尚未落地，行先显示但不点击，并在 tasks plan 完成后接通。
- `AppServicesProvider.tsx` 增加 IdeasOverview、IdeaDetail、Capture/Edit/ChangeStatus/CreateGoal/CreateTask 服务。
- `composeServices.ts` 注册上述服务并注入共享 transaction runner。
- `devSeed.ts` 增加 captured/exploring/paused/handled Idea 与 Goal/Task derivedFrom 示例关系及 activity records。

## 6. 测试与验收

### 6.1 自动验证
- 领域测试：Idea content/status 与 Relation factory。
- 应用测试：两个 read service、四个 Idea command service、Goal/Task 派生服务。
- 基础设施测试：SQLite transaction commit/rollback、现有 Idea/Relation repository 回归。
- UI 测试：IdeasPage、IdeaDetailPage、CreateFromIdeaSheet、Library navigation。
- `npm run typecheck`、`npm test` 全绿。

### 6.2 手工原型对照
- Library → Ideas → Idea detail → 返回。
- Open / Handled 切换与三种 Open status 分组。
- list row 的 `+` 与 row 点击互不冲突。
- detail status picker 可切换四种状态并立即刷新。
- list/detail 均可创建 Goal 或 Task；Task 强制选择 Project。
- 创建后 Idea 自动进入 Handled，原 Idea 仍保留，derived item 可见。
- Goal / Task 与 Idea 两侧 activity 均出现派生记录。
- 所有 Create from Idea 入口均不出现 Note。

## 7. 实施顺序

1. 先调整原型移除 Note，并同步 design/domain 文档（1）。
2. Idea status/content 与 Relation factory + 领域测试（2）。
3. TransactionRunner 端口与 SQLite 实现、rollback 集成测试（3.1、4.1）。
4. Idea record kind、Overview/Detail read services + 测试（3.2–3.4）。
5. Capture/Edit/ChangeStatus command services + 测试（3.5–3.7）。
6. CreateGoalFromIdea / CreateTaskFromIdea + 事务与派生关系测试（3.8–3.9）。
7. IdeasPage + IdeaDetailPage + CreateFromIdeaSheet（5.1–5.3）。
8. Library/navigation/composition/devSeed 接线（5.4）。
9. 全量 typecheck/jest、手工对照原型验收（6）。
