// 1. set up DB

const { Prisma } = require('prisma-binding');
require('dotenv').config({ path: 'variables.env' });

const db = new Prisma({
    typeDefs: './src/generated/prisma.graphql',
    endpoint: process.env.PRISMA_ENDPOINT,
    secret: process.env.PRISMA_SECRET,
    debug: false
});




const { ApolloServer } = require('apollo-server-express');
const { importSchema } = require('graphql-import');

//const express = require('express');
//const cors = require('cors');

// const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');
// require('dotenv').config();

const typeDefs = importSchema('./src/schema.graphql');
const Query = require('./resolvers/Query.js');
const Mutation = require('./resolvers/Mutation.js');
//const db = require('./db');


const server = new ApolloServer({
    typeDefs,
    resolvers: {
        Mutation,
        Query
    },
    resolverValidationOptions: { requireResolversForResolveType: false },
    context: req => ({ ...req, db }),
});

// app.listen({ port: 4000 }, () =>
//   console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
// );
























// const cookieParser = require('cookie-parser');
// const jwt = require('jsonwebtoken');

// require('dotenv').config({ path: 'variables.env' });

// const createServer = require('./createServer');
// const db = require('./db');

// const server = createServer();

// //use express middleware to handle cookies
// server.express.use(cookieParser());

// // middleware: decode the jwt so we can get the user ID on each request
// server.express.use((req, res, next) => {
//     // pull the token out of the req
//     const { token } = req.cookies;
//     if(token){
//         const { userId } = jwt.verify(token, process.env.APP_SECRET);
//         // put the userID on request for further requests to access
//         req.userId = userId;
//     }
//     next();
// });


// // middleware: create a middleware that populates the user on each request
// server.express.use( async (req, res, next) =>  {
//     // if they aren't logged in, skip this
//     if(!req.userId) return next();
//     const user = await db.query.user(
//         { where: { id: req.userId }},
//         '{ id, permissions, email, items {id}, votes {id item { id }} }'
//     ).catch(error => console.log(error));
//     req.user = user;
//     next();
// });

// // start server

// // console.log('what is process.env NODE ENV?', process.env.NODE_ENV);
// // console.log('backend, wth is process.env', process.env)                 // TODO
// // console.log('backend, wth is FRONTEND_URL', process.env.FRONTEND_URL) // TODO

// server.start(
// {
//     cors:  {
//         credentials: true,
//         origin: process.env.FRONTEND_URL,
//     }
// },
// deets => {
//     console.log(`Server is now running on port http://localhost:${deets.port}`)
// });