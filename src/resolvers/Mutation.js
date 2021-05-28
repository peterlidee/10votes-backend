const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission, removeDuplicates, makeSlug, cleanupInput } = require('../utils');

const Mutations = {

    /* ************************************************************************
    
    ITEMS

    **************************************************************************/

    async createItem(parent, args, ctx, info){
        // check if the user islogged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do that!');

        // 1. handle location
        
        const locationName = cleanupInput(args.location);
        // check if there is a location
        if(!locationName) throw new Error('You need to enter a location!');
        
        // check it the location is a new one or an already existing one
        let locationArgs;
        // does it exist?
        const locationQuery = await ctx.db.query.locations({
            where: {
                name: locationName
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
            // clean up and make a slug
            const locationSlug = makeSlug(locationName);
            locationArgs = {
                create: {
                    name: locationName,
                    slug: locationSlug,
                    country: { connect: { name: "Belgium" }}
                }
            }
        }
        
        // 2. handle tags

        // we get an array of max 3 strings
        // each item may be a new or existing tag

       const tagsArgs = {};
       
       // 1. remove possible empty value and remove duplicates
       // 2. cleanup
        const tags = removeDuplicates(args.tags).filter(tag => tag).map(tag => cleanupInput(tag));

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
                    const tagSlug = makeSlug(createTag);
                    return { name: createTag, slug: tagSlug }
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

    async updateItem(parent, args, ctx, info){
        
        // you need to be logged in
        if(!ctx.req.userId) throw new Error('You need to be logged.');

        // check if this item (args.id) is inside the users items (ctx.req.user)
        const ownsItem = ctx.req.user.items.find(item => item.id === args.id);
        // check if the user has permission to do this
        const hasPermissions = ctx.req.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error("You don't have permission to do that.")
        }        

        // construct the data variable
        let data = {};

        // 1. handle location
        const locationName = cleanupInput(args.location);
        // if there's a new location
        if(args.locationName && locationName){
            // does the new location already exist (is it in db?)
            const locationQuery = await ctx.db.query.locations({
                where: {
                    name: locationName
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
                // clean up and create slug
                const locationSlug = makeSlug(locationName)
                data.location = {
                    create: {
                        name: locationName,
                        slug: locationSlug,
                        country: { connect: { name: "Belgium" }}
                    }
                }
            }       
        }  // else, no changes were made, don't do anything
        // end handle location


        // 2. handle tags
        // only do stuff when there were changes to the tags
        if(args.newTagNames){
            const { oldTagNames } = args;
            // filter out the empty ones, then clean the value up
            const newTagNames = args.newTagNames.filter(newTagName => newTagName).map(newTagName => cleanupInput(newTagName));
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
                    const tagSlug = makeSlug(tagToCreate)
                    return { name: tagToCreate, slug: tagSlug }
                });
            }
            if(tagsToDisconnect.length){
                data.tags.disconnect = tagsToDisconnect.map(tagToDisconnect => { return { id: tagToDisconnect }});
            }

        }// else, no changes to tags

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

    /* ************************************************************************
    
    TAGS

    **************************************************************************/

    // check if tag already exists
    // if so, return said tag
    // if not, create the tag and returns it
    async createTag(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")
        
        // clean up args.name
        const tagName = cleanupInput(args.name);
        // check if it isn't empty
        if(!tagName){
            throw new Error('The tag name cannot be empty');
        }
        // does the new tag already exist (is it in db?)
        const tagQuery = await ctx.db.query.tag({
            where: { name: tagName }
        }, info);

        // if thetag exists, we don't need to create it, just return the result
        if(tagQuery){
            return tagQuery;
        // else (no results), so create a new tag
        }else{
            // create slug first
            const tagSlug = makeSlug(tagName);
            // make the mutation
            const tag = await ctx.db.mutation.createTag({
                data: {
                    name: tagName,
                    slug: tagSlug,
                }
            }, info);
            return tag;
        }
    },

    // TODO: make one input clean function for all

    async updateTag(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to update a tag.');
        
        const newTagName = cleanupInput(args.newTagName);
        if(!newTagName) throw new Error('There needs to be a new tag name.')
        if(!args.oldTagId) throw new Error('There needs to be a current tag.')

        // check if the newtag already exists
        // exists: we need to merge: remove tag from all items, add new tag to those items, delete old tag
        // !exists: update the oldTag with the newTag name + slug

        const newTagExists = await ctx.db.query.tag({
            where: { name: newTagName }
        }, info)

        if(newTagExists){
            // the tag already exists

            // check if the newTag is different from the old tag
            if(args.oldTagId == newTagExists.id) throw new Error('The tag already has this name.')

            // updateManyItems(data: ItemUpdateManyMutationInput!, where: ItemWhereInput): BatchPayload!
            // this mutation doesn't allow to batch update tags ?? weird
            // so, we need to query all the items with this tag
            // and loop over them, updating them one at a time?
            // maybe there's a better solution but I couldn't find one
            // 1. get all items
            const itemsWithTag = await ctx.db.query.items({
                where: { tags_some: { id: args.oldTagId }}
            }, `{ id }`)
            // 2. take all items with oldTag, remove oldTag and add newTag
            const items = itemsWithTag.map(async(item) => {
                await ctx.db.mutation.updateItem({
                    where: { id: item.id },
                    data: { tags: { 
                        //disconnect: { id: args.oldTagId }, 
                        // no need to disconnect, happens on delete
                        // also, causes error cause it tries to disconnect a tag that got deleted
                        connect: { id: newTagExists.id },
                    }}
                });
            })
            Promise.all(items)
                .then(
                    // 2. delete oldTag
                    await ctx.db.mutation.deleteTag({
                        where: { id: args.oldTagId }
                    }, info)
                )
                .catch(error => console.log(error))
            // 3. return the already existing tag
            return newTagExists;
        }else{ 
            // the tag doesn't already exist
            // update the name and the slug of the 'old' one
            // create slug first
            const newTagSlug = makeSlug(newTagName);
            return await ctx.db.mutation.updateTag({
                data: { name: newTagName, slug: newTagSlug },
                where: { id: args.oldTagId },
            })
        }
    },

    async deleteTag(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        if(!args.tagId) throw new Error('No tag id found.')
        const deleted = await ctx.db.mutation.deleteTag({
            where: { id: args.tagId }
        }, info);
        return deleted;
    },

    /* ************************************************************************
    
    LOCATIONS

    **************************************************************************/

    // checks location name exists
    // if so, it returns the already existing location
    // else it creates and returns a new location
    async createLocation(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        // cleanup the args.name
        const locationName = cleanupInput(args.name);
        // check if it isn't empty
        if(!locationName){
            throw new Error('The location name cannot be empty');
        }

        // does the new location already exist (is it in db?)
        const locationQuery = await ctx.db.query.locations({
            where: { name: locationName }
        }, info);

        // if the location exists, we don't need to create it, just return the result
        if(locationQuery[0]){
            return locationQuery[0];
        // else (no results), so create a new location
        }else{
            // create slug first
            const locationSlug = makeSlug(locationName);
            // make the mutation
            const location = await ctx.db.mutation.createLocation({
                data: {
                    name: locationName,
                    slug: locationSlug,
                    country: {
                        connect: {
                            countryCode: args.countryCode
                        }
                    },
                }
            }, info);
            return location;
        }  
    },

    async updateLocation(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');

        const newLocationName = cleanupInput(args.newLocationName);
        const newLocationSlug = makeSlug(newLocationName);
        if(!newLocationName) throw new Error('There needs to be a new location name.')
        if(!args.oldLocationId) throw new Error('There needs to be a current location.')

        // check if the newLocationName already exists
        // exists: we need to merge: remove location from all items, add new location to those items, delete old location
        // !exists: update the oldLocationName with the newLocation name + slug


        const newLocationExists = await ctx.db.query.location({
            where: { slug: newLocationSlug }
        }, info)

        if(newLocationExists){
            // check if the new and old locations aren't the same
            if(newLocationExists.id == args.oldLocationId) throw new Error('The new location is the same as the old.')
            // the location already exists
            // no bulk update for item locations, so we have to do it one by one
            const items = await ctx.db.query.items({
                where: { location: { id: args.oldLocationId }}
            }, `{ id }`).catch(err => console.log(error.message));
            // update items with new location
            const updatedItems = items.map(async(item) => {
                await ctx.db.mutation.updateItem({
                    where: { id: item.id },
                    data: { location: { connect: { id: newLocationExists.id }}}
                });
                return item;
            });
            Promise.all(updatedItems)
                .then(async(items) => {
                    // after the updates, delete old location
                    const deleteLocation = await ctx.db.mutation.deleteLocation({
                        where: { id: args.oldLocationId }
                    }, info)
                })
                .catch(error => console.log(error));
            return newLocationExists;
        }else{ // the location doesn't exist, we update the oldLocation with new name and slug
            return await ctx.db.mutation.updateLocation({
                where: { id: args.oldLocationId },
                data: { name: newLocationName, slug: newLocationSlug }
            }, info);
        }
    },

    async deleteLocation(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        if(!args.locationId) throw new Error('No locationID was submitted.')

        // check if there are still items connected to this location
        const items = await ctx.db.query.items({
            where: { location: { id: args.locationId }}
        }, `{ id }`)
        if(items.length > 0) throw new Error('You cannot delete a location if it still has items in it.')
        return await ctx.db.mutation.deleteLocation({
            where: { id: args.locationId }
        }, info)
    },

    /*
    async createCountry(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")
        const country = await ctx.db.mutation.createCountry({
            data: {
                name: args.name,
                countryCode: args.countryCode,
            }
        }, info);
        return country;
    },
    */

    /* ************************************************************************
    
    USERS

    **************************************************************************/

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
        //console.log('token', token)
        
        ctx.res.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
            secure: true,
            sameSite: "none",
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
        ctx.res.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        // 5. return user
        return user;
    },

    logout(parent, args, ctx, info){
        // Cookie ‘token’ is geweigerd omdat deze al is verlopen. ? TODO?
        ctx.res.clearCookie('token', { httpOnly: true, secure: true, sameSite: "none"});
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
        ctx.res.cookie('token', token, {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 365, // oneyear cookie 
        });
        // 8. return new user
        return updatedUser;
    },

    async updatePermissions(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        // update the permissions
        const permissions = ['USER'];
        if(args.admin) permissions.push('ADMIN');

        return ctx.db.mutation.updateUser({
            where: { id: args.userId },
            data: { permissions: { set: permissions }},
        }, info);
    },

    async deleteUser(parent, args, ctx, info){
        // check if logged in
        if(!ctx.req.userId) throw new Error('You must be logged in to do this');
        // check if user is admin
        const me = await ctx.db.query.user({
            where: { id: ctx.req.userId },
        }, `{ id permissions }`).catch(error => {
            console.log('There was an error', error.message) // TODO better error handling?
        });
        if(!me.permissions.includes('ADMIN')) throw new Error("You don't have the permissions to do this.")

        if(!args.userId) throw new Error('No such user found.')

        // when we delete a user, he items and votes will also get deleted
        // but, the voteCount for all the items, this user voted on, will now be wrong
        // so we will have to update those
        const user = await ctx.db.query.user({
            where: { id: args.userId }
        }, `{ id votes{ id item{ id votes{id}}}}`)
            .catch(error => console.log(error.message));

        // now, we have all the items the user voted in, we will update the voteCount of these after the user was deleted

        // delete user
        const deleteUser = await ctx.db.mutation.deleteUser({
            where: { id: args.userId }
        },info).catch(error => console.log(error.message));

        // the user was deleted, now update all the items that just lost a vote
        user.votes.map(async(vote) => {
            await ctx.db.mutation.updateItem({
                where: { id: vote.item.id },
                data: { voteCount: vote.item.votes.length }
            }).catch(error => console.log('updateItem error', error.message))
        });
        
        return deleteUser;
    },

    /* ************************************************************************
    
    VOTES

    **************************************************************************/

    async castVote(parent, args, ctx, info){
        // 1. is the user logged in?
        const userId = ctx.req.userId;
        if(!userId) throw new Error('You must be logged in');

        // 2. do they have votes left? TODO
        if(ctx.req.user.votes.length >= 10) throw new Error('You have no votes left');

        // 3. only one vote per item!!
        const itemInVotes = ctx.req.user.votes.filter(vote => vote.item.id === args.itemId).length > 0;
        if(itemInVotes) throw new Error('You already voted for this item');

        // 4. don't allow votes on own items
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
        const update = await ctx.db.mutation.updateItem({
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
    },

};

module.exports = Mutations;
