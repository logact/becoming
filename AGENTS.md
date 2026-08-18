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
 

## Development Rules
1. The project is a mutiple layer and mutiple moudles project, the domain layer (under src/domain) contains the abstract model definetion and the behavior of them. The application provide service for the specific use case,for example create a new goal and save to the sqlitedb.The UI live the front code.The infrasctrure provide basic ability for example now the sqlitedb persistence capacility. Your code should obey the structure
2. When you try to modify a exsiting feature or create a faature,you should think ,how does the models in the domain behave? and then How does the use case behave in application  layer? and then How does the UI implement?
3. When you make some plan you should consider from the layers (domain,application,ui).
4. prefer create new application service not modify the exsiting application service

 ## git

The project has been fully refactored,don't refer the git history before 7513dbc2c3a573562f1bcb56c4bb04e1e0568ba6.
