# Cycle 2 聚合计划

状态：**已批准，执行中**。用户于 2026-08-22 明确批准 Cycle 2。

范围：

- `docs/exec-plans/ideas-workflow/plan.md`
- `docs/exec-plans/tasks-page/plan.md`
- `docs/exec-plans/project-detail-alignment/plan.md`
- `docs/exec-plans/notes/plan.md`
- `docs/exec-plans/universal-capture/plan.md`

本文件只引用原 exec-plan 的章节，不重写原任务。Cycle 2 的冻结副本位于 `docs/cycles/cycle-2/snapshots/`；执行与验收以这些副本为准，原始计划后续变化不自动扩大本周期范围。

## 计划边界与依赖裁决

- `project-detail-alignment` 已由 Cycle 1 完成（commit `60d9e7a`，见 `docs/cycles/cycle-1/cycle-report.md`）。Cycle 2 不重复实现其 §1–§4，只在集成后重跑其 §5。
- `notes` 开篇的“取代”条款、§1.1 与 §5.3 优先于 `ideas-workflow` 中移除/排除 Note 的条款；本周期最终的 Create from Idea 保留 Goal / Task / Note。
- `ideas-workflow` §3.1、§4.1，`notes` §4.3 与 `universal-capture`“依赖与计划边界”所指的 `TransactionRunner` 只实现一次，供所有相关服务共享。
- `tasks-page` 先完成并注册 `task:<id>`，再完成 Ideas 的派生 Task 跳转；`universal-capture` 在 Ideas、Notes 与共享事务能力完成后实施。
- 当前已有的 Tasks 领域/Overview 部分实现是待审计输入，不预先视为完成；必须逐项满足 `tasks-page` 原文章节与验收。
- 保留准备周期前工作树中的用户改动；Cycle 2 的任务提交不得夹带无关改动。

## 执行清单（引用冻结 exec-plan 原文章节）

### 0. 批准与基线

- [x] 用户批准本聚合计划。
- [x] `project-detail-alignment` §1–§4、原文“实施顺序”1–7：继承 Cycle 1 已完成结果，不重复实施。
- [x] 记录实现开始时的自动验证基线，并审计 `tasks-page` §1.1、§2.1 的现有部分实现。

基线审计：自动验证见文末“准备时基线”。`Task.isOverdue` 与 `TaskOverviewService` 已有部分实现，但 §1.1 的完整边界测试、§2.1 的显式 `now`、archived 排除、doing + paused、attention 排序和类型契约仍需按冻结计划收敛；§2.2 以后尚未实施，因此 Tasks 各实施项保持待完成。

### 1. Tasks 工作流先行

- [x] `tasks-page` §1.1。
- [x] `tasks-page` §2.1–§2.4。
- [x] `tasks-page` §3.1–§3.5。
- [x] `tasks-page` §4–§5 与原文“实施顺序”8。

### 2. Ideas / Notes 共享领域与基础设施

- [x] `ideas-workflow` §1、§2.1–§2.2、§3.1–§3.2、§4.1–§4.2；按“计划边界与依赖裁决”保留 Note。
- [x] `notes` §1、§2.1–§2.4、§4.1–§4.3。

### 3. Ideas 应用层

- [x] `ideas-workflow` §3.3–§3.7。
- [x] `ideas-workflow` §3.8–§3.9。

### 4. Notes 应用层

- [x] `notes` §3.1–§3.7。
- [x] `notes` §3.8–§3.9。

### 5. Ideas / Notes UI 与接线

- [x] `ideas-workflow` §5.1–§5.4。
- [x] `notes` §5.1–§5.4；执行 §5.3 时与 Ideas 的 Create from Idea 流程合并验收。
- [x] `ideas-workflow` §6、`notes` §6。

验收记录：已按冻结 §6、Ideas/Notes 原型及本周期“保留 Note 派生”裁决完成独立核查；Library 导航、Ideas 分组/状态编辑、Goal/Task/Note 派生与 Task 必选 Project、handled/关系/双侧 activity、Notes Active/Archived/Pinned、Linked/归档/置顶语义及 SQLite 回滚均有自动验证。对照原型补齐 Pinned 行的 pin 标记，并增加归档后 labels/links 保留的 SQLite-backed 回归测试。`npm run typecheck` 通过；`npm test -- --runInBand` 通过（82 suites / 490 tests）。

### 6. Universal Capture

- [x] `universal-capture` §1–§2。
- [x] `universal-capture` §3–§4。
- [ ] `universal-capture` §5–§6。
- [ ] `universal-capture` §7 与原文“实施顺序”9。

### 7. 全周期回归与交付

- [ ] 重跑 `project-detail-alignment` §5，重点覆盖 `tasks-page` §2.4 对 AddTask 接线的回归影响。
- [ ] 五份冻结计划中所有自动验证与手工验收章节完成。
- [ ] 生成 `docs/cycles/cycle-2/cycle-report.md`，记录各层产出、验证结果、偏差、遗留项与任务 commit。

## 提交与报告规则

- 每完成一个上述任务项，立即勾选对应项并创建独立 commit；commit message 包含 `cycle-2` 与任务范围。
- 共享依赖只提交一次，后续任务引用该 commit，不复制实现。
- 周期报告按领域、应用、基础设施、UI 分层记录，并明确列出相对冻结计划的偏差。

## 准备时基线

- 准备日期：2026-08-22（Asia/Shanghai）。
- 基线 HEAD：`d379146`。
- `npm run typecheck`：通过。
- `npm test -- --runInBand`：51 个测试套件 / 350 个测试通过。
- 工作树在准备前已有未提交改动；这些改动不属于本计划文件创建。
