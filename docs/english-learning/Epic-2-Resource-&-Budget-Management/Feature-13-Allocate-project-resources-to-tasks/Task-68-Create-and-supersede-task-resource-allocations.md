# Issue #68: Task: Create and supersede task resource allocations

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Allocate project resources to tasks (#13)

---

## 1. Original English

## Outcome

Implement atomic commands to create, change, and end Task Resource allocations while enforcing Project membership and funding-budget invariants.

Parent Feature: #13

## Implementation plan

1. Implement create-allocation using #67 and the temporal relation write port.
2. Validate Task, Project, Resource, active Project membership, active budget, exact amount, and unit compatibility entirely in the application/domain layer.
3. Compute the proposed total active allocation for the Project/Resource and apply the configured reject-or-flag policy before commit.
4. Implement change as an atomic end of the current allocation plus append of its successor, and implement explicit end without deletion.
5. Protect active identity and aggregate checks from conflicting concurrent writes; emit relationship provenance for committed create, supersede, and end operations.

## Acceptance criteria

- [ ] Valid Tasks can receive explicit allocations for multiple Resources in their funding Project.
- [ ] Commands reject unrelated Project budgets and stale/missing Task membership.
- [ ] Amount and unit are validated against the active funding budget before commit.
- [ ] The proposed aggregate is evaluated according to the explicit over-allocation policy.
- [ ] Change/end operations retain prior plans as ended relations and cannot silently create duplicate active allocations.
- [ ] Committed changes produce provenance; failed or rolled-back attempts do not.

## Tests

- Test create, change, end, and all logical-reference validation failures with fake ports.
- Add integration tests for atomic supersession and concurrent allocation attempts against one budget.
- Test below-budget, exact-budget, and above-budget outcomes for both reject and flag policies.

## Dependencies

- #67, Task: Define project-funded task allocation contracts.
- Feature #12's active-budget query and Feature #18's active membership contract.

## Out of scope

- Allocation query projections beyond command results.
- Actual consumption, scheduling, and automatic redistribution.

---

## 2. 中文翻译

## 成果

实现原子命令，用于创建、更改和结束任务资源分配，同时强制项目成员资格和资金预算不变量。

父 Feature：#13

## 实施计划

1. 使用 #67 和时态关系写入端口实现 create-allocation。
2. 在应用/领域层中完全验证任务、项目、资源、活跃项目成员关系、活跃预算、精确金额和单位兼容性。
3. 计算项目/资源的拟议总活跃分配，并在提交前应用配置的拒绝或标记策略。
4. 将更改实现为当前分配的原子结束并追加其继任者；实现显式结束，而不删除任何数据。
5. 保护活跃标识和聚合检查免受冲突并发写入的影响；为已提交的创建、取代和结束操作发出关系来源记录。

## 验收标准

- [ ] 有效任务可以在其资金项目中接收多种资源的明确分配。
- [ ] 命令会拒绝不相关的项目预算以及过期/缺失的任务成员关系。
- [ ] 金额和单位在提交前会针对活跃资金预算进行验证。
- [ ] 拟议聚合会根据明确的超额分配策略进行评估。
- [ ] 更改/结束操作将先前计划保留为已结束的关系，且不能静默创建重复的活跃分配。
- [ ] 已提交的变更会产生来源记录；失败或回滚的尝试不会。

## 测试

- 使用模拟端口测试创建、更改、结束以及所有逻辑引用验证失败路径。
- 添加集成测试，证明取代操作是原子的，并测试针对同一预算的并发分配尝试。
- 测试 reject 和 flag 策略在低于预算、等于预算和高于预算时的结果。

## 依赖

- #67，任务：定义项目资助的任务分配契约。
- Feature #12 的活跃预算查询和 Feature #18 的活跃成员关系契约。

## 排除范围

- 超出命令结果的分配查询投影。
- 实际消耗、调度和自动重新分配。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| implement | 实现 | Implement atomic commands. |
| enforce | 强制、执行 | Enforce Project membership and funding-budget invariants. |
| validate | 验证 | Validate Task, Project, Resource, and active membership. |
| compute | 计算 | Compute the proposed total active allocation. |
| apply | 应用 | Apply the configured reject-or-flag policy. |
| append | 追加 | Append the successor allocation. |
| protect | 保护 | Protect active identity from conflicting writes. |
| emit | 发出 | Emit relationship provenance for committed operations. |
| reject | 拒绝 | Commands reject unrelated Project budgets. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| atomic commands | 原子命令 | implement atomic commands |
| create-allocation | 创建分配 | implement create-allocation |
| temporal relation write port | 时态关系写入端口 | use the temporal relation write port |
| active Project membership | 活跃项目成员关系 | enforce active Project membership |
| funding-budget invariants | 资金预算不变量 | enforce funding-budget invariants |
| exact amount | 精确金额 | validate exact amount and unit compatibility |
| proposed total active allocation | 拟议总活跃分配 | compute the proposed total active allocation |
| reject-or-flag policy | 拒绝或标记策略 | apply the configured reject-or-flag policy |
| atomic end | 原子结束 | atomic end of the current allocation |
| conflicting concurrent writes | 冲突的并发写入 | protect against conflicting concurrent writes |
| relationship provenance | 关系来源记录 | emit relationship provenance |

### 值得模仿的句式
1. **“Implement atomic commands to create, change, and end X while enforcing Y and Z.”** — “实现原子命令来创建、更改和结束 X，同时强制 Y 和 Z。” — *Implement atomic commands to create, change, and end Task Resource allocations while enforcing Project membership and funding-budget invariants.*
2. **“Compute the proposed total active allocation for the Project/Resource and apply the configured reject-or-flag policy before commit.”** — “计算项目/资源的拟议总活跃分配，并在提交前应用配置的拒绝或标记策略。” — *Compute the proposed total active allocation for the Project/Resource and apply the configured reject-or-flag policy before commit.*
3. **“Protect active identity and aggregate checks from conflicting concurrent writes; emit relationship provenance for committed create, supersede, and end operations.”** — “保护活跃标识和聚合检查免受冲突并发写入的影响；为已提交的创建、取代和结束操作发出关系来源记录。” — *Protect active identity and aggregate checks from conflicting concurrent writes; emit relationship provenance for committed create, supersede, and end operations.*

### 领域词汇
| English | 中文 |
|---|---|
| atomic command | 原子命令 |
| create-allocation | 创建分配 |
| temporal relation write port | 时态关系写入端口 |
| funding-budget invariant | 资金预算不变量 |
| proposed total active allocation | 拟议总活跃分配 |
| reject-or-flag policy | 拒绝或标记策略 |
| atomic end | 原子结束 |
| supersede | 取代 |
| concurrent write | 并发写入 |
| relationship provenance | 关系来源记录 |
| committed operation | 已提交的操作 |

---

## 4. 小练习

1. We need to implement atomic commands to create, change, and end Task Resource allocations while enforcing Project membership and ______ invariants.
2. The command must compute the proposed total active allocation for the Project/Resource and apply the configured ______ policy.
3. Change is implemented as an atomic end of the current allocation plus ______ of its successor.
4. We must protect active identity and aggregate checks from conflicting ______ writes.
5. Relationship provenance is emitted for committed create, supersede, and ______ operations.

<details>
<summary>点击查看答案</summary>

1. funding-budget  
2. reject-or-flag  
3. append  
4. concurrent  
5. end

</details>
