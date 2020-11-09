require('dotenv').config({ path: 'variables.env' });
const db = require('./db'); // cause we make db request in middleware to populate user
const createServer = require('./createServer');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// make the apolloServer
const server = createServer();

// make the express server
const app = express();

// add the middleware

// set cors
var corsOptions = {
    origin: process.env.FRONTEND_URL,
    //origin: [process.env.FRONTEND_URL, "https://tenvotes-yoga-prod.herokuapp.com/"],
    credentials: true // <-- REQUIRED backend setting
};
app.use(cors(corsOptions));

app.use(cookieParser());
// middleware: decode the jwt so we can get the user ID on each request
app.use((req, res, next) => {
    // pull the token out of the req
    const { token } = req.cookies;
    if (token) {
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        // put the userID on req for further requests to access
        req.userId = userId;
    }
    next();
});

// middleware: create a middleware that populates the user on each request
app.use(async (req, res, next) => {
    // if they aren't logged in, skip this
    if (!req.userId) return next();
    const user = await db.query.user(
      { where: { id: req.userId } },
      '{ id, permissions, email, items {id}, votes {id item { id }} }'
    ).catch(error => console.log(error));
    req.user = user;
    next();
});

server.applyMiddleware({
    app,
    path: '/', // keep this it will become https://tenvotes-yoga-prod.herokuapp.com/graphql
    cors: false, // disables the apollo-server-express cors to allow the cors middleware use
})
 
// app.listen({ port: 4444 }, () =>
//   console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
// );

app.listen({ port: process.env.PORT || 4000 }, () => {
    //process.env.PORT && console.log(`Our app is running on port ${ PORT }`);
    console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
});

// server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
//     console.log(`🚀 Server ready at ${url}`);
// });
























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