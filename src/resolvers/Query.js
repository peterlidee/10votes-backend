const { forwardTo }  = require('prisma-binding'); // TODO, remove ?
const { hasPermission } = require('../utils');

const Query = {

    // items: forwardTo('db'),

    async item(parent, args, ctx, info){
        if(!args.itemId) throw new Error('You need an ID to query an item.')
        return await ctx.db.query.item({
            where: { id: args.itemId }
        }, info);
    },

    // itemsConnection: forwardTo('db'),
    
    async me(parent, args, ctx, info){
        //console.log('calling me query!!')
        //console.log('is there userId?', ctx.req.userId)
        // check if there is a current user id
        if(!ctx.req.userId){
            return null;
        }
        return await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, info);
    },
    
    // async users(parent, args, ctx, info){
    //     // are the logged in?
    //     if(!ctx.req.userId) throw new Error('You need to be logged in');
    //     // check if the user has the permission to query all the permissions
    //     hasPermission(ctx.req.user, ['ADMIN', 'PERMISSIONUPDATE']);
    //     // if they do, query all the users
    //     return ctx.db.query.users({}, info);
    // },

    async tag(parent, args, ctx, info){
        return ctx.db.query.tag({
            where: { name: args.name}
        }, info);
    },

    // TODO: return await to queries?????

    // 2 possibilities: 
    // 1. namesIn: [String!] looks for extact matches
    // 2. nameContains: String looks for all the tags that contain the query
    async tags(parent, args, ctx, info){
        if(args.namesIn){
            return ctx.db.query.tags({
                where: { name_in: args.namesIn }
            }, info)
        }
        if(args.nameContains){
            return ctx.db.query.tags({
                where: { name_contains: args.nameContains }
            }, info)
        }
        throw new Error('There needs to be a tag query! No arguments given.')
    },

    // 2 use cases
    // 1. nameContains: matches all location names that contain string, f.e. 'tes' matches "testing" and "test"
    // 2. double exact match: slug and countrycode
    async locations(parent, args, ctx, info){
        if(args.nameContains){
            return ctx.db.query.locations({
                where: { name_contains: args.nameContains }
            }, info)
        }
        if(args.locationSlug && args.countryCode){
            return ctx.db.query.locations({
                where: { AND: [
                    { slug: args.locationSlug },
                    { country: { countryCode: args.countryCode }}
                ]}
            }, info)
        }
        throw new Error('There needs to be a location query! No arguments given.');
    },

    // queries a single location, exact match
    async location(parent, args, ctx, info){
        if(!args.slug) throw new Error('No location query given.')
        return ctx.db.query.location({
            where: { slug: args.slug }
        }, info)
    },
    
    // locationsConnection: forwardTo('db'),
    // country: forwardTo('db'),

    async votes(parent, args, ctx, info){
        if(!ctx.req.userId) return [null];
        return await ctx.db.votes({
            where: { 
                user: { id: ctx.req.userId } 
            }
        })
    }

};

module.exports = Query;
