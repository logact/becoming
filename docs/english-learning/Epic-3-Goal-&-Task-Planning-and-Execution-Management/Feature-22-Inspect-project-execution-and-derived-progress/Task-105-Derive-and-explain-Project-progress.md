# Issue #105: Task: Derive and explain Project progress

**Labels:** task  
**State:** CLOSED  
**Parent:** #22: Feature: Inspect project execution and derived progress

---

## 1. Original English

Parent Feature: #22 — Feature: Inspect project execution and derived progress

## Outcome

Project execution snapshots expose a deterministic derived-progress summary with a documented denominator and terminal/category rules, while blocked, incomplete, unmanaged, and invalid work remain visible.

## Implementation plan

1. Specify the V1 progress policy: which contained work enters the denominator, how duplicate/shared nodes are counted once, which terminal Project States/categories count complete, and how archived/ended relations and integrity-invalid nodes affect current versus historical calculations.
2. Implement a pure progress calculator over the execution snapshot and lifecycle enrichment, returning counts and an explicit status for complete, incomplete, blocked, unmanaged/no-machine, uninitialized, and structurally invalid work.
3. Define empty-Project and zero-denominator results explicitly (without divide-by-zero or invented completion), and retain numerator/denominator alongside any percentage.
4. Attach progress and diagnostic breakdowns to the read model only; never persist progress or lifecycle-derived values on the Project.

## Acceptance criteria

- [ ] The denominator and terminal-state/category completion rule are documented in code-facing contracts and observable output.
- [ ] Each eligible entity is counted deterministically once, including shared hierarchy nodes.
- [ ] Completed, incomplete, blocked, unmanaged, uninitialized, and structurally invalid work are surfaced in separate counts/findings.
- [ ] Empty Projects and zero-denominator snapshots return documented non-error results.
- [ ] Archived entities and ended relationships are excluded from current progress and can participate only in explicitly historical calculations under documented rules.
- [ ] Multiple-current-state and hierarchy anomalies prevent or qualify affected progress rather than being silently treated as complete/incomplete.
- [ ] Derived progress is attached to the read model and never persisted on the Project.

## Tests

- Progress tests for empty Projects, flat, nested, multi-Goal, shared-node, and anomaly-affected snapshots.
- Tests for terminal-state/category completion, zero-denominator handling, and current versus historical inclusion.
- Diagnostic breakdown tests for each status category.
- Schema/read-model tests proving no progress columns on `projects`.

## Dependencies

- Parent Feature: #22.
- Depends on Task: Enrich execution snapshots with current lifecycle state.

---

## 2. 中文翻译

父级 Feature：#22 —— 检查项目执行和派生进度

## 结果

项目执行快照暴露一个确定性的派生进度摘要，具有文档化的分母和终止/类别规则，同时阻塞、不完整、未受管理和无效的工作保持可见。

## 实施计划

1. 指定 V1 进度策略：哪些包含的工作进入分母，重复/共享节点如何只计算一次，哪些终止项目状态/类别算作完成，以及已归档/已结束关系和完整性无效节点如何影响当前与历史计算。
2. 在执行快照和生命周期充实之上实现纯进度计算器，返回计数以及对完成、不完整、阻塞、未受管理/无状态机、未初始化和结构无效工作的明确状态。
3. 明确定义空项目和零分母结果（不除以零或虚构完成），并在任何百分比旁边保留分子/分母。
4. 仅将进度和诊断明细附加到读模型；绝不将进度或生命周期派生值持久化到项目上。

## 验收标准

- [ ] 分母和终止状态/类别完成规则在面向代码的约定和可观察输出中形成文档。
- [ ] 每个符合条件的实体都被确定性计算一次，包括共享层级节点。
- [ ] 完成、不完整、阻塞、未受管理、未初始化和结构无效的工作会作为单独的计数/发现呈现。
- [ ] 空项目和零分母快照返回文档化的非错误结果。
- [ ] 已归档实体和已结束关系从当前进度中排除，并且只能在文档化规则下参与明确的历史计算。
- [ ] 多当前状态和层级异常会阻止或限定受影响进度，而不是被默默视为完成/不完整。
- [ ] 派生进度附加到读模型，绝不持久化到项目上。

## 测试

- 针对空项目、扁平、嵌套、多目标、共享节点和异常影响快照的进度测试。
- 针对终止状态/类别完成、零分母处理以及当前与历史包含的测试。
- 针对每个状态类别的诊断明细测试。
- 证明 `projects` 上没有进度列的模式/读模型测试。

## 依赖

- 父级 Feature：#22。
- 依赖任务：使用当前生命周期状态充实执行快照。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| derive | 派生 | Derive and explain Project progress |
| expose | 暴露、呈现 | expose a deterministic derived-progress summary |
| specify | 指定 | Specify the V1 progress policy |
| count | 计数 | duplicate/shared nodes are counted once |
| affect | 影响 | affect current versus historical calculations |
| retain | 保留 | retain numerator/denominator alongside any percentage |
| attach | 附加 | Attach progress and diagnostic breakdowns to the read model |
| persist | 持久化 | never persist progress on the Project |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| derived progress | 派生进度 | deterministic derived-progress summary |
| progress policy | 进度策略 | V1 progress policy |
| denominator | 分母 | documented denominator |
| terminal-state rule | 终止状态规则 | terminal-state/category rules |
| shared hierarchy node | 共享层级节点 | shared hierarchy nodes |
| zero-denominator | 零分母 | zero-denominator results |
| divide-by-zero | 除以零 | without divide-by-zero |
| diagnostic breakdown | 诊断明细 | progress and diagnostic breakdowns |

### 值得模仿的句式
1. **"A exposes B with C and D, while E remains visible."** — A 呈现具有 C 和 D 的 B，同时 E 保持可见。 — Project execution snapshots expose a deterministic derived-progress summary with a documented denominator and terminal/category rules, while blocked, incomplete, unmanaged, and invalid work remain visible.
2. **"A and B are documented in C and D."** — A 和 B 在 C 和 D 中形成文档。 — The denominator and terminal-state/category completion rule are documented in code-facing contracts and observable output.
3. **"A is attached to B and never persisted on C."** — A 附加到 B，绝不持久化到 C。 — Derived progress is attached to the read model and never persisted on the Project.

### 领域词汇
| English | 中文 |
|---|---|
| Progress | 进度 |
| Denominator | 分母 |
| Numerator | 分子 |
| Terminal state | 终止状态 |
| Category | 类别 |
| Diagnostic breakdown | 诊断明细 |
| Shared node | 共享节点 |
| Unmanaged | 未受管理的 |
| Uninitialized | 未初始化的 |

---

## 4. 小练习

1. Project execution snapshots expose a deterministic derived-______ summary.
2. Specify the V1 progress policy, including which contained work enters the ______.
3. Empty Projects and zero-denominator snapshots return documented non-______ results.
4. Derived progress is attached to the read ______ and never persisted on the Project.
5. Multiple-current-state and hierarchy anomalies ______ or qualify affected progress.

<details>
<summary>点击查看答案</summary>

1. progress
2. denominator
3. error
4. model
5. prevent
</details>
