# Notes 总览、Note 详情与从 Idea 提取 Note

来源：用户确认了 Notes 原型（`docs/design/prototype/pages/notes/notes.html` 与 `note-detail.html`），要求把原型落到真实领域模型、SQLite、应用服务与 React Native UI，并补齐讨论中发现的领域层缺口。

本计划同时**取代** `docs/exec-plans/ideas-workflow/plan.md` 中对 Note 的排除条款（该计划 §“已确认的决策”第 3 条与“明确不在本计划范围内”第 1 条）：Note 保留在 Create from Idea 派生流程中，notes 表与 SqliteNoteRepository 由本计划实现。

已确认的决策（与用户对齐）：
- Notes 列表保持与 Ideas 一致的 uniform rows，不做卡片式视觉区分。
- Pinning 采用 `pinnedAt: Date | null`（非 boolean）：Pinned 组内按 pinnedAt 倒序，其余按 updatedAt 倒序；pin/unpin **不更新** `updatedAt`（pin 是整理动作，不是内容编辑）。
- Archive 是独立 flag：`archive()` 不清除 `pinnedAt`；Archived 视图的查询/排序直接忽略 pin（应用层职责）。
- 从 Idea 提取 Note 复用现有派生语义：`note --derivedFrom--> idea`（source 是新 Note，与 goal/task 派生方向一致），UI 文案渲染为 “extracted from”。不为 Note 单独引入 `extractedFrom` kind。
- Note 详情支持链接 Goal / Project：`note --relatesTo--> goal|project`；unlink 本期不做。
- `Idea` 进入 `handled` 的能力（`handle` / `changeStatus`）由 ideas-workflow 计划 §2.1 提供；若本计划先于 ideas-workflow 执行，则把该改动并入本计划 §2.2。

**明确不在本计划范围内**：
- Note 全文搜索、按 label 筛选的 UI（NoteRepository 已支持 labelId 过滤，UI 暂不暴露）。
- unlink relation、relation 的编辑。
- Ideas 页面本体（由 ideas-workflow 计划负责）；本计划只在其已落地时接通 Note 派生入口，未落地时 Notes 仅从 Library 进入。
- Records 活动流的 UI 展示（Note 详情底部 activity 沿用 records，本期可只写不展示，或复用现有 activityPanel 模式展示）。

## 1. 原型与文档先对齐范围

### 1.1 原型
- 原型已按确认决策实现（pinned 分组、archived 忽略 pin、Linked 区、extract 流程跳转 note-detail），无需修改。
- 唯一保留项：ideas-workflow 计划 §1.1 要求从 Create from Idea 中**移除** Note；以本计划为准，**保留** Note 选项。

### 1.2 文档
- `docs/domain/domain.md`：Note 条目补充 pinnedAt 语义（pin 不影响 updatedAt；archive 与 pin 独立）；记录关系约定 `note --derivedFrom--> idea` 与 `note --relatesTo--> goal|project`。
- `docs/design/design.md`：增加 Notes 列表页与 Note 详情页结构说明（Pinned/All notes 分组、Active/Archived 分段、Linked 区）。

## 2. 领域层

### 2.1 `src/domain/note/Note.ts` — pinning 与 restore（Gap 1 / Gap 3）
- 新增私有字段 `_pinnedAt: Date | null`，`create()` 置 `null`。
- 新增 `pin(now: Date)` / `unpin(now: Date)`：只写 `_pinnedAt`，**不触碰** `_updatedAt`；重复 pin 为 no-op（不刷新 pinnedAt？——否：重复 pin 刷新 pinnedAt，使“重新置顶”排到最前；unpin 未 pin 的 Note 为 no-op）。
- 新增 getter `pinnedAt`。
- `archive()` / `unarchive()` 维持独立 flag 语义，不读写 `_pinnedAt`。
- 新增 `static restore(...)`，镜像 `Idea.restore()`，字段含 `pinnedAt`、`labelIds`。
- `create()` 增加非空校验并保存 trim 后 content（与 ideas-workflow §2.1 对 Idea 的修正同规则）。
- 更新 `src/domain/note/__tests__/note.test.ts`：pin/unpin 语义、pin 不改变 updatedAt、重复 pin 刷新 pinnedAt、archive 不影响 pinnedAt、restore 全字段往返、空 content 创建失败。

### 2.2 `src/domain/idea/Idea.ts` — handled 能力（Gap 2，条件性）
- 若 ideas-workflow 已执行：无改动，直接依赖其 `changeStatus` / `handle`。
- 若本计划先执行：按 ideas-workflow §2.1 并入 `changeStatus(next, now)` 与 `handle(now)`，含相同 status no-op 与测试。

### 2.3 `src/domain/relation/Relation.ts` — kind 约定（Gap 4）
- 不新增工厂、不改模型：`note --derivedFrom--> idea` 与 `note --relatesTo--> goal|project` 直接复用通用 `Relation.create()`；kind 字符串约定写入 `docs/domain/domain.md`。
- 若 ideas-workflow 的 `Relation.derivedFromIdea` 工厂已存在且限定 sourceType 为 goal|task：扩展其 sourceType 联合类型加入 `'note'`，并补测试。

### 2.4 `src/domain/note/repository/NoteRepository.ts`
- 接口不变（`save / findById / list / delete`，filter 已有 archived / labelId）。排序契约保持在应用层。

## 3. 应用层

新建 `src/application/note/`。读写服务分离，页面通过 `Pick<Service, 'method'>` 注入，沿用现有页面测试模式（fakes 见 `src/application/__tests__/fakes.ts`，需补 fake NoteRepository）。

依赖：多仓储写入的事务端口 `TransactionRunner` 由 ideas-workflow §3.1 定义；若该计划未执行，本计划一并落地该端口与 fake。

### 3.1 record kind 常量 `noteRecordKinds.ts`
- `noteCaptured`、`noteEdited`、`notePinned`、`noteUnpinned`、`noteArchived`、`noteUnarchived`、`noteDerivedFromIdea`、`noteLinked`。
- kind 以 `note` 开头，便于 `startsWith('note')` 过滤活动流。

### 3.2 `NotesOverviewService.ts`
- 构造：`notes: NoteRepository, labels: LabelRepository, records: RecordRepository`。
- `getOverview()` 返回：
  - `counts: { active, archived }`。
  - `pinned`：active 且 pinnedAt 非空，按 pinnedAt 倒序。
  - `active`：active 未 pin，按 updatedAt 倒序。
  - `archived`：按 updatedAt 倒序（忽略 pin）。
  - `NoteListItem`：`id / content / pinnedAt / labelIds(解析为 name/color) / updatedAt`；UI 从 content 生成单行标题，不加 title 字段。
- 测试 pinned 分组与排序、archived 忽略 pin、计数、label 解析。

### 3.3 `NoteDetailService.ts`
- 构造：`notes, labels, relations, ideas, goals, projects, records`。
- `getDetail(noteId)` 返回：
  - `note: Note | null` 与解析后的 labels。
  - `source`：`relations.list({ targetType: 'note', targetId, kind: 'derivedFrom' })` 中 sourceType 为 idea 的那条，hydrate 为 `{ ideaId, content }`；悬空 relation 跳过。
  - `links`：`relations.list({ sourceType: 'note', sourceId, kind: 'relatesTo' })`，按 targetType 分别从 goals / projects hydrate 为 `{ type, id, title, status? }`。
  - `recentActivity`：`records.listByTarget('note', noteId)` 倒序截断（若 RecordRepository 尚无 listByTarget，沿用 ideas-workflow §3.4 的查询模式）。
- 测试未知 Note、source 与 links 混合、悬空 relation、labels。

### 3.4 `CaptureNoteService.ts`
- `capture({ noteId, content, recordId, recordRelationId, now })`：`Note.create` → save → append `noteCaptured` → 保存 `record --logs--> note`。同一事务。
- 测试空内容无写入、成功完整落库。

### 3.5 `EditNoteService.ts`
- 加载 → `note.edit` → save → append `noteEdited` → logs relation；内容未变化 no-op；未知 id 抛 `DomainError`。

### 3.6 `SetNotePinService.ts`
- `setPinned({ noteId, pinned, recordId, recordRelationId, now })`：加载 → `pin`/`unpin` → save → append `notePinned`/`noteUnpinned`。archived Note 允许 pin/unpin（flag 独立），但 UI 不在 archived 视图暴露 pin 按钮。

### 3.7 `ArchiveNoteService.ts`
- `setArchived({ noteId, archived, ... })`：`archive`/`unarchive` → save → append `noteArchived`/`noteUnarchived`；pinnedAt 保持不变。

### 3.8 `ExtractNoteFromIdeaService.ts`
- 输入：`ideaId / noteId / content / derivedRelationId / recordId / ideaRecordRelationId / noteRecordRelationId / now`。
- 事务内：
  1. 加载 Idea；未知或 archived 拒绝。
  2. `Note.create`（content 默认取 Idea content 的可编辑版本），复制 Idea labelIds，保存。
  3. 保存 `note --derivedFrom--> idea` Relation。
  4. 若 Idea 非 handled，`idea.handle(now)` 并保存（不重复产生 statusChanged record）。
  5. append `noteDerivedFromIdea` Record，logs relation 同时挂到 Idea 与 Note。
- handled Idea 允许再次提取。
- 测试 label 复制、关系方向、自动 handled、重复提取、archived/unknown Idea、事务回滚。

### 3.9 `LinkNoteService.ts`
- `link({ relationId, noteId, targetType: 'goal'|'project', targetId, recordId, recordRelationId, now })`：校验两端存在且未 archived → `note --relatesTo--> target` → append `noteLinked`。
- 重复链接同一 target 为 no-op（先查 relations）。
- 删除 Note 时的级联：`NoteRepository.delete` 之外，由调用方（详情页删除流程的服务方法或简单地在 DeleteNoteService 中）清理该 note 的 relations 与 logs relation 指向——若范围紧张，删除流程可仅删 Note 本体并在 Detail 服务中跳过悬空 relation（已有该防御）。决策：本期删除只删 Note + entity_labels，relation 悬空由查询端防御。

## 4. 基础设施层

### 4.1 `schema.ts` — notes 表（Gap 1 持久化）
- `MIGRATION_V1` 的 DDL 清单中加入：
  ```sql
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    archived INTEGER NOT NULL,
    pinned_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
  ```
- `EXPECTED_COLUMNS.notes` 同步；pinned_at 为 NULL 表示未 pin。
- 预发布阶段沿用 ensureTables 的“缺列即重建”策略，不写 ALTER 迁移（与现有注释约定一致）。

### 4.2 `SqliteNoteRepository.ts`
- 镜像 `SqliteIdeaRepository`：save 用 upsert + `replaceLabelIds(db, 'note', ...)`；findById/list/delete；list 支持 archived / labelId 过滤；hydrate 走 `Note.restore` + `loadLabelIds`。
- 排序不在 SQL 层做，返回后由应用层排序（数据量小，保持仓储简单）。
- Node SQLite 集成测试：save/restore 往返（含 pinnedAt、labels）、archived/labelId 过滤、delete 清理 entity_labels。

### 4.3 事务 runner
- 若 ideas-workflow §4.1 未执行：本计划实现 SQLite TransactionRunner（Expo 与 Node adapter 均支持 commit/rollback），composition root 注入。

## 5. UI 层

### 5.1 `src/ui/pages/notes/NotesPage.tsx`
- `InlineNavBar('Notes')` + capture 输入条（“Extract a thought…”），提交调 CaptureNoteService，成功清空并 refresh。
- SegmentedControl：Active · n / Archived · n。
- Active：Pinned 分组（pin 图标 + “Pinned x ago”）+ All notes（updatedAt 倒序）；Archived：dimmed 平铺。
- 行点击 `pushScreen('note:' + id)`；行副标题显示 label chips + 时间。
- 测试分组、分段切换、capture、导航。

### 5.2 `src/ui/pages/notes/NoteDetailPage.tsx`
- 顶部卡片：content（pencil 进入编辑，调 EditNoteService）、pin toggle（SetNotePinService，toast 反馈）、更新时间、labels 展示。
- Linked 区：source idea 行（点击进 `idea:<id>`，route 未落地则不可点）、goal/project links 行（进现有 detail route）、“Link a goal or project” 按钮打开 picker sheet（presentSheet 选项列表模式，数据来自 LinkNoteService 可用的轻量读模型，不允许 UI 直连 repository）。
- Actions 区：Archive/Unarchive（ArchiveNoteService）、Delete（确认后删除并返回列表）。
- 测试 pin toggle、archive 切换、link 添加、source/links 渲染、未知 Note。

### 5.3 Extract 入口（依赖 ideas-workflow 的页面）
- ideas 页面落地后：Create from Idea sheet 恢复/保留 Note 选项，提交调 ExtractNoteFromIdeaService，成功后跳转 `note:<id>`（对齐原型 deriveSave → note-detail 的行为）。
- ideas 页面未落地前：本计划可独立交付，Notes 仅从 Library 进入。

### 5.4 Library、导航与组合根
- `LibraryPage.tsx` Notes row：增加 count 与 `onPress: () => navigation.pushScreen('notes')`。
- `LibraryOverviewService`：counts 增加 `notes`（构造注入 NoteRepository）——这是对现有读模型的字段扩展，接受此次修改。
- `appDestinations.tsx`：注册 `notes` → NotesPage、`note:<id>` → NoteDetailPage。
- `AppServicesProvider.tsx` + `composeServices.ts`：注册 SqliteNoteRepository 与上述服务，注入共享 TransactionRunner。
- `devSeed.ts`：增加 pinned/active/archived Note 各若干、一条 `note --derivedFrom--> idea` 与一条 `note --relatesTo--> goal` 示例。

## 6. 测试与验收

### 6.1 自动验证
- 领域测试：Note pin/restore/content 规则；（条件）Idea.handle。
- 应用测试：两个 read service + 六个 command service（fakes 含 fake NoteRepository 与 fake TransactionRunner）。
- 基础设施测试：SqliteNoteRepository 往返与过滤；事务 rollback 无部分写入。
- UI 测试：NotesPage、NoteDetailPage、Library navigation。
- `npm run typecheck`、`npm test` 全绿。

### 6.2 手工原型对照
- Library → Notes → Note detail → 返回。
- Active/Archived 切换；Pinned 置顶且按 pinnedAt 排序；archived 忽略 pin。
- pin/unpin 后 updatedAt 与列表排序不受影响（pin 组除外）。
- Note detail 的 Linked 区显示 source idea 与 goal/project links；添加 link 立即出现。
- （ideas 页面已落地时）Idea → Create Note → 自动 handled → 跳转 Note detail，两侧 activity 均有记录。
- Archive 后 Note 进入 Archived，labels 与 links 保留。

## 7. 实施顺序

1. 原型范围对齐与文档更新（1）。
2. Note 领域：pinnedAt/pin/unpin/restore/create 校验 + 测试（2.1）；（条件）Idea.handle（2.2）。
3. schema notes 表 + SqliteNoteRepository + 集成测试（4.1、4.2）。
4. TransactionRunner 端口与实现（条件，3.1 依赖项 / 4.3）。
5. noteRecordKinds + NotesOverview/NoteDetail read services + 测试（3.1–3.3）。
6. Capture/Edit/SetPin/Archive command services + 测试（3.4–3.7）。
7. ExtractNoteFromIdea / LinkNote + 事务测试（3.8–3.9）。
8. NotesPage + NoteDetailPage（5.1、5.2）。
9. Library/导航/组合根/devSeed 接线（5.4）；ideas 页面存在时接 extract 入口（5.3）。
10. 全量 typecheck/jest、手工对照原型验收（6）。
