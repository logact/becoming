## Project Structure 
src: the code base
src/domain/{domain-name}/**: domain model,it own the model's struct and rule
src/domain/{domain-name}/repository: persist interface of the domain
src/application/:** use case 
src/ui/components/**: shared UI componentes
src/ui/pages/**: pages
src/infrastructure/sqliteRepository/**: local sqlite implementation of repository 

docs: the docs of specifcated fileds
docs/design/: something related to the design and UI
docs/models/: something related to the model define and behaviour
docs/issues/issue-{}: each issue ,each file,users record for feature ,task ... like github issue.
docs/issues/index.md: the index of all issues.
docs/exce-plans/{plan}/plan.md: the plans to implement some issues
docs/cycles/cycle-{idx}/cycle-plan.md: the aggregate plan for this agent cycle
docs/cycles/cycle-{idx}/cycle-report.md: the report after finish the plan.
 

## Development Rules
1. The project is a mutiple layer and mutiple moudles project, the domain layer (under src/domain) contains the abstract model definetion and the behavior of them. The application provide service for the specific use case,for example create a new goal and save to the sqlitedb.The UI live the front code.The infrasctrure provide basic ability for example now the sqlitedb persistence capacility. Your code should obey the structure
2. When you try to modify a exsiting feature or create a faature,you should think ,how does the models in the domain behave? and then How does the use case behave in application  layer? and then How does the UI implement?
3. When you make some plan you should consider from the layers (domain,application,ui).
4. prefer create new application service not modify the exsiting application service


 ## Git

The project has been fully refactored,don't refer the git history before 7513dbc2c3a573562f1bcb56c4bb04e1e0568ba6.



## Cycle workflow
**background**
The human normally doesn't ask the agent to generate the issues,when talk something he normally aks for modify the prototype to review the product logic and UI effect.
The human will add bug, idea, feature under the issues, and then the user may talk with the AI to generate the plan to implement the issue, and generate the execPlan under the execPlans. And then the Human will call the agent to start a cycle to implement the exec-plan or the issue.And then the agent will generate the aggregate plan we will execute this cycle. After the agent finish the plan ,the agent will generate the report of the plan-implementation.
The human should check the work of the cycle.

**workflow**
When the user ask for start a new cycle to implement the tasks and plans, you should make a aggerate plan (cycle-plan) to implement the tasks and features. The plan should ask human's approval . And when you finish the plan,you should record your report under this cycle (cycle-report).
Each cycle the agent should copy a snapshot plan for this cycle.
The cycle plan should refer to the raw tasks of the raw plan ,don't summarize or rewrite the plan
don't copy the raw plan refer the section of the raw plan

you should generate the plan 

each time you finish a task in the cycle workflow you should add commit and comment with cycle info and the task info
  
## About prototype
when the user ask you to generate/modify the prototype ,the user just need to quickly verify their idea ,so just quckly finish it, without too much verification work .