const { forwardTo }  = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {

    // items: forwardTo('db'),
    // item: forwardTo('db'),
    // itemsConnection: forwardTo('db'),
    
    // async me(parent, args, ctx, info){
    //     // check if there is a current user id
    //     if(!ctx.req.userId){
    //         return null;
    //     }
    //     return ctx.db.query.user({
    //         where: { id: ctx.req.userId },
    //     }, info);
    // },
    
    // async users(parent, args, ctx, info){
    //     // are the logged in?
    //     if(!ctx.req.userId) throw new Error('You need to be logged in');
    //     // check if the user has the permission to query all the permissions
    //     hasPermission(ctx.req.user, ['ADMIN', 'PERMISSIONUPDATE']);
    //     // if they do, query all the users
    //     return ctx.db.query.users({}, info);
    // },

    // tag: forwardTo('db'),

    async apolloTag(parent, args, ctx, info){
        return ctx.db.query.tag({
            where: { name: args.name}
        });
    }


    // tags: forwardTo('db'),
    // location: forwardTo('db'),
    // locations: forwardTo('db'),
    // locationsConnection: forwardTo('db'),
    // country: forwardTo('db'),

};

module.exports = Query;
