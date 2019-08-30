## Find all dependencies of a particular repo:
```
MATCH (repo:GitRepo)-[:DEPENDS_ON]-(modules)
WHERE repo.name = "linter-eslint" RETURN repo, modules
```

## Find all repo that depend on a particular module:
```
MATCH (repos)-[:DEPENDS_ON]-(module:NodeModule)
WHERE module.name = "uuid" RETURN repos, module
```

## Delete all nodes and relationships
```
MATCH (n) DETACH DELETE n
```
