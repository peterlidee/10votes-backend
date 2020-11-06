const { ApolloServer } = require('apollo-server-express');
// TODO, other one
const { importSchema } = require('graphql-import');

const typeDefs = importSchema('./src/schema.graphql');
const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
const db = require('./db');

// create ApolloServer (yoga server)
function createServer(){
    return new ApolloServer({
        typeDefs,
        resolvers: {
            Mutation,
            Query,
            Node: {
                __resolveType() {
                    return null
                }
            } 
        },
        resolverValidationOptions: {
            requireResolversForResolveType: false
        },
        context: req => ({ ...req, db })
    })
}

module.exports = createServer;