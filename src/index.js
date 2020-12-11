require('dotenv').config({ path: 'variables.env' });

//const db = require('./db'); // cause we make db request in middleware to populate user
// 1
const { Prisma } = require('prisma-binding');

const db = new Prisma({
    typeDefs: './src/generated/prisma.graphql',
    endpoint: process.env.PRISMA_ENDPOINT,
    secret: process.env.PRISMA_SECRET,
    debug: false
});
// -1

//const createServer = require('./createServer');
// 2
const { ApolloServer, gql } = require('apollo-server-express');

// const Query = require('./resolvers/Query.js');
// const Mutation = require('./resolvers/Mutation.js');
//const db = require('./db');

// we flipped from using schema.graphql to schema.js with gql
//const typeDefs = require('./schema.js');
// 3

const typeDefs = gql`
    type Query{
        dummy: Int!
    }
    type Mutation{
        testCookie: Int!
    }
`;

const resolvers = {
    Query: {
        dummy() {
            return 1;
        },
    },
    Mutation:{
        testCookie(parent, args, ctx, info){

            // generate random num 0-1000 to set as value for cookie
            const random = Math.floor(Math.random() * 1000);

            // set cookie
            ctx.res.cookie('test', random, {
                httpOnly: true,
                maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
                //secure: true,
                //sameSite: "none",
            });
            //console.log('ctx', ctx)

            return random;
        }
    }
};

// -3

// create ApolloServer
const server = new ApolloServer({
    typeDefs,
    // resolvers: {
    //     Mutation,
    //     Query,
    // },
    resolvers,
    resolverValidationOptions: {
        requireResolversForResolveType: false
    },
    
    //context: req => ({ ...req, db }),
    //context: req => ({ ...req }),

    // allow playground in prod //TODO
    // introspection: true,
    // playground: true,

})

// -2








const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// make the apolloServer
// 2
//const server = createServer();

// make the express server
const app = express();

// add the middleware

app.use(cookieParser());
// middleware: decode the jwt so we can get the user ID on each request

// app.use((req, res, next) => {
//     console.log('what is res?')
//     console.log('************************************')
//     console.log(res)
//     console.log('**************************************')
//     next();
// });

/*
app.use((req, res, next) => {
    //console.log('cookies middleware', req.cookies)
    // pull the token out of the req
    const { token } = req.cookies;
    if (token) {
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        // put the userID on req for further requests to access
        req.userId = userId;
        //console.log('set userId?', req.userId)
    }
    next();
});

// middleware: create a middleware that populates the user on each request
app.use(async (req, res, next) => {
    // if they aren't logged in, skip this
    if (!req.userId) {
        return next();
    }
    const user = await db.query.user(
        { where: { id: req.userId } },
        '{ id, permissions, email, items {id}, votes {id item { id }} }'
    ).catch(error => console.log(error));
    req.user = user;
    //console.log('user on req', req.user)
    next();
});
*/
    
// set cors
const corsOptions = {
    credentials: true, // <-- REQUIRED backend setting
    //origin: process.env.FRONTEND_URL, // you'd think this would work but it only does locally, not on heroku
    origin: true, // so we just set true and it works, dunno why but it took me long enough
};
    
server.applyMiddleware({
    app,
    path: '/', // keep this or it will become frontend/graphql
    cors: corsOptions,
})

app.listen({ port: process.env.PORT || 4000 }, () => {
    console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
});