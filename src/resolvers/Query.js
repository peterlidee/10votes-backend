const { hasPermission, cleanupInput, makeSlug } = require('../utils');

const Query = {

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

        if(args.tagSlug){ //tag query
            // where: { tags_some: { slug: $slug }},
            queryParams.where = { tags_some: { slug: args.tagSlug }};
        }else if(args.locationSlug && args.countryCode){ // location query
            // where: { AND: [
            //     { location: { slug: $slug }},
            //     { location: { country: { countryCode: $countryCode }}},
            // ]},
            queryParams.where = { AND: [
                { location: { slug: args.locationSlug }},
                { location: { country: { countryCode: args.countryCode }}}
            ]};
        }else if(!args.locationSlug && args.countryCode){ // country query
            // where: { location: { country: { countryCode: $countryCode }}}
            queryParams.where = { location: { country: { countryCode: args.countryCode }}};
        }
        // some item queries will have no slugs, fe. most recent or most voted on home page
        return await ctx.db.query.items( queryParams, info );
    },

    async itemsByIds(parent, args, ctx, info){
        return await ctx.db.query.items({
            where: { id_in: args.ids }
        }, info).catch(error => console.log(error.message))
    },

    async itemsConnection(parent, args, ctx, info){
        const query = {}
        // first check the taxonomy we're supposed to look up
        if(args.tagId) query.where = { tags_some: { id: args.tagId }}
        if(args.tagSlug) query.where = { tags_some: { slug: args.tagSlug }}
        
        if(args.locationId) query.where = { location: { id: args.locationId }}
        if(args.locationSlug && args.countryCode){
            query.where = { AND: [
                 { location: { slug: args.locationSlug }},
                 { location: { country: { countryCode: args.countryCode }}},
            ]}
        }

        if(args.countryId) query.where = { location: { country: { id: args.countryId }}}
        if(!args.locationSlug && args.countryCode){ // a country doesn't have a locationSlug
            query.where = { location: { country: { countryCode: args.countryCode }}}
        }

        if(!args.tagSlug && !args.tagId && !args.countryCode && !args.countryId && !args.locationSlug && !args.locationId){
            throw new Error('There needs to be at least one query parameter.')
        }
        return await ctx.db.query.itemsConnection( query, info );
    },
    
    async me(parent, args, ctx, info){
        // check if there is a current user id
        if(!ctx.req.userId){
            return null;
        }
        return await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, info);
    },

    async user(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to query users.');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("Admin, you are not.")

        //  check if there is an id
        if(!args.userId) throw new Error('No user specified.')
        // make actual query of the user we're searching for
        return await ctx.db.query.user({
            where: { id: args.userId },
        }, info);
    },

    async users(parent, args, ctx, info){
        
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        // cleanup args
        const emailContains = args.emailContains.trim();
        // check args.length
        if(emailContains.length == 0) throw new Error("Please enter a search query.");
        return await ctx.db.query.users({
            where: { email_contains: emailContains }
        }, info)
    },

    async tag(parent, args, ctx, info){
        const variables = {}
        if(args.tagSlug)    variables.slug = args.tagSlug;
        if(args.tagId)      variables.id = args.tagId;
        if(!args.tagSlug && !args.tagId) throw new Error('You need to query an ID or slug.')
        return await ctx.db.query.tag({
            where: variables
        }, info);
    },

    // 2 possibilities: 
    // TODO: names_in not used? remove???
    // 1. namesIn: [String!] looks for extact matches
    // 2. nameContains: String looks for all the tags that contain the query
    async tags(parent, args, ctx, info){
        const variables = {}
        // if(args.namesIn)        variables.name_in = cleanupInput(args.namesIn);
        // if(args.nameContains)   variables.name_contains = cleanupInput(args.nameContains);
        // if(!args.namesIn && !args.nameContains) throw new Error('There needs to be a tag query! No arguments given.')
        if(!args.nameContains) throw new Error('There needs to be a tag query! No arguments given.')

        // prisma1 doesn't support case insensitive queries (though it did work locally?)
        // so we take the nameContains arg (this is the query that is made by the user)
        // we slugify it and then search for that in the slug field of the tags type
        // f.e. search "De Pin" will search for slug_contains "de_pin"
        return await ctx.db.query.tags({
            //where: variables
            where: {
                slug_contains: makeSlug(cleanupInput(args.nameContains))
            }
        }, info)
    },

    // queries a single location, exact match for slug, or ID
    async location(parent, args, ctx, info){
        const variables = {}
        if(args.locationId) variables.id = args.locationId;
        if(args.locationSlug) variables.slug = args.locationSlug;
        if(!args.locationSlug && !args.locationId) throw new Error('No location query given.')
        return await ctx.db.query.location({
            where: variables
        }, info)
    },

    // 2 use cases
    // 1. nameContains: matches all location names that contain string, f.e. 'tes' matches "testing" and "test"
    // 2. double exact match: slug and countrycode, used in LOCATION_EXISTS_QUERY
    async locations(parent, args, ctx, info){
        if(args.nameContains){
            return await ctx.db.query.locations({
                where: { name_contains: cleanupInput(args.nameContains)}
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

    // queries a single country, exact match
    async country(parent, args, ctx, info){
        if(!args.countryCode) throw new Error('No country query given.')
        return await ctx.db.query.country({
            where: { countryCode: args.countryCode }
        }, info)
    },

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
