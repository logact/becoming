# 全局 Capture 入口（Idea / Task / Goal / Note）

来源：用户要求在所有页面上提供一个始终可达的浮动 Capture 按钮，让用户不离开当前上下文即可记录任意想法，或直接创建 Idea、Task、Goal、Note。交互原型已落在 `docs/design/prototype/pages/shared/prototype.css` 与 `prototype.js`：浮动按钮打开底部 composer，支持 Decide later / Idea / Task / Goal / Note。

目标：把已确认的原型实现为 React Native 的 app-shell 级入口，并通过独立应用服务接入真实领域模型、SQLite、activity record 与现有页面刷新机制。

## 已确认的产品与技术决策

- Capture 是一个跨领域的**应用用例与 UI 入口**，不是新的领域实体；不新增 `Capture` model 或 `captures` 表。
- “Decide later” 保存为 `Idea(status='captured')`，它就是当前模型中的待处理 inbox。它与显式选择 Idea 使用相同持久化语义，只保留不同的 UI 文案；后续可在 Ideas 的 To process 分组中继续处理。
- 显式 Idea 同样创建 `captured` Idea；本期不因入口选择而自动进入 `exploring`。
- Goal 创建为 top-level Goal，初始 status 为 `todo`，不自动创建 Project。
- Task 继续遵守现有领域规则：必须属于一个 Project。选择 Task 后 composer 展示紧凑的 required Project picker；不允许创建无 Project 的 Task，也不修改 `Task.projectId` 为 optional。
- Note 创建为普通未归档 Note；pin、label、link 等整理动作留到详情页。
- 保存成功后关闭 composer、保留用户原来的页面与导航栈，并显示 toast；不自动跳转到新对象详情。
- 浮动入口出现在所有普通 list/detail/pushed screens；已有 modal/bottom sheet 打开时不叠加第二层 Capture composer。
- 多仓储写入（entity + activity Record + logs Relation）必须处于同一事务。
- UI 不直接访问 repository；Task 的 Project 选项由专用 read service 提供。

## 明确不在本计划范围内

- 语音、图片、文件附件、OCR、系统 Share Sheet、Widget、快捷指令。
- AI 自动识别输入类型、自动拆解、自动生成 title/description。
- 在 composer 内设置 due、label、milestone、Goal parent、Note link 等完整详情。
- 创建 Project、创建 sub-goal、创建无 Project Task。
- 可拖动或由用户自定义浮动按钮位置。
- 新建独立的通用 Inbox 领域模型。
- 离线同步、云同步与跨设备冲突处理。

## 依赖与计划边界

- Idea capture 所需的 `CaptureIdeaService`、Idea content invariant 与 activity 约定来自 `docs/exec-plans/ideas-workflow/plan.md` §2.1、§3.2、§3.5。
- Note model、`notes` schema、`SqliteNoteRepository` 与 `CaptureNoteService` 来自 `docs/exec-plans/notes/plan.md` §2.1、§3.4、§4.1–4.2。
- 共享 `TransactionRunner` 来自 `docs/exec-plans/ideas-workflow/plan.md` §3.1、§4.1；若前置计划尚未执行，本计划实施时必须先落地该端口与 SQLite adapter，不能以非原子写入替代。
- 本计划复用上述能力，不复制对应计划的实现。若 cycle 同时包含这些计划，应先完成共享依赖，再执行本计划。

## 1. 原型与设计文档对齐

### 1.1 修正 Task 的 required context

- 更新 `docs/design/prototype/pages/shared/prototype.js`：选择 Task 后，在 composer 内显示 Project picker；未选择 Project 时 Create task 保持 disabled。
- 默认可预选最近使用或当前 active Project，但 UI 必须明确显示该值并允许修改；没有 Project 时展示 “Create a project first”，Task 类型不可提交，用户仍可切回 Decide later。
- 其余类型维持当前一步保存交互。
- 不新增 prototype page，因此不修改 `docs/design/prototype/index.html` 与 `pages/index.html` 的页面索引。

### 1.2 设计文档

- 在 `docs/design/design.md` 的 App shell 增加 Universal capture：
  - list 页位于 tab bar 上方，pushed screen 位于 safe-area 上方。
  - modal 打开时背景 dim、输入自动 focus、键盘弹起时 composer 可见。
  - 切换类型会改变 placeholder、required fields、submit label 与说明。
  - 保存成功后回到原页面，不改变导航栈。
- 在 `docs/design/design-style.md` 增加 Capture FAB 与 Capture composer 的尺寸、层级、阴影和 disabled/pressed/loading 状态。

## 2. 领域层

### 2.1 不新增 Capture domain

- Capture intent 定义在 application 层；领域层仍只认识 Idea / Task / Goal / Note。
- `inbox` 与 `idea` intent 都调用 `Idea.create()`；领域中不保存来源入口，也不增加只为 UI 服务的 flag。
- `goal` 调用 `Goal.create()` 创建无 `projectId` / `parentGoalId` 的 top-level Goal。
- `task` 调用 `Task.create()`，保留 required `projectId` 与现有 goal-tree invariant。
- `note` 调用 `Note.create()`。

### 2.2 补齐共享文本 invariant（条件性）

- 若 ideas-workflow / notes 计划尚未落地，先确保 `Idea.create()` 与 `Note.create()` 和各自 edit 方法一致：拒绝 blank，保存 trim 后的 content。
- Goal / Task 已由应用服务检查 blank；本计划增加回归测试，不改变 lifecycle transition。
- 不在本计划修改 Goal、Task、Idea、Note 的 status 定义。

## 3. 应用层

新增 `src/application/capture/`，采用新的专用 service，不把跨领域入口逻辑塞进现有页面 service。

### 3.1 `CaptureOptionsService.ts`

- 构造：`projects: ProjectRepository`。
- `getOptions()` 返回 `projects: Array<{ id, name, status }>`：排除 archived，排序优先 active、再 planning/paused、同组按 updatedAt 倒序。
- 第一版只提供 Task 所需 Project 选项；不返回 repository model 给 UI。
- 测试 archived 排除、排序与空列表。

### 3.2 `QuickCaptureService.ts`

- 定义 discriminated union，避免可选字段组合失效：
  - `{ intent: 'inbox' | 'idea', entityId: IdeaId, content, recordId, recordRelationId, now }`
  - `{ intent: 'goal', entityId: GoalId, content, recordId, recordRelationId, now }`
  - `{ intent: 'task', entityId: TaskId, content, projectId, recordId, recordRelationId, now }`
  - `{ intent: 'note', entityId: NoteId, content, recordId, recordRelationId, now }`
- `capture(command)` 返回 `{ entityType: 'idea'|'goal'|'task'|'note', entityId }`，供 UI 生成 toast 或将来增加 View action。
- 所有 intent 先统一 trim content 并拒绝 blank，再在 `TransactionRunner.run` 中完成 entity、Record、Relation 写入。
- entity 的用户文本映射：
  - Idea / Note：完整文本写入 content。
  - Goal / Task：第一版完整文本写入 title；不做隐式截断或 AI 摘要。UI 使用单行标题式输入预期降低长文本风险。
- 创建 entity 后 append 对应 Record：
  - `quickCapturedIdea`
  - `quickCapturedGoal`
  - `quickCapturedTask`
  - `quickCapturedNote`
- 保存 `record --logs--> entity` Relation，使新对象详情与 Dashboard activity 能显示来源。
- inbox 与 idea 共用 `quickCapturedIdea`；是否显示 “Saved to inbox” 由 UI intent 决定，不把 presentation wording 写入 Record kind。

### 3.3 各 intent 的规则

- Inbox / Idea：创建 `Idea(status='captured')`；不自动添加 label，不自动 pin。
- Goal：创建 top-level `Goal(status='todo')`；不创建 Project，不写 due。
- Task：
  1. 读取 Project，unknown / archived 时抛 `DomainError`。
  2. 创建 `Task(status='todo', projectId)`；本期不指定 goalId/milestoneId/due。
  3. 不复用 UI 层校验作为领域保证；service 必须独立验证 Project。
- Note：创建普通 Note；依赖 notes 计划的 repository/schema。
- id 冲突、repository 失败、record/relation 失败均由 transaction rollback，不能留下孤立 entity。

### 3.4 测试

- 每个 intent 成功创建正确实体、record 与 logs relation。
- inbox 与 idea 都落为 captured Idea，但返回结果与 UI intent 保持可辨认。
- blank 输入在 transaction 前失败且零写入。
- Task unknown/archived Project 失败且零写入。
- Goal 是 top-level，Task 保留 required project，Note/Idea 保留完整 trim content。
- transaction 中第二/第三次写入故意失败，验证实体、record、relation 全部 rollback。
- 不在 QuickCaptureService 单测重复覆盖所有模型 lifecycle；只覆盖本用例的创建映射与原子性。

## 4. 基础设施层

### 4.1 复用现有 repository

- Idea / Goal / Task 复用现有 SQLite repository。
- Note 复用 notes 计划新增的 `SqliteNoteRepository` 与 `notes` 表。
- Record / Relation 复用现有表与 repository。
- 不新增 capture table，不做与 Capture 专属的 schema migration。

### 4.2 Transaction 与集成测试

- 确认 QuickCaptureService 注入的所有 repository 共享同一 database connection 与 TransactionRunner。
- Node SQLite 集成测试至少覆盖：
  - 四种 entity 的持久化 round-trip。
  - Task 的 Project foreign context。
  - record logs relation 可按 target 查询。
  - 中途失败 rollback。
- 若 SQLite transaction adapter 不支持嵌套 transaction，QuickCaptureService 直接操作 repository；不要在其 transaction 内再调用自身会开启 transaction 的 CaptureIdeaService / CaptureNoteService。

## 5. UI 层

### 5.1 `src/ui/components/CaptureComposer.tsx`

- 把 prototype composer 实现为受控组件：`visible / onDismiss / options / onSubmit`。
- state：`intent`（默认 inbox）、`content`、Task `projectId`、`submitting`、`error`。
- 打开时自动 focus；关闭或成功后清空 content、intent、projectId、error。
- intent chips：Decide later / Idea / Task / Goal / Note；切换 intent 不丢失已输入文本。
- Task 被选中时显示 required Project picker：
  - 有可用 Project 时默认选 active 优先的第一个选项，并允许通过 shell bottom sheet 修改。
  - 无 Project 时说明原因并禁用 submit。
- submit disabled 条件：blank、submitting、Task 无 projectId。
- 提交中禁止重复点击和 dismiss 导致重复命令；失败保留输入并显示行内错误。
- 成功关闭 composer 并调用 toast：Saved to inbox / Idea captured / Task created / Goal created / Note saved。
- 使用 `KeyboardAvoidingView`、safe-area bottom padding、合适的 accessibility label/state；VoiceOver 可读出 selected intent 与 disabled submit。

### 5.2 `src/ui/components/CaptureFloatingButton.tsx`

- 实现 prototype 的 50px Capture pill：green surface、mint circular plus chip、右侧 Capture label。
- props 接收当前 bottom offset，不读取 navigation state，不拥有 composer state。
- pressed、focus/accessibility role 与命中区域覆盖测试。

### 5.3 `src/ui/navigation/NavigationShell.tsx`

- NavigationShell 作为 owner 管理 capture composer visible state，因为它同时知道：
  - tab bar 是否显示。
  - safe-area inset。
  - pushed screen stack。
  - 当前是否已有普通 bottom sheet。
- list root：FAB 位于 tab bar 顶部之上；pushed screen：位于 safe-area bottom 之上。
- 已有 sheet 或 Capture composer 打开时隐藏 FAB，避免 overlay stacking；composer 必须位于 app content 与 tab bar 之上。
- 切换 tab、push/pop screen 不销毁未提交 composer；只有显式 close 或成功才清空。
- 不改变 `ShellDestination` route contract，也不为 Capture 新增 top-level tab/page。

### 5.4 UI 提交 adapter

- 新建 `src/ui/navigation/GlobalCapture.tsx`（或同目录等价命名），负责把 UI state 转成 QuickCapture command：
  - 使用 `createId()` 生成 entityId、recordId、recordRelationId。
  - 从 `useAppServices()` 获取 `quickCapture` 与 `captureOptions`。
  - 打开 composer 时加载 Project options；options 加载失败不阻止 Idea/Goal/Note，只禁用 Task 并显示对应错误。
- NavigationShell 只处理展示层状态，不直接构造领域对象或调用 repository。

### 5.5 Composition root

- `AppServicesProvider.tsx` 增加：
  - `quickCapture: QuickCaptureService`
  - `captureOptions: CaptureOptionsService`
- `composeServices.ts` 组合 NoteRepository（依赖 notes plan）、TransactionRunner、QuickCaptureService、CaptureOptionsService。
- `devSeed.ts` 不需要为按钮增加特殊数据；已有 Projects 足以演示 Task picker。

## 6. 页面刷新与数据一致性

- 成功 capture 后原页面保持不动；当前页面如果正在展示受影响集合，不要求通过 navigation remount 刷新。
- 为避免新增全局 event bus，本期定义一个轻量 `captureRevision` 于 shell/composition UI context：成功时递增；需要实时反映数据的 Dashboard、Ideas、Goals、Tasks、Notes list 将 revision 纳入 reload dependency。
- 若相应页面计划尚未实现，则先保证下次进入/重新 mount 可读取新数据；对应页面落地时再接入 revision。
- 不在 QuickCaptureService 中触发 UI refresh 或 toast。

## 7. 测试与验收

### 7.1 自动验证

- Application：QuickCaptureService、CaptureOptionsService 单测。
- Infrastructure：四类 capture round-trip 与 transaction rollback 集成测试。
- Components：CaptureFloatingButton 与 CaptureComposer 的 intent、required Project、disabled/loading/error/reset/accessibility。
- NavigationShell：
  - 三个 tab 与 pushed screen 都显示 FAB。
  - tab bar 可见/隐藏时 bottom offset 正确。
  - 打开普通 sheet 时不叠加 FAB/composer。
  - capture 前后保持 active destination 与 stack。
- Composition：AppServices 类型与 composeServices wiring 测试/类型检查。
- 执行 `npm run typecheck` 与 `npm test -- --runInBand`。

### 7.2 手工验收

- Dashboard / Library / Setting 以及 Goal/Project/Task/Idea/Note detail 均能看到 Capture。
- FAB 不遮挡 tab bar、home indicator、主要 trailing action；滚动页面时位置固定。
- Decide later 无额外必填项，保存后 Ideas / To process 可找到该 captured Idea。
- Idea、Goal、Note 可一步创建；关闭后仍停留原页面。
- Task 必须显示并选择 Project；无 Project 时无法提交但可切回其他 intent。
- 切换 intent 不丢输入；空白无法保存；快速连点不会创建重复对象。
- keyboard 展开时输入框、type chips 与 submit 可达。
- 保存失败保留内容，成功显示正确 toast，并能在对应列表/详情 activity 中找到对象与记录。

## 8. 实施顺序

1. 完成/确认 ideas-workflow 与 notes 计划中的 Idea、Note、TransactionRunner、SqliteNoteRepository 依赖。
2. 修正 prototype 的 Task Project picker，并同步 design/design-style 文档（§1）。
3. 实现 CaptureOptionsService 与测试（§3.1）。
4. 实现 QuickCaptureService、record kinds、事务与单测（§3.2–3.4）。
5. 补 SQLite 集成测试，验证四种 entity 与 rollback（§4）。
6. 实现 CaptureComposer、CaptureFloatingButton 与组件测试（§5.1–5.2）。
7. 实现 GlobalCapture、NavigationShell ownership 与 overlay/stack 测试（§5.3–5.4）。
8. 注册 AppServices/composeServices，并接入必要的 capture revision refresh（§5.5、§6）。
9. 全量 typecheck/test，按 prototype 完成手工验收（§7）。
