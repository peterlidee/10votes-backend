require('dotenv').config({ path: 'variables.env' });
const createServer = require('./createServer')
// called to populate user on req
const db = require('./db');

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
        return next();
    }
    const user = await db.query.user(
        { where: { id: req.userId } },
        '{ id, permissions, email, items {id}, votes {id item { id }} }'
    ).catch(error => console.log(error));
    req.user = user;
    next();
});
    
// set cors
const corsOptions = {
    credentials: true, // <-- REQUIRED backend setting
    origin: process.env.FRONTEND_URL,
};

server.applyMiddleware({
    app,
    path: '/', // keep this or it will become frontend/graphql
    cors: corsOptions,
})

app.listen({ port: process.env.PORT || 4000 }, () => {
    console.log(`🚀 Server ready at http://localhost:4444${server.graphqlPath}`)
});