# Cycle 3 聚合计划

状态：**已批准**（2026-08-22）。

范围：

- `docs/exec-plans/dashboard-item-navigation/plan.md`
- `docs/exec-plans/goal-project-management/plan.md`
- `docs/exec-plans/start-time-and-date-input/plan.md`

本文件只引用原 exec-plan 的章节，不重写原任务。Cycle 3 的冻结计划副本位于 `docs/cycles/cycle-3/snapshots/`；执行与验收以冻结副本为准，原始计划后续变化不自动扩大本周期范围。本周期准备时的完整原型快照位于 `docs/cycles/cycle-3/prototype-snapshot/`。

## 计划边界与依赖裁决

- `dashboard-item-navigation` 原文 Source issue 限定条款与 §1 优先：只实施 Dashboard entity navigation；issue 末尾的 Goal-detail 句子由 `goal-project-management` 负责。
- 先完成 `dashboard-item-navigation` §2–§5，建立 Dashboard / Library 共用的详情 route rendering，再向所有 Goal-detail wrapper 注入本周期新增服务。
- `start-time-and-date-input` §2 的 shared picker 是所有本周期日期表单的先决条件。
- `start-time-and-date-input` §8.5 优先于 `goal-project-management` §6.4 的旧式日期文本输入描述：新建 Goal Project 的可选 Due 必须使用 shared native date picker，不新增或保留手工 `YYYY-MM-DD` 输入。
- `start-time-and-date-input` §3–§6 先于其 §7–§8；`goal-project-management` §2–§5 先于其 §6–§7。两个计划共同修改 Goal detail 与 composition 时，先完成 Goal Project Management UI，再叠加 Goal scheduling UI，并在集成验收中同时覆盖两组行为。
- `docs/issues/future/`、`docs/exec-plans/archived/` 与没有列入“范围”的文档不属于 Cycle 3。
- 保留准备周期前工作树中的用户改动；Cycle 3 的任务提交不得夹带无关改动。

## 执行清单（引用冻结 exec-plan 原文章节）

### 0. 批准与基线

- [x] 用户批准本聚合计划（2026-08-22）。
- [x] 冻结三份范围内 exec-plan，并复制本周期原型快照。
- [x] 记录准备时自动验证基线与工作树状态。

### 1. Dashboard entity navigation

- [x] `dashboard-item-navigation` §2。
- [x] `dashboard-item-navigation` §3。
- [x] `dashboard-item-navigation` §4–§5。
- [ ] 按 `dashboard-item-navigation` §6 完成独立验收。

### 2. Shared native date picker

- [ ] `start-time-and-date-input` §2。

### 3. Goal / Task schedule 领域与持久化

- [ ] `start-time-and-date-input` §3。
- [ ] `start-time-and-date-input` §4。

### 4. Goal / Task schedule 应用层与读模型

- [ ] `start-time-and-date-input` §5。
- [ ] `start-time-and-date-input` §6。

### 5. Goal Project Management 领域、应用与读模型

- [ ] `goal-project-management` §2。
- [ ] `goal-project-management` §3。
- [ ] `goal-project-management` §4。
- [ ] `goal-project-management` §5。

### 6. Goal Project Management UI 与接线

- [ ] `goal-project-management` §6–§7；Project Due 按本计划“计划边界与依赖裁决”使用 shared native date picker。

### 7. Goal / Task scheduling UI

- [ ] `start-time-and-date-input` §7。

### 8. 迁移其余日期输入

- [ ] `start-time-and-date-input` §8。

### 9. 文档、组合回归与全周期验收

- [ ] `goal-project-management` §8。
- [ ] `start-time-and-date-input` §9。
- [ ] 按 `goal-project-management` §9、`start-time-and-date-input` §10 完成独立验收。
- [ ] 对三份冻结计划执行跨计划集成回归，运行 `npm run typecheck` 与 `npm test -- --runInBand`。
- [ ] 生成 `docs/cycles/cycle-3/cycle-report.md`，按 domain、application、infrastructure、UI 分层记录产出、验证、偏差、遗留项及任务 commit。

## 执行与提交规则

- 获批后，每个上述实施任务使用一个全新的 sub-agent；同一 sub-agent 不复用于后续任务。
- 每完成一个任务项，立即更新本计划、创建独立 commit，并在 commit message 中包含 `cycle-3` 与任务范围。
- 跨计划共享能力只实现和提交一次，后续任务引用该提交，不复制实现。
- 每个任务开始前检查工作树；只暂存该任务文件，保留用户改动与其他任务改动。
- 周期报告必须明确记录相对冻结计划的裁决或偏差，不把范围外改动归入本周期。

## 准备时基线

- 准备日期：2026-08-22（Asia/Shanghai）。
- 基线 HEAD：`16c7c5d`。
- `npm run typecheck`：通过。
- `npm test -- --runInBand`：88 个测试套件 / 536 个测试通过，0 snapshots。
- 工作树在准备前已有未提交的 AGENTS、issues 与 exec-plans 文档改动；这些改动不属于本计划文件和快照创建提交。

## 批准门

用户已于 2026-08-22 批准按本计划启动 Cycle 3，可从“1. Dashboard entity navigation”开始实施。
