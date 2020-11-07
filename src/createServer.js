const { ApolloServer } = require('apollo-server-express');
// TODO, remove graphql-yoga from package.json

// I tried using graphql-tools -> loadSchemaSync as an alternative to graphql-import
// but ran into a problem, either in prisma.qraphql file or maybe a bug
// Error: Unknown type *** at assertValidSDL
// and couldn't solve it, so reverted to deprecated graphql-import that works flawlessly

// doesn't work
// const { loadSchemaSync } = require('@graphql-tools/load');
// const { GraphQLFileLoader } = require('@graphql-tools/graphql-file-loader');
// const typeDefs = loadSchemaSync('./src/schema.graphql', { loaders: [new GraphQLFileLoader()] });

const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
const db = require('./db');

const { importSchema } = require('graphql-import');
const typeDefs = importSchema('./src/schema.graphql');

// create ApolloServer
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