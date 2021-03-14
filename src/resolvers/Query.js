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

    async items(parent, args, ctx, info){
        // create queryParams
        // items(
        //     orderBy: $orderBy
        //     skip: $skip,
        //     first: $first
        // )
        const queryParams = {
            orderBy: args.orderBy || 'createdAt_DESC',
            skip: args.skip || 0,
            first: args.first || 4, // TODO should equal clientside perPage from .env
        }

        // a query for items with tag was made
        if(args.tagSlug){
            // where: { tags_some: { slug: $slug }},
            queryParams.where = { tags_some: { slug: args.tagSlug }};
            return await ctx.db.query.items( queryParams, info );
        }
        throw new Error('No valid query was made');
        // fall through option
        return [];
    },

    async itemsConnection(parent, args, ctx, info){
        const query = {}
        // first check the taxonomy we're supposed to look up
        if(args.tagSlug){
            query.where = { tags_some: { slug: args.tagSlug }}
        }
        if(args.locationSlug && args.countryCode){
            query.where = { AND: [
                 { location: { slug: args.locationSlug }},
                 { location: { country: { countryCode: args.countryCode }}},
            ]}
        }
        if(!args.locationSlug && args.countryCode){
            query.where = { location: { country: { countryCode: args.countryCode }}}
        }
        if(!args.tagSlug && !args.countryCode){
            throw new Error('There was a problem with the query. No sufficiant arguments.')
        }
        return await ctx.db.query.itemsConnection( query, info );
    },
    
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
        return await ctx.db.query.tag({
            where: { slug: args.tagSlug}
        }, info);
    },

    // 2 possibilities: 
    // 1. namesIn: [String!] looks for extact matches
    // 2. nameContains: String looks for all the tags that contain the query
    async tags(parent, args, ctx, info){
        if(args.namesIn){
            return await ctx.db.query.tags({
                where: { name_in: args.namesIn }
            }, info)
        }
        if(args.nameContains){
            return await ctx.db.query.tags({
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
            return await ctx.db.query.locations({
                where: { name_contains: args.nameContains }
            }, info)
        }
        if(args.locationSlug && args.countryCode){
            return await ctx.db.query.locations({
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
        return await ctx.db.query.location({
            where: { slug: args.slug }
        }, info)
    },

    async country(parent, args, ctx, info){
        if(!args.countryCode) throw new Error('No country query was made.')
        return await ctx.db.query.country({
            where: { countryCode: args.countryCode }
        }, info)
    },
    
    // locationsConnection: forwardTo('db'),
    // country: forwardTo('db'),

    // TODO: check if we need await

    async userVotes(parent, args, ctx, info){
        if(!ctx.req.userId) return [null];
        return await ctx.db.query.votes({
            where: { 
                user: { id: ctx.req.userId } 
            }
        }, info)
    },

    // handle request for all the users items
    async userItems(parent, args, ctx, info){
        if(!ctx.req.userId) return [null];
        return await ctx.db.query.items({
            where: {
                user: { id: ctx.req.userId }
            }
        }, info)
    }
};

module.exports = Query;
