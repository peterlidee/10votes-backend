require('dotenv').config({ path: 'variables.env' });
const db = require('./db'); // cause we make db request in middleware to populate user
const createServer = require('./createServer');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// make the apolloServer
const server = createServer();

// make the express server
const app = express();

// add the middleware

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
    if (!req.userId) {
        console.log('not logged in', Math.random())
        return next();
    }
    console.log('there is a req.userId', req.userId);
    const user = await db.query.user(
        { where: { id: req.userId } },
        '{ id, permissions, email, items {id}, votes {id item { id }} }'
        ).catch(error => console.log(error));
        req.user = user;
        next();
    });
    
    // set cors
    var corsOptions = {
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
    //process.env.PORT && console.log(`Our app is running on port ${ PORT }`);
    console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
});