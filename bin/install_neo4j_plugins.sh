#!/bin/sh
mkdir /bitnami/plugins
cd /bitnami/plugins
wget http://s3-eu-west-1.amazonaws.com/com.neo4j.graphalgorithms.dist/neo4j-graph-algorithms-3.5.8.1-standalone.jar
wget https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/3.5.0.3/apoc-3.5.0.3-all.jar