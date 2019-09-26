## Show schema of db as graph
```
CALL apoc.meta.graph()
```

## Find all dependencies of a particular repo:
```
MATCH (repo:GitRepo)-[:DEPENDS_ON]-(modules)
WHERE repo.name = "linter-eslint" RETURN repo, modules
```

## Find all repos that depend on a particular module:
```
MATCH (repos)-[:DEPENDS_ON]-(module:NodeModule)
WHERE module.name = "uuid" RETURN repos, module
```

## Get all properties from a particular node type
```
MATCH (n:GitRepo) RETURN PROPERTIES(n) as props, LABELS(n) as labels
```

## Export all parameters for a particular node type
```
MATCH (g:GitRepo)
RETURN g.full_name as full_name,
    g.forks_count as forks_count,
    g.open_issues_count as open_issues_count,
    g.size as size,
    g.stargazers_count as stargazers_count,
    g.watchers_count as watchers_count,
    g.pushed_at as pushed_at,
    g.updated_at as updated_at,
    g.created_at as created_at

MATCH (n:NodeModule)
RETURN n.name as module,
	n.dependenciesTotal as dependenciesTotal,
    n.devDependenciesTotal as devDependenciesTotal,
    n.peerDependenciesTotal as peerDependenciesTotal
```

## Calculate node rank / Centrality of a node
i.e., the relevance of a node by counting the edges from other nodes:
in-degree, out-degree and total degree.
```
MATCH (n:NodeModule)
RETURN n.name AS name,
size((n)-[:DEPENDS_ON]->()) AS dependencies,
size((n)<-[:DEPENDS_ON]-()) AS dependants
ORDER BY dependants DESC
```

## Users by number of repos owned
```
MATCH (user:GitUser)
RETURN user.username AS name, user.htmlUrl as url,
size((user)-[:OWNS]->(:GitRepo)) AS reposOwned
ORDER BY reposOwned DESC
```

## Louvain method of community detection
```
CALL algo.louvain.stream('NodeModule', 'DEPENDS_ON', {})
YIELD nodeId, community
RETURN algo.asNode(nodeId).name AS moduleName, community
ORDER BY community DESC
```
For more info [see here](https://neo4j.com/docs/graph-algorithms/current/algorithms/louvain/)

## All relationships between two modules:
```
MATCH (a:NodeModule {name:'istanbul'}), (b:NodeModule {name:'coveralls'})
RETURN EXISTS((a)-[:DEV_DEPENDS_ON]-(b))
```

## Top 10 most used node modules
```
MATCH ()-[:DEPENDS_ON]->(n1:NodeModule)
RETURN n1.name,count(*) as degree
ORDER BY degree DESC LIMIT 10
```

## Top 10 most used node modules in dev
```
MATCH ()-[:DEV_DEPENDS_ON]->(n1:NodeModule)
RETURN n1.name,count(*) as degree
ORDER BY degree DESC LIMIT 10
```

## all modules with self-referencing relationships (depending on themselves for dev)
```
MATCH (n1:NodeModule)-[:DEV_DEPENDS_ON]->(n1:NodeModule) RETURN n1
```

## all modules with self-referencing relationships (depending on themselves for production)
```
MATCH (n1:NodeModule)-[:DEPENDS_ON]->(n1:NodeModule) RETURN n1
```

## Count all nodes and list by unique labels
```
MATCH (n) RETURN DISTINCT count(labels(n)), labels(n)
```

## All repos with a star count higher than 15k
```
MATCH (n:GitRepo) WHERE n.stargazers_count > 15000 RETURN n
```

## Delete relationships, then nodes (relationships must be removed first)
```
MATCH (:GitUser)-[r:OWNS]-(:GitRepo) DELETE r
MATCH (:NodeModule)-[r:HOSTED_ON]-(:GitRepo) DELETE r
MATCH (g:GitUser) DELETE g
MATCH (g:GitRepo) DELETE g
```

## Most popular dependencies used across all NodeModules
```
MATCH (n:NodeModule)
WITH FLOOR(SIZE( (n)<-[:DEPENDS_ON]-(:NodeModule) )) AS totalDependsOn, n.name as moduleName
RETURN moduleName, totalDependsOn
ORDER BY totalDependsOn DESC
```

## Most popular dependencies used by GitRepos
```
MATCH (n:NodeModule)
WITH FLOOR(SIZE( (n)<-[:DEPENDS_ON]-(:GitRepo) )) AS totalDependsOn, n.name as moduleName
RETURN moduleName, totalDependsOn
ORDER BY totalDependsOn DESC
```

## Most popular devDependencies used by GitRepos/NodeModules
```
MATCH (n:NodeModule)
WITH FLOOR(SIZE((n)<-[:DEPENDS_ON]-(:GitRepo))) AS dependedOnByRepos,
	FLOOR(SIZE((n)<-[:DEPENDS_ON]-(:NodeModule))) AS dependedOnByModules,
  	n.name as module
RETURN module, dependedOnByRepos, dependedOnByModules
ORDER BY dependedOnByModules DESC LIMIT 10
```

## Breakdown of total GitRepo's vs. GitRepo's which are also NodeModules
```
OPTIONAL MATCH (g:GitRepo)<-[:HOSTED_ON]-(n:NodeModule)
WITH count(n) as totalNodeModulesHostedOnGit
OPTIONAL MATCH (g:GitRepo)
RETURN count(g) as totalRepos, totalNodeModulesHostedOnGit
```

## Fetch all GitRepo properties
```
MATCH (repo:GitRepo)
RETURN
    repo.full_name as full_name,
    repo.watchers_count as watchers_count,
    repo.forks_count as forks_count,
    repo.open_issues_count as open_issues_count,
    repo.stargazers_count as stargazers_count,
    repo.size as size,
    repo.updated_at as updated_at,
    repo.pushed_at as pushed_at,
    repo.created_at as created_at
```

## Retrieve meta data / stats on number of nodes and relationships in the db

Breakdown of relationships
```
START r=rel(*)
RETURN type(r), count(*)
```

Breakdown of nodes
```
START n=node(*)
RETURN labels(n), count(*)
```

## Delete all nodes and relationships
```
MATCH (n) DETACH DELETE n
```
