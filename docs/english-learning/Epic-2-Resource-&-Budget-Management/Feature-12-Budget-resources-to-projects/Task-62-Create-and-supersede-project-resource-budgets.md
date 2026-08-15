# Issue #62: Task: Create and supersede project resource budgets

**Labels:** task  
**State:** OPEN  
**Parent:** Feature: Budget resources to projects (#12)

---

## 1. Original English

## Outcome

Implement atomic application commands that create, change, and end Project Resource budgets while preserving the temporal relation history and provenance.

Parent Feature: #12

## Implementation plan

1. Implement a create-budget command using the contract from #61 and relation-writing port from Feature #19.
2. Resolve and validate the Project and Resource logical references in the domain layer, including active/archive state, canonical unit, positive exact amount, and configured capacity policy.
3. Implement change as one atomic operation that ends the prior active relation and appends its successor; implement explicit end without deleting either relation or metadata.
4. Serialize concurrent writes per Project/Resource or use the persistence foundation's optimistic conflict mechanism so two active budgets cannot be committed silently.
5. Emit provenance for committed create, supersede, and end mutations, including actor/cause and prior/new relation identifiers.

## Acceptance criteria

- [ ] A valid Project can create budgets for multiple distinct Resources.
- [ ] Missing, archived, or mismatched logical Project/Resource references are rejected in the application/domain layer.
- [ ] Change and end operations preserve ended relations rather than overwriting or deleting prior budgets.
- [ ] Concurrent commands cannot silently leave multiple active budgets for one Project/Resource context.
- [ ] Capacity policy is evaluated before commit and produces its configured reject or surfaced result.
- [ ] Provenance is emitted for every committed budget mutation and not for rolled-back attempts.

## Tests

- Test create, change, end, no-active-budget, and validation failure paths with fake relation/project/resource ports.
- Add an integration test proving supersession atomically ends the old relation and appends the new one.
- Test concurrent/conflicting changes and both configured capacity outcomes.

## Dependencies

- #61, Task: Define project budget relation contracts.
- Features #5, #19, #20, and #11 must provide their temporal relation, logical entity, and Resource contracts.

## Out of scope

- Read/history query presentation beyond command return values.
- Task allocations, consumption, automated rebudgeting, accounting, and billing.

---

## 2. 中文翻译

## 成果

实现原子的应用命令，用于创建、更改和结束项目资源预算，同时保留时态关系历史和来源记录。

父 Feature：#12

## 实施计划

1. 使用 #61 的契约和 Feature #19 的关系写入端口实现创建预算命令。
2. 在领域层解析并验证项目和资源的逻辑引用，包括活跃/归档状态、规范单位、正精确金额和配置的容量策略。
3. 将更改实现为一个原子操作：结束先前的活跃关系并追加其继任者；实现显式结束，而不删除任一关系或元数据。
4. 按项目/资源序列化并发写入，或使用持久化基础的乐观冲突机制，以避免两个活跃预算被静默提交。
5. 为已提交的创建、取代和结束变更发出来源记录，包括适用时的执行者/原因以及先前/新的关系标识符。

## 验收标准

- [ ] 有效的项目可以为多种不同资源创建预算。
- [ ] 缺失、归档或不匹配的项目/资源逻辑引用会在应用/领域层被拒绝。
- [ ] 更改和结束操作保留已结束的关系，而不是覆盖或删除先前预算。
- [ ] 并发命令不能静默地为一个项目/资源上下文留下多个活跃预算。
- [ ] 容量策略在提交前进行评估，并产生配置的拒绝或暴露结果。
- [ ] 来源记录仅针对已提交的预算变更发出，而不针对回滚的尝试。

## 测试

- 使用模拟的关系/项目/资源端口测试创建、更改、结束、无活跃预算和验证失败路径。
- 添加集成测试，证明取代操作会原子地结束旧关系并追加新关系。
- 测试并发/冲突更改以及两种配置的容量结果。

## 依赖

- #61，任务：定义项目预算关系契约。
- Features #5、#19、#20 和 #11 必须提供其时态关系、逻辑实体和资源契约。

## 排除范围

- 超出命令返回值之外的读取/历史查询展示。
- 任务分配、消耗、自动重新预算、会计和计费。

---

## 3. 英语学习重点

### 高频技术动词
| English | 含义 | 例句（从 issue 中选取或改写） |
|---|---|---|
| implement | 实现 | Implement atomic application commands. |
| create | 创建 | Create Project Resource budgets. |
| change | 更改 | Commands that create, change, and end budgets. |
| preserve | 保留 | Preserve the temporal relation history and provenance. |
| resolve | 解析 | Resolve the Project and Resource logical references. |
| validate | 验证 | Validate logical references in the domain layer. |
| append | 追加 | Append its successor relation. |
| serialize | 序列化 | Serialize concurrent writes per Project/Resource. |
| emit | 发出 | Emit provenance for committed mutations. |
| supersede | 取代 | Supersession atomically ends the old relation. |

### 固定搭配
| English pattern | 中文 | 用法 |
|---|---|---|
| atomic application commands | 原子应用命令 | implement atomic application commands |
| temporal relation history | 时态关系历史 | preserve the temporal relation history |
| create-budget command | 创建预算命令 | implement a create-budget command |
| relation-writing port | 关系写入端口 | use the relation-writing port |
| logical references | 逻辑引用 | resolve and validate logical references |
| active/archive state | 活跃/归档状态 | check active/archive state |
| configured capacity policy | 配置的容量策略 | enforce the configured capacity policy |
| optimistic conflict mechanism | 乐观冲突机制 | use the optimistic conflict mechanism |
| committed mutation | 已提交的变更 | emit provenance for committed mutations |
| rolled-back attempt | 回滚的尝试 | not emit provenance for rolled-back attempts |

### 值得模仿的句式
1. **“Implement atomic application commands that create, change, and end X while preserving the temporal relation history and provenance.”** — “实现原子的应用命令来创建、更改和结束 X，同时保留时态关系历史和来源记录。” — *Implement atomic application commands that create, change, and end Project Resource budgets while preserving the temporal relation history and provenance.*
2. **“Implement change as one atomic operation that ends the prior active relation and appends its successor; implement explicit end without deleting either relation or metadata.”** — “将更改实现为一个原子操作：结束先前的活跃关系并追加继任者；实现显式结束，而不删除任一关系或元数据。” — *Implement change as one atomic operation that ends the prior active relation and appends its successor; implement explicit end without deleting either relation or metadata.*
3. **“Serialize concurrent writes per Project/Resource or use the persistence foundation's optimistic conflict mechanism so two active budgets cannot be committed silently.”** — “按项目/资源序列化并发写入，或使用持久化基础的乐观冲突机制，以避免两个活跃预算被静默提交。” — *Serialize concurrent writes per Project/Resource or use the persistence foundation's optimistic conflict mechanism so two active budgets cannot be committed silently.*

### 领域词汇
| English | 中文 |
|---|---|
| atomic application command | 原子应用命令 |
| temporal relation history | 时态关系历史 |
| create-budget command | 创建预算命令 |
| relation-writing port | 关系写入端口 |
| logical reference | 逻辑引用 |
| active/archive state | 活跃/归档状态 |
| capacity policy | 容量策略 |
| supersede | 取代 |
| optimistic conflict mechanism | 乐观冲突机制 |
| committed mutation | 已提交的变更 |
| rolled-back attempt | 回滚的尝试 |

---

## 4. 小练习

1. We need to implement atomic application commands that create, change, and end Project Resource budgets while preserving the temporal relation history and ______.
2. On change, the command ends the prior active relation and ______ its successor.
3. Concurrent writes should be ______ per Project/Resource to avoid silent conflicts.
4. Provenance is emitted only for ______ budget mutations, not for rolled-back attempts.
5. Change and end operations preserve ended relations rather than ______ or deleting prior budgets.

<details>
<summary>点击查看答案</summary>

1. provenance  
2. appends  
3. serialized  
4. committed  
5. overwriting

</details>
