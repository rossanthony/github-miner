## Show schema of db as graph
```
CALL apoc.meta.graph()
```

## Set initial nodes returned
```
:config initialNodeDisplay: 1000
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

## Dependency graph for a particular repo
```
MATCH dependencyGraph=(a:GitRepo {
	full_name:'rossanthony/github-miner'
})-[:DEPENDS_ON*]->(child:NodeModule) RETURN dependencyGraph
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

## Shortest paths
```
MATCH paths = allShortestPaths((a:GitRepo { full_name:'rossanthony/github-miner' })-[:DEPENDS_ON*]->(b:NodeModule { name:'assert-plus' }))
RETURN paths
```
Note: there is no helper function for finding the longest paths, but there are other ways to find this, see: https://neo4j.com/developer/kb/achieving-longestpath-using-cypher/


## Louvain method of community detection

For more info [see here](https://neo4j.com/docs/graph-algorithms/current/algorithms/louvain/)

Step 1. run the algorithm and write back results:
```
CALL algo.louvain.stream('NodeModule', 'DEPENDS_ON', {
	write:true, writeProperty:'community'
}) YIELD nodes, communityCount, iterations, loadMillis, computeMillis, writeMillis;
```

Step 2. search for communities with the most members
```
MATCH (n:NodeModule)
RETURN n.community as community, count(*) as size_of_community
ORDER by size_of_community DESC LIMIT 10
```

## Preferencial attachment

A value of 0 indicates that two nodes are not close, while higher values indicate that nodes are closer.

The library contains a function to calculate closeness between two nodes.

```
MATCH (p1:NodeModule {name: 'glob'})
MATCH (p2:GitRepo {full_name: 'rossanthony/github-miner'})
RETURN algo.linkprediction.preferentialAttachment(p1, p2) AS score
```
score 65221.0

```
MATCH (p1:NodeModule {name: 'lunar-calendar'})
MATCH (p2:GitRepo {full_name: 'rossanthony/github-miner'})
RETURN algo.linkprediction.preferentialAttachment(p1, p2) AS score
```
score 145.0

## Strongly connected components (SCC) alogorithm

Step 1. Find strongly connected nodes and write the partition values back to each node in the database:
```
CALL algo.scc('NodeModule', 'DEPENDS_ON',
    {write:true,writeProperty:'partition',concurrency:4, graph:'huge'})
YIELD loadMillis, computeMillis, writeMillis, setCount, maxSetSize, minSetSize
```
╒════════════╤═══════════════╤═════════════╤══════════╤════════════╤════════════╕
│"loadMillis"│"computeMillis"│"writeMillis"│"setCount"│"maxSetSize"│"minSetSize"│
╞════════════╪═══════════════╪═════════════╪══════════╪════════════╪════════════╡
│77          │860            │23           │56291     │9           │1           │
└────────────┴───────────────┴─────────────┴──────────┴────────────┴────────────┘

Step 2. Find the top 10 partitions:
```
MATCH (n:NodeModule)
RETURN n.partition as partition, count(*) as size_of_partition
ORDER by size_of_partition DESC LIMIT 10
```

╒═══════════╤═══════════════════╕
│"partition"│"size_of_partition"│
╞═══════════╪═══════════════════╡
│10730      │9                  │
├───────────┼───────────────────┤
│36548      │6                  │
├───────────┼───────────────────┤
│13391      │5                  │
├───────────┼───────────────────┤
│50216      │5                  │
├───────────┼───────────────────┤
│12469      │5                  │
├───────────┼───────────────────┤
│30896      │4                  │
├───────────┼───────────────────┤
│9232       │4                  │
├───────────┼───────────────────┤
│48617      │4                  │
├───────────┼───────────────────┤
│26237      │3                  │
├───────────┼───────────────────┤
│21376      │3                  │
└───────────┴───────────────────┘

Same as above but including the module names inside each partition:
```
MATCH (n:NodeModule)
RETURN n.partition as partition, collect(n.name) as modules, count(*) as size_of_partition
ORDER by size_of_partition DESC LIMIT 20
```

## PageRank
Step 1. Run algorithm:
```
CALL algo.pageRank('NodeModule', 'DEPENDS_ON',
  {direction:'OUTGOING', iterations:100, dampingFactor:0.85, write: true, writeProperty:'pagerank'})
YIELD nodes, iterations, loadMillis, computeMillis, writeMillis, dampingFactor, write, writeProperty
```

Step 2. Query:
```
MATCH (n:NodeModule)
RETURN n.name as name, n.pagerank as pagerank
ORDER by pagerank DESC LIMIT 10
```

## All relationships between two modules:
```
MATCH (a:NodeModule {name:'istanbul'}), (b:NodeModule {name:'coveralls'})
RETURN EXISTS((a)-[:DEV_DEPENDS_ON]-(b))
```

## Stream Neo4j query results to Gephi
```
match p = (n:NodeModule)-[:DEPENDS_ON*0]->(:NodeModule)
WHERE n.community=6
	OR n.community=2
    OR n.community=1
    OR n.community=25
    OR n.community=5
WITH p LIMIT 100000
with collect(p) as paths
call apoc.gephi.add('host.docker.internal','workspace2', paths) yield nodes, relationships, time
return nodes, relationships, time
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

## Total sub-dependencies for each devDependency of a repo

All (including circular references)
```
MATCH p=(repo:GitRepo {
   full_name:’rossanthony/github-miner’}
)-[:DEV_DEPENDS_ON*1]->(n1)-[:DEPENDS_ON*]->(n2) RETURN count(n2)
```

Distinct:
```
MATCH p=(repo:GitRepo {
   full_name:'rossanthony/github-miner'}
)-[:DEV_DEPENDS_ON*1]->(n1)-[:DEPENDS_ON*]->(n2) RETURN count(distinct n2)
```

Breakdown:
```
MATCH p=(repo:GitRepo {
   full_name:'rossanthony/github-miner'}
)-[:DEV_DEPENDS_ON*1]->(n1)-[:DEPENDS_ON*]->(n2)
RETURN distinct n1.name as devDependency, count(n2) as numOfDependencies
ORDER BY numOfDependencies DESC
```
╒══════════════════════════════════╤═══════════╤═══════════════════╕
│"devDependency"                   │"numOfDeps"│"numOfDistinctDeps"│
╞══════════════════════════════════╪═══════════╪═══════════════════╡
│"jest"                            │321265     │347                │
├──────────────────────────────────┼───────────┼───────────────────┤
│"eslint"                          │190        │115                │
├──────────────────────────────────┼───────────┼───────────────────┤
│"husky"                           │106        │76                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@typescript-eslint/parser"       │46         │23                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@typescript-eslint/eslint-plugin"│31         │27                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"ts-jest"                         │20         │18                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"nock"                            │15         │14                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/neo4j"                    │10         │10                 │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/request"                  │9          │9                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"ts-node"                         │7          │7                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/dotenv"                   │1          │1                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/fs-extra"                 │1          │1                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/jest"                     │1          │1                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/moment"                   │1          │1                  │
├──────────────────────────────────┼───────────┼───────────────────┤
│"@types/redis"                    │1          │1                  │
└──────────────────────────────────┴───────────┴───────────────────┘

Why does the module "jest" appear so often?
```
MATCH p=(n1:NodeModule {
   name:'jest'}
)-[:DEPENDS_ON*]->(n2:NodeModule)
RETURN distinct n2.name as dependency, count(n2) as numOfOccurances
ORDER BY numOfOccurances DESC
```

Stream data to Gephi for more details analysis of large sub-graphs such as this one:
```
MATCH p=(n1:NodeModule {
   name:'jest'}
)-[:DEPENDS_ON*]->(n2:NodeModule)
with collect(p) as paths
call apoc.gephi.add('host.docker.internal','workspace1', paths) yield nodes, relationships, time
return nodes, relationships, time
```

## Dependency chains for module

```
MATCH p=(n1:NodeModule {name:'eslint'})-[:DEPENDS_ON*]->(n2:NodeModule)
RETURN n1.name, [node in nodes(p) | node.name] as depsChain
```

All modules depending on "eslint" as a main dependency:
```
MATCH p=(n1:NodeModule {name:'eslint'})<-[:DEPENDS_ON*1]-(n2:NodeModule) RETURN distinct n2.name
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
