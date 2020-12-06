const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission, removeDuplicates } = require('../utils');
const slugify = require('slugify');

const Mutations = {

    /*

    async createItem(parent, args, ctx, info){
        // check if the user islogged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do that!');

        // 1. handle location
        
        // check if there is a location
        if(!args.location) throw new Error('You need to enter a location!');
        
        // check it the location is a new one or an already existing one
        let locationArgs;
        // does it exist?
        const locationQuery = await ctx.db.query.locations({
            where: {
                name: args.location
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
            const slug = slugify(args.location, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
            locationArgs = {
                create: {
                    name: args.location,
                    slug: slug,
                    country: { connect: { name: "Belgium" }}
                }
            }
        }
        
        // 2. handle tags

        //  we get an array of max 3 strings
        //    each item may be a new or existing tag

       const tagsArgs = {};
       
        // 1. remove possible empty value
        // 2. remove duplicates
        const tags = removeDuplicates(args.tags).filter(tag => tag)

        // only when there are actually args
        if(tags.length > 0){

            // 3. query each of the args
            const tagsQuery = await ctx.db.query.tags({
                where: { name_in: tags }
            });
            
            // now we have a search result
            // 4. check for each of the names we have, if it yielded a result
            const connectTagIDs = [];
            const createTags = [];
            tags.map(tag => {
                // console.log('tag', tag);
                // lowercase both to get real match
                const match = tagsQuery.find(tagQuery => tagQuery.name.toLowerCase() === tag.toLowerCase());
                if(match){
                    // use the id to connect, not the name
                    connectTagIDs.push(match.id)
                }else{
                    createTags.push(tag);
                }
            });
    
            // 5. construct the create and connect objects for the createItem > tag mutation

            if(connectTagIDs[0]){ // if there are any
                tagsArgs.connect = connectTagIDs.map(connectTagID => { return { id: connectTagID }});
            }
            if(createTags[0]){ // if there are any
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
                user: { connect: { id: ctx.req.userId }},
                location: locationArgs,
                tags: tagsArgs,
                voteCount: 0,
            }
        }, info);

        return item;

    },

    */

    
    async createTag(parent, args, ctx, info){
        // only logged in people can create tags
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        const tag = await ctx.db.mutation.createTag({
            data: {
                name: args.name,
                slug: args.slug
            },
        }, info);
        return tag;
    },

    /*
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

    /*

    async updateItem(parent, args, ctx, info){
        
        // you need to be logged in
        if(!ctx.req.userId) throw new Error('You need to be logged.');

        // check if this item (args.id) is inside the users items (ctx.req.user)
        const ownsItem = ctx.req.user.items.find(item => item.id === args.id);
        // check if the user has permission to do this
        const hasPermissions = ctx.req.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error('You don\'t have permission to do that.')
        }        

        // construct the data variable
        let data = {};

        // 1. handle location
        // if there's a new location
        if(args.location){
            // does the new location already exist (is it in db?)
            const locationQuery = await ctx.db.query.locations({
                where: {
                    name: args.location
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
                const slug = slugify(args.location, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                data.location = {
                    create: {
                        name: args.location,
                        slug: slug,
                        country: { connect: { name: "Belgium" }}
                    }
                }
            }       
        }  // else, no changes were made, don't do anything
        // end handle location


        // 2. handle tags

        // only do stuff when there were changes to the tags
        if(args.newTagNames){

            const { newTagNames, oldTagNames } = args;
            const tagsToConnect = [];
            const tagsToCreate = [];
            const tagsToDisconnect = [];

            // first check which tags are to be disconnected:
            // an oldTag is to be removed when it's not in newTags
            if(oldTagNames){
                oldTagNames.map((oldTagName, i) => {
                    if(!newTagNames.find(newTagName => newTagName.toLowerCase() == oldTagName.toLowerCase())){
                        tagsToDisconnect.push(args.oldTagIds[i]);
                    }
                });
            }
            //console.log('tagsToDisconnect', tagsToDisconnect);

            // now check wich tags are to be added
            const cleanedTags = removeDuplicates(newTagNames)
                //[...new Set(newTagNames)] // remove the duplicates
                .filter(newTagName => {
                    // remove the empties
                    if(!newTagName) return false;
                    // remove the items that are in oldTagNames if there are oldTagNames
                    if(oldTagNames && oldTagNames.find(oldTagName => oldTagName.toLowerCase() == newTagName.toLowerCase())) return false;
                    // return the rest
                    return true;
                }
            );

            // console.log('cleaned tags', cleanedTags)

            // now, this leaves us with a list of tags
            // we need to figure out which of these tags already exist and which are to be created
            const tagsQuery = await ctx.db.query.tags({
                where: { name_in: cleanedTags }
            });

            // now we have a search result
            // check for each of the names we have, if it yielded a result
            if(cleanedTags.length){
                cleanedTags.map(cleanedTag => {
                    const match = tagsQuery.find(tagQuery => tagQuery.name.toLowerCase() === cleanedTag.toLowerCase());
                    if(match){
                        tagsToConnect.push(match.id)
                    }else{
                        tagsToCreate.push(cleanedTag);
                    }
                });
            }

            // now for the final step
            // create variables and add tagsTo connect, disconnect and create if needed

            data.tags = {};
            if(tagsToConnect.length){
                data.tags.connect = tagsToConnect.map(tagToConnect => { return { id: tagToConnect }});
            }
            if(tagsToCreate.length){
                data.tags.create = tagsToCreate.map(tagToCreate => {
                    const slug = slugify(tagToCreate, { lower: true, remove: /[*+_~.()'"!:@\/]/g });
                    return { name: tagToCreate, slug: slug }
                });
            }
            if(tagsToDisconnect.length){
                data.tags.disconnect = tagsToDisconnect.map(tagToDisconnect => { return { id: tagToDisconnect }});
            }

        }// else, no changes to tags

        // console.log('data variables', data);

        // 3. run the update method
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
        const ownsItem = item.user.id === ctx.req.userId;
        const hasPermissions = ctx.req.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error('You don\'t have permission to do that.')
        }
        // 3. delete item
        const deleted = ctx.db.mutation.deleteItem({ where }, info);

        // 4. delete all the votes that were made on this item
        // solved with onDelete on datamodel

        return deleted;
    },
    */

    async signup(parent, args, ctx, info){
        // lowercase the email
        args.email = args.email.toLowerCase();
        // hash the password
        const password = await bcrypt.hash(args.password, 10);
        const user = await ctx.db.mutation.createUser({
            data: {
                email: args.email,
                password: password,
                permissions: { set: ['USER'] },
            }
        }, info);
        //create the JWT token for them
        const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
        // we set the jwt as a cookie on the response
        console.log('token', token)
        
        ctx.res.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        //finally we return the user to the browser
        return user;
    },

    /*

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
        if(args.password !== args.confirmPassword) throw new Error('Passwords didn\'t match.');
        // 2. check if it's a legit resettoken
        const [user] = await ctx.db.query.users({ 
            where: { 
                resetToken: args.resetToken,
                resetTokenExpiry_gte: Date.now() - 3600000,
            } 
        });
        if(!user) throw new Error('The resettoken is invalid or has expired.');
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
        if(!ctx.req.userId) throw new Error('Must be logged in!');
        // 2. query current user
        const currentUser = await ctx.db.query.user({
            where: { id: ctx.req.userId } 
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
        const userId = ctx.req.userId;
        if(!userId) throw new Error('You must be logged in');

        // 2. do they have votes left? TODO
        if(ctx.req.user.votes.length >= 10) throw new Error('You have no votes left');

        // 3. only one vote per item!!
        const itemInVotes = ctx.req.user.votes.filter(vote => vote.item.id === args.itemId).length > 0;
        if(itemInVotes) throw new Error('You already voted for this item');

        // 4. don't allow votes in own items
        const itemInOwnItems = ctx.req.user.items.filter(item => item.id === args.itemId).length > 0;
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
        const userId = ctx.req.userId;
        if(!userId) throw new Error('You must be logged in');

        // 2. did they actually vote on this item?
        // find out if the the voteId is also in my votes
        const voteInMyVotes = ctx.req.user.votes.filter(vote => vote.id === args.voteId);
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
    },*/

};

module.exports = Mutations;
