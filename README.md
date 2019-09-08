# github-miner

## Local setup

### Requirements

1. [git cli](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
2. [npm cli](https://www.npmjs.com/get-npm)
3. [docker](https://docs.docker.com/docker-for-mac/install/)

### Steps to setup locally

1. Open a terminal window
2. Clone this repo: `git clone git@github.com:rossanthony/github-miner.git`
3. Run setup: `npm run setup` (this should trigger a download and build of the required docker containers, plus installation of the npm module dependencies)
4. Start mining run `npm run mine`
5. Import the mined data into the local Neo4j database run: `npm run insert`
6. Explore the data via the locally running instance of Neo4j browser: [http://localhost:7474](http://localhost:7474)

## Running unit tests

```
npm run unit-tests
```

## Database graph relationships

```
[github user]--(OWNS)-->[github repo]--(HAS_DEPENDENCY)-->[npm library]<--(MAINTAINS)--[npm author/github user]
```
