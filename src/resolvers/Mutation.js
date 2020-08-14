const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');
const slugify = require('slugify');

const Mutations = {

    async createItem(parent, args, ctx, info){
        // check if they are logged in
        if(!ctx.request.userId) throw new Error('You must be logged in to do that!');

        // 1. handle location
        // check if there is one
        if(!args.locationName) throw new Error('You need to enter a location!');

        let locationArgs;
        // if there's a locationId, just connect it
        if(args.locationId){
            locationArgs = {
                connect: { id: args.locationId }
            }
        }else{
            // there's no locationId
            // either the location doesn't exist yet, or wasn't selected
            // does it exist?
            const locationQuery = await ctx.db.query.locations({
                where: {
                    name: args.locationName
                }
            });
            // if the location exists, locationQuery[0] will be the result
            if(locationQuery[0]){
                locationArgs = {
                    connect: {
                        id: locationQuery[0].id
                    }
                }
            }else{
                // else, create a new location
                // make a slug
                const slug = slugify(args.locationName, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                locationArgs = {
                    create: {
                        name: args.locationName,
                        slug: slug,
                        country: { connect: { name: "Belgium" }}
                    }
                }
            }
        } // end handle location
        
        // 2. handle tags
        /*

            we get 2 possible arrays
            tagNames and tagIds
            
            2.1 we start by removing duplicates from tagNames
            if one of the duplicates has an id, keep that one

            2.2 for each tag with no id, check if it already exists (then connect) or not (then create) by a query

            2.3 construct the variables for mutation

        */
        const tagsArgs = {};

        if(args.tagNames){

            // 2.1 remove duplicates
            const uniqueTagNames = [];
            const uniqueTagIds = [];
            args.tagNames.map((tagName, i) => {
                const duplicateIndex = uniqueTagNames.findIndex(uniqueTagName => uniqueTagName.trim().toLowerCase() === tagName.trim().toLowerCase());

                if(duplicateIndex >= 0){ // there is a duplicate
                    // does the one already in uniqueTagNames have a corresponding id in uniqueTagIds that is not empty?
                    if(uniqueTagIds[duplicateIndex]){ // has ID
                        // do nothing, the uniqueTag has an id
                    }else{ // no ID
                        // the uniqueTag duplicate does not have an id
                        // overwrite the id of the uniqueTag with that of the current one
                        // if the current one has id, good; if not still empty, no harm done
                        uniqueTagIds[duplicateIndex] = args.tagIds[i];
                    }
                }else{ // no duplicate, so add it
                    uniqueTagNames.push(tagName);
                    uniqueTagIds.push(args.tagIds[i]);
                }
            });

            // 2.2 split the tags into tag that we know exist and tags we need to query

            const connectTags = []; // takes ids (these tags came with an ID)
            const noIdTags = []; // takes names from tags with no ids (we will need to query these)
            const createTags = []; // takes names (these will hold tags that yielded no search results)
            // check for ids on unduplicated tags
            uniqueTagIds.map((uniqueTagId, i) => {
                if(uniqueTagId){ // has id, push it to connectTags
                    connectTags.push(uniqueTagId)
                }else{ // no id, push it to noIdTags
                    noIdTags.push(uniqueTagNames[i]);
                }
            });

            // take the tags that don't have an id and query them to see if they exist
            const tagsQuery = await ctx.db.query.tags({
                where: { name_in: noIdTags }
            });

            // now we have a search result
            // check for each of the names we have, if it yielded a result
            noIdTags.map(noIdTag => {
                // console.log('the tag', noIdTag);
                const match = tagsQuery.find(tagQuery => tagQuery.name.toLowerCase() === noIdTag.toLowerCase());
                if(match){
                    connectTags.push(match.id)
                }else{
                    createTags.push(noIdTag);
                }
            });

            // 2.3 construct the create and connect objects for the createItem > tag mutation
            if(connectTags[0]){
                tagsArgs.connect = connectTags.map(connectTag => { return { id: connectTag }});
            }
            if(createTags[0]){
                tagsArgs.create = createTags.map(createTag => {
                    const slug = slugify(createTag, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                    return { name: createTag, slug: slug }
                });
            }
        }

        // DO the mutation
        const item = await ctx.db.mutation.createItem({
            data: {
                image: args.image,
                largeImage: args.largeImage,
                // this is how we create a relationship between the item and the user
                user: { connect: { id: ctx.request.userId }},
                location: locationArgs,
                tags: tagsArgs,
                voteCount: 0,
            }
        }, info);

        return item;

    },

    /*
    async createTag(parent, args, ctx, info){
        // only logged in people can create tags
        if(!ctx.request.userId) throw new Error('You must be logged in to do this');
        const tag = await ctx.db.mutation.createTag({
            data: {
                name: args.name,
                slug: args.slug
            },
        }, info);
        return tag;
    },

    async createCountry(parent, args, ctx, info){
        const country = await ctx.db.mutation.createCountry({
            data: {
                name: args.name,
                countryCode: args.countryCode,
            }
        }, info);
        return country;
    },

    async createLocation(parent, args, ctx, info){
        const slug = slugify(args.name, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
        const location = await ctx.db.mutation.createLocation({
            data: {
                name: args.name,
                slug: slug,
                country: {
                    connect: {
                        name: "Belgium"
                    }
                },
            }
        }, info);
        return location;
    },*/

    async updateItem(parent, args, ctx, info){
        
        // you need to be logged in
        if(!ctx.request.userId) throw new Error('You need to be logged in for that');

        // check if they own the item or have permission to do this
        const where = { id: args.id };
        // 1. find the item
        const currItem = await ctx.db.query.item({ where }, `{ id user { id } }`)
        // check if they own item or have permissions
        // do they own it or do they have the permission
        const ownsItem = currItem.user.id === ctx.request.userId;
        const hasPermissions = ctx.request.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error('You don\'t have permission to do that.')
        }
        

        // construct the data variable
        let data = {};

        // 1. handle location
        // if there's a locationName (meaning it changed) add the location to the mutation
        if(args.locationName){
            // if there's a locationId, just connect it
            if(args.locationId){
                data.location = {
                    connect: { id: args.locationId }
                }  
            }else{ // no locationId
                // either the location doesn't exist yet, or wasn't selected
                // does it exist?
                const locationQuery = await ctx.db.query.locations({
                    where: {
                        name: args.locationName
                    }
                });
                // if the location exists, locationQuery[0] will be the result
                if(locationQuery[0]){
                    data.location = {
                        connect: {
                            id: locationQuery[0].id
                        }
                    }
                }else{
                    // else (no results), create a new location
                    // create slug first
                    const slug = slugify(args.locationName, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                    data.location = {
                        create: {
                            name: args.locationName,
                            slug: slug,
                            country: { connect: { name: "Belgium" }}
                        }
                    }
                }
            }          
        } // end handle location

        // 2. handle tags
        if(args.tagNames){

            /*

                we get 3 possible arrays
                tagNames, tagIds and oldTags
                
                2.1 we start by removing duplicates from tagNames
                if one of the duplicates has an id, keep that one

                2.2 for each tag with no id, check if it already exists (then connect) or not (then create) by a query
                
                2.3 if there are oldTags and if there are tags both in tagNames and in oldTags, remove them from both 
                (don't add and delete the same tag!)
                
                2.4 lastly find out which tags are to be deleted

            */

            // 2.1 remove duplicates

            const uniqueTagNames = [];
            const uniqueTagIds = [];
            args.tagNames.map((tagName, i) => {
                const duplicateIndex = uniqueTagNames.findIndex(uniqueTagName => uniqueTagName.trim().toLowerCase() === tagName.trim().toLowerCase());

                if(duplicateIndex >= 0){ // there is a duplicate
                    // does the one already in uniqueTagNames have a corresponding id in uniqueTagIds that is not empty?
                    if(uniqueTagIds[duplicateIndex]){ // has ID
                        // do nothing, the uniqueTag has an id
                    }else{ // no ID
                        // the uniqueTag duplicate does not have an id
                        // overwrite the id of the uniqueTag with that of the current one
                        // if the current one has id, good; if not still empty, no harm done
                        uniqueTagIds[duplicateIndex] = args.tagIds[i];
                    }
                }else{ // no duplicate, so add it
                    uniqueTagNames.push(tagName);
                    uniqueTagIds.push(args.tagIds[i]);
                }
            });

            // 2.2 split the tags into tag that we know exist and tags we need to query

            let connectTags = []; // takes ids (these tags came with an ID)
            const noIdTags = []; // takes names from tags with no ids (we will need to query these)
            const createTags = []; // takes names (these will hold tags that yielded no search results)
            let disconnectTags = []; // takes ids (tags to be disconnected)
            // check for ids on unduplicated tags
            uniqueTagIds.map((uniqueTagId, i) => {
                if(uniqueTagId){ // has id, push it to connectTags
                    connectTags.push(uniqueTagId)
                }else{ // no id, push it to noIdTags
                    noIdTags.push(uniqueTagNames[i]);
                }
            });
            // take the tags that don't have an id and query them to see if they exist
            const tagsQuery = await ctx.db.query.tags({
                where: { name_in: noIdTags }
            });
            // now we have a search result
            // check for each of the names we have, if it yielded a result
            noIdTags.map(noIdTag => {
                const match = tagsQuery.find(tagQuery => tagQuery.name.toLowerCase() === noIdTag);
                if(match){
                    connectTags.push(match.id)
                }else{
                    createTags.push(noIdTag);
                }
            });

            // 2.3 remove tags that are to be added and disconnect if there are oldtags

            if(args.oldTagIds){
                // find tag ids that are both in connectTags and oldTags
                const redundantTags = connectTags.filter(connectTag => args.oldTagIds.includes(connectTag));
                // remove them from both
                connectTags = connectTags.filter(connectTag => !redundantTags.includes(connectTag));
                disconnectTags = args.oldTagIds.filter(oldTagId => !redundantTags.includes(oldTagId));
            }

            // 2.4 construct the create, connect and delete objects for the createItem > tag mutation

            data.tags = {};
            if(connectTags[0]){
                data.tags.connect = connectTags.map(connectTag => { return { id: connectTag }});
            }
            if(createTags[0]){
                data.tags.create = createTags.map(createTag => {
                    const slug = slugify(createTag, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                    return { name: createTag, slug: slug }
                });
            }
            if(disconnectTags[0]){
                data.tags.disconnect = disconnectTags.map(disconnectTag => { return { id: disconnectTag }});
            }
        }

        // run the update method
        const item = await ctx.db.mutation.updateItem({
            data: data,
            where: {
                id: args.id
            }
        }, info );

        return item;

    },

    async deleteItem(parent, args, ctx, info){
        const where = { id: args.id };
        // 1. find the item
        const item = await ctx.db.query.item({ where }, `{ id user { id } votes{ id } }`)
        if(!item) throw new Error('The item wasn\'t found.');

        // 2. check if they own item or have permissions
        // do they own it or do they have the permission
        const ownsItem = item.user.id === ctx.request.userId;
        const hasPermissions = ctx.request.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error('You don\'t have permission to do that.')
        }
        // 3. delete item
        const deleted = ctx.db.mutation.deleteItem({ where }, info);

        // 4. delete all the votes that were made on this item
        // solved with onDelete on datamodel

        return deleted;
    },

    async signup(parent, args, ctx, info){
        // lowercase the email
        args.email = args.email.toLowerCase();
        // hash the password
        const password = await bcrypt.hash(args.password, 10);
        const user = await ctx.db.mutation.createUser({
            data: {
                //name: args.name,
                email: args.email,
                password: password,
                permissions: { set: ['USER'] },
            }
        }, info);
        //create the JWT token for them
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // we set the jwt as a cookie on the response
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        //finally we return the user to the browser
        return user;
    },

    async login(parent, {email, password}, ctx, info){
        // 1. first check it there's a user with this email
        const user = await ctx.db.query.user({ where: {email} });
        if(!user){
            throw new Error(`No such user found for email ${email}`);
        }
        // 2. is password correct
        const valid = await bcrypt.compare(password, user.password);
        if(!valid) throw new Error('Invalid password');
        // 3. generate jwt token
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // 4. set the cookie with the token
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        // 5. return user
        return user;
    },

    logout(parent, args, ctx, info){
        ctx.response.clearCookie('token');
        return { message: 'Goodbye!'};
    },

    async requestReset(parent, args, ctx, info){
        // 1. check if it's a real user
        const user = await ctx.db.query.user({ where: { email: args.email }});
        if(!user) throw new Error(`No user with the email ${args.email}`);
        // 2. set resetToken and expiry
        const randomBytesPromiseified = promisify(randomBytes);
        const resetToken = (await randomBytesPromiseified(20)).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // one hour from now
        const res = await ctx.db.mutation.updateUser({
            where: { email: args.email },
            data: { resetToken, resetTokenExpiry }
        })
        // 3. email the token
        const mailRes = await transport.sendMail({
            from: 'peter@lidee.be',
            to: user.email,
            subject: 'Your password email token',
            html: makeANiceEmail(`Your password reset token is here: \n\n <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}">Click here to reset</a>`)
        })
        // 4. return the message
        return { message: 'Thanks' }
    },

    async resetPassword(parent, args, ctx, info){
        // 1. check if the passwords match
        if(args.password !== args.confirmPassword) throw new Error('Passwords don not match');
        // 2. check if it's a legit resettoken
        const [user] = await ctx.db.query.users({ 
            where: { 
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000,
            } 
        });
        if(!user) throw new Error('The resettoken is invalid or has expired');
        // 4. hash their new password
        const password = await bcrypt.hash(args.password, 10);
        // 5. save the new password to the user and remove the token fields
        const updatedUser = await ctx.db.mutation.updateUser({
            where: { email: user.email },
            data: {
                password: password,
                resetToken: null,
                resetTokenExpiry: null
            }
        }, info);
        
        // 6. generate jwt
        const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
        // 7. set the jwt cookie
        ctx.response.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        // 8. return new user
        return updatedUser;
    },

    async updatePermissions(parent, args, ctx, info){
        // 1. are they logged in
        if(!ctx.request.userId) throw new Error('Must be logged in!');
        // 2. query current user
        const currentUser = await ctx.db.query.user({
            where: { id: ctx.request.userId } 
        }, info)
        // 3. check if they have permission to do this
        hasPermission(currentUser, ['ADMIN', 'PERMISSIONUPDATE']);
        // 4. update the permissions
        return ctx.db.mutation.updateUser({
            where: { id: args.userId },
            data: { permissions: { set: args.permissions }},
        }, info);
    },

    async castVote(parent, args, ctx, info){
        // 1. is the user logged in?
        const userId = ctx.request.userId;
        if(!userId) throw new Error('You must be logged in');

        // 2. do they have votes left? TODO
        if(ctx.request.user.votes.length >= 10) throw new Error('You have no votes left');

        // 3. only one vote per item!!
        const itemInVotes = ctx.request.user.votes.filter(vote => vote.item.id === args.itemId).length > 0;
        if(itemInVotes) throw new Error('You already voted for this item');

        // 4. don't allow votes in own items
        const itemInOwnItems = ctx.request.user.items.filter(item => item.id === args.itemId).length > 0;
        if(itemInOwnItems) throw new Error('Voting on your own pictures leads to the dark side.')

        // 5. cast the vote
        const vote = await ctx.db.mutation.createVote({
            data: {
                item: { connect: { id: args.itemId }},
                user: { connect: { id: userId }},
            }
        }, info);

        // 6. use const vote to retrieve vote > items > votes , then update voteCount
        const update = ctx.db.mutation.updateItem({
            where: { id: args.itemId },
            data: { voteCount: vote.item.votes.length }
        });
        
        // 7. return vote
        return vote;
    },

    async deleteVote(parent, args, ctx, info){
        //console.log('args', args);
        // 1. is the user logged in?
        const userId = ctx.request.userId;
        if(!userId) throw new Error('You must be logged in');

        // 2. did they actually vote on this item?
        // find out if the the voteId is also in my votes
        const voteInMyVotes = ctx.request.user.votes.filter(vote => vote.id === args.voteId);
        // if not throw error
        if(!voteInMyVotes.length) throw new Error('You did not vote for this item.');
        // we found a match in my votes, also check if the item ids correspond
        // so the item we clicked on needs to correspond to the itemId of the vote in my votes
        if(voteInMyVotes[0].item.id !== args.itemId) throw new Error('We couldn\'t find this item. Please refresh the page.');

        // 3. delete the vote
        const vote = await ctx.db.mutation.deleteVote({
            where: { id: args.voteId }
        }, info);

        // 4. update item's voteCount
        // const vote returns vote > item > votes
        const update = await ctx.db.mutation.updateItem({
            where: { id: args.itemId },
            data: { voteCount: vote.item.votes.length }
        });

        // 5. return vote
        return vote;
    },

};

module.exports = Mutations;
