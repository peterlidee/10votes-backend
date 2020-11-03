const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: 'variables.env' });
const createServer = require('./createServer');
const db = require('./db');

const server = createServer();

//use express middleware to handle cookies
server.express.use(cookieParser());

// middleware: decode the jwt so we can get the user ID on each request
server.express.use((req, res, next) => {
    // pull the token out of the req
    const { token } = req.cookies;
    if(token){
        const { userId } = jwt.verify(token, process.env.APP_SECRET);
        // put the userID on request for further requests to access
        req.userId = userId;
    }
    next();
});


// middleware: create a middleware that populates the user on each request
server.express.use( async (req, res, next) =>  {
    // if they aren't logged in, skip this
    if(!req.userId) return next();
    const user = await db.query.user(
        { where: { id: req.userId }},
        '{ id, permissions, email, items {id}, votes {id item { id }} }'
    ).catch(error => console.log(error));
    req.user = user;
    next();
});

// start server

console.log('backend, wth is process.env', process.env)
console.log('backend, wth is FRONTEND_URL', process.env.FRONTEND_URL)

server.start(
{
    cors:  {
        credentials: true,
        origin: process.env.FRONTEND_URL,
    }
}, 
deets => {
    console.log(`Server is now running on port http://localhost:${deets.port}`)
});