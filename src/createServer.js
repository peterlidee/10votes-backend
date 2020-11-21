const { ApolloServer } = require('apollo-server-express');

const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
const db = require('./db');

// we flipped from using schema.graphql to schema.js with gql
const typeDefs = require('./schema.js');

// create ApolloServer
function createServer(){
    return new ApolloServer({
        typeDefs,
        resolvers: {
            Mutation,
            Query,
        },
        resolverValidationOptions: {
            requireResolversForResolveType: false
        },
        context: req => ({ ...req, db }),

        // allow playground in prod
        introspection: true,
        playground: true,

    })
}

module.exports = createServer;