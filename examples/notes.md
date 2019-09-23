
## Data collection from Github API v3

1. seach/code - all repositories containing a 'package.json' file at the root
```
https://api.github.com/search/code?per_page=100&page=1&q=dependencies filename:package.json path:/
```
Total: 4415215


2. All repositories tagged with language of 'javascript', with at least 10 forks
```
https://api.github.com/search/code?per_page=100&page=1&q=dependencies+filename:package.json+path:/
```
Total: 88368


## Data collection from npm cli

1. `npm view -json nodemon`
Outputs meta data about a given npm package, in this case nodemon: [npm-nodemon-metadata.json](npm-nodemon-metadata.json)

