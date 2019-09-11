# github-miner

## Local setup

### Requirements

1. [git cli](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
2. [docker](https://docs.docker.com/docker-for-mac/install/)
3. [npm cli](https://www.npmjs.com/get-npm)

### Steps to setup locally

1. Open a terminal window
2. Clone this repo: `git clone git@github.com:rossanthony/github-miner.git`
3. Run setup: `npm run docker-setup` (this will trigger a download and build of the required docker containers, plus installation of the npm module dependencies)
4. Start mining: `npm run mine` (local machine) or `npm run docker-exec mine` (to execute inside the docker container)
5. Import the mined data into Neo4j: `npm run insert` (local) or `npm run docker-exec insert` (docker)
6. Explore the data via the locally running instance of Neo4j browser: [http://localhost:7474](http://localhost:7474)

## Running unit tests

Local: `npm run unit-tests`
Docker: `npm run docker-exec unit-tests`

## Structure of data and graph relationships

```
[github user]--(OWNS)-->[github repo]--(HAS_DEPENDENCY)-->[npm library]<--(MAINTAINS)--[npm author/github user]
```
