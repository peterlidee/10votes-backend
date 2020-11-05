const { GraphQLServer } = require('graphql-yoga');
const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
const db = require('./db');

// create graphQLServer yoga server
function createServer(){
    return new GraphQLServer({
        typeDefs: 'src/schema.graphql',
        resolvers: {
            Mutation,
            Query  
        },
        resolverValidationOptions: {
            requireResolversForResolveType: false
        },
        context: req => ({ ... req, db })
    })
}

module.exports = createServer;