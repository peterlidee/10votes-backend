const { ApolloServer } = require('apollo-server-express');

// get resolvers
const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
// pull in remote prisma to add to ctx
const db = require('./db');

// we flipped from using schema.graphql to schema.js with gql
// TODO delete .gql one
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
        
        // allow playground in prod //TODO
        introspection: true,
        playground: true,

    })
}

module.exports = createServer;