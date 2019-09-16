# github-miner

## Local setup

### Requirements

1. [git cli](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) latest version
2. [docker](https://docs.docker.com/docker-for-mac/install/) latest version
3. [npm cli](https://www.npmjs.com/get-npm) 6.*
4. [Node.js](https://nodejs.org/en/download/) LTS v10.*

Note: the following instalation steps have been tested on a MacOS system only, however because most of the commands can be executed via the docker container (as well as locally via npm) it should work on other systems without issues.

### Steps to setup locally

1. Open a terminal window and clone this repo: `git clone git@github.com:rossanthony/github-miner.git`
2. Run setup: `npm run docker-setup` (this will trigger a download and build of the required docker containers, plus installation of the npm module dependencies)
3. Make a copy of `.env.default` named `.env` (at the same root level in the project folder, note: this file is in the .gitignore so it won't be commited to avoid exposing secrets), update the following two lines: 
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```
with credentials from your own OAuth Github app. To obtain these to your github account and [go to /settings/developers](https://github.com/settings/developers), for more details on this process [see here](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/). Without this step the rate-limit will kick in at 10 requests p/min. Authenticated apps are permitted up to 30 requests p/min.
4. Install the neo4j plugins: `npm run install-neo4j-plugins`

## Running the app

### Mine the GitHub API and insert data into the local Neo4j graph db

1. Start mining: `npm run mine` (local machine) or `npm run docker-exec mine` (to execute inside the docker container)
2. Import the mined data into Neo4j: `npm run insert` (local) or `npm run docker-exec insert` (docker)
3. Explore the data via the locally running instance of Neo4j browser: [http://localhost:7474](http://localhost:7474)

### Insert data for one specific repo into the graph db

To import the dependencies for a specific repository use the following command `npm run insert <username> <repo>`, for example to run it against this repo run:
```
npm run insert rossanthony github-miner
```
Once this has run and imported the data, it is possible to run a cypher query like the example below:
```
MATCH (n1:GitRepo {full_name:'rossanthony/github-miner'})-[:DEPENDS_ON*]->(n) RETURN n
```
This should return all node_modules (direct imports and sub-dependencies) of the project.

![Dependency graph for github-miner](/analysis/github-miner-graph.png)

## Running unit tests

- Local: `npm run unit-tests`
- Docker: `npm run docker-exec unit-tests`

### Structure of data and graph relationships

```
(GitUser)--[:OWNS]-->(GitRepo)--[:DEPENDS_ON]-->(NodeModule)--[:HOSTED_ON]-->(GitRepo)
```
