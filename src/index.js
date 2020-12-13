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
        dummy: () => {
            return 1;
        },
    },
    Mutation:{
        testCookie: (parent, args, ctx, info) => {

            //console.log('---------------- ctx.res --------------', ctx.res)
            

            // generate random num 0-1000 to set as value for cookie
            const random = Math.floor(Math.random() * 1000);

            // set cookie
            ctx.res.cookie('test', random, {
                httpOnly: true,
                maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
                //secure: true,
                //sameSite: "none",
            });

            // set other cookie?
            // ctx.cookies.set("other-test", "booyah", {
            //     httpOnly: true,
            //     //sameSite: "lax",
            //     // here we put 6 hours, but you can put whatever you want (the shorter the safer, but also more annoying)
            //     maxAge: 1000 * 60 * 60 * 24, // oneday cookie
            //     //secure: process.env.NODE_ENV === "production",
            // });
            
            //console.log('************* ctx ******************', ctx.res)

            // console.log('cookie????', ctx.cookies)
            // console.log('********** ctx *************', ctx)

            return random;
        }
    }
};

// -3

const Cookies = require("cookies");

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
    
    context: ctx => ({ ...ctx }),

    // context: ctx => {
    //     const cookies = new Cookies(ctx.req, ctx.res);
    //     //const token = cookies.get("auth-token");
    //     //const user = verifyToken(token);
    //     //return { ...ctx, cookies };
    //     return { cookies, db };
    // },

    // context: req => {

    //     //console.log('wgat is req here?', req)
    //     //const cookies = new Cookies(req.req, req.res);
    //     //console.log('cookies', cookies)
    //     return {...req}
    // }

    // context: ({ req, res }) => {
    //     const cookies = new Cookies(req, res);
    //     // const token = cookies.get("auth-token");
    //     // const user = verifyToken(token);
    //     return {
    //         cookies,
    //     };
    // },

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

//app.use(cookieParser());


// middleware: decode the jwt so we can get the user ID on each request

// app.use((req, res, next) => {
//     console.log('what is res?')
//     console.log('************************************')
//     console.log(res)
//     console.log('**************************************')
//     next();
// });

// app.use((req, res, next) => {
//     console.log('are there cookies sent with req?', req.cookies)
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
    origin: "https://10votes-frontend.peterlidee.vercel.app/",
    //origin: true, // so we just set true and it works, dunno why but it took me long enough
};

//const cors = require('cors');

// app.use(
//     cors({
//         origin: "https://10votes-frontend.peterlidee.vercel.app/",
//         credentials: true,
//     })
// )
    
server.applyMiddleware({
    app,
    path: '/', // keep this or it will become frontend/graphql
    cors: corsOptions,
    //cors: false,
})

app.listen({ port: process.env.PORT || 4000 }, () => {
    console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
});