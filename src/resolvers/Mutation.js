const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');

const Mutations = {

    async createItem(parent, args, ctx, info){
        // check if they are logged in
        if(!ctx.request.userId) throw new Error('You must be logged in to do that!');

        // handle location
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
                locationArgs = {
                    create: {
                        name: args.locationName,
                        country: { connect: { name: "Belgium" }}
                    }
                }
            }
        }

        // takes [tag] and returns [{id: tag}]!
        const selectedTags = args.tags.map(tag => { return { id: tag }});
        const item = await ctx.db.mutation.createItem({
            data: {
                image: args.image,
                largeImage: args.largeImage,
                // this is how we create a relationship between the item and the user
                user: { connect: { id: ctx.request.userId }},
                location: locationArgs,
                tags: { connect: selectedTags },
            }
        }, info);

        // after creating the item, update the itemCount of the location
        const locationUpdate = await ctx.db.mutation.updateLocation({
            where: { id: item.location.id },
            data: { itemCount: item.location.items.length }
        });

        return item;

    },

    async createTag(parent, args, ctx, info){
        // only logged in people can create tags
        //if(!ctx.request.userId) throw new Error('You must be logged in to do this');
        const tag = await ctx.db.mutation.createTag({
            data: {
                name: args.name,
            },
        }, info);
        return tag;
    },

    async createCountry(parent, args, ctx, info){
        const country = await ctx.db.mutation.createCountry({
            data: {
                name: args.name,
            }
        }, info);
        return country;
    },

    async createLocation(parent, args, ctx, info){
        const location = await ctx.db.mutation.createLocation({
            data: {
                name: args.name,
                country: {
                    connect: {
                        id: args.country
                    }
                },
            }
        }, info);
        return location;
    },

    async updateItem(parent, args, ctx, info){

        //console.log('update args', args);

        // construct the data variable
        let data = {};

        // handle location (1)
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
                    data.location = {
                        create: {
                            name: args.locationName,
                            country: { connect: { name: "Belgium" }}
                        }
                    }
                }
            }          
        }

        //console.log('variable data', data);

        // if there are tag(s) (meaning it changed), add the tag(s)
        if(args.tags){
            data.tags = {
                set: args.tags.map(tag => { return { id: tag }}),
            }
        }

        // run the update method
        const item = await ctx.db.mutation.updateItem({
            data: data,
            where: {
                id: args.id
            }
        }, info );

        // handle location (part 2) (handle it after the mutation)
        // if the location changed, we need to update the itemCount on Location for the previous and the new locations
        if(args.location){

            // query old location
            const oldLocation = await ctx.db.query.location({
                where: {id: args.oldLocationId}
            }, `{ items { id } }`);

            // then update oldLocation itemCount
            const updatedOldLocation = await ctx.db.mutation.updateLocation({
                where: { id: args.oldLocationId },
                data: { itemCount: oldLocation.items.length }
            }, `{ id }`);

            // query new location
            const newLocation = await ctx.db.query.location({
                where: {id: args.location}
            }, `{ items { id } }`);

            // then update newLocation itemCount
            const updatedNewLocation = await ctx.db.mutation.updateLocation({
                where: { id: args.location },
                data: { itemCount: newLocation.items.length }
            }, `{ id }`);

        }

        // console.log('newLocation?', item);

        return item;

    },

    async deleteItem(parent, args, ctx, info){
        const where = { id: args.id };
        // 1. find the item
        const item = await ctx.db.query.item({ where }, `{ id user { id }}`)
        // 2. check if they own item or have permissions
        // do they own it or do they have the permission
        const ownsItem = item.user.id === ctx.request.userId;
        const hasPermissions = ctx.request.user.permissions.some(permission => ['ADMIN', 'ITEM_DELETE'].includes(permission));
        if(!ownsItem && !hasPermissions){
            throw new Error('You don\'t have permission to do that.')
        }
        // 3. delete item
        return ctx.db.mutation.deleteItem({ where }, info);
    },

    async signup(parent, args, ctx, info){
        // lowercase the email
        args.email = args.email.toLowerCase();
        // hash the password
        const password = await bcrypt.hash(args.password, 10);
        const user = await ctx.db.mutation.createUser({
            data: {
                name: args.name,
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

    async signin(parent, {email, password}, ctx, info){
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

    signout(parent, args, ctx, info){
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

    async addToCart(parent, args, ctx, info){
        // 1. are they logged in
        const userId = ctx.request.userId;
        if(!userId) throw new Error('You must be logged in');
        // 2. query users current cart
        const [existingCartItem] = await ctx.db.query.cartItems({
            where: {
                user: { id: userId },
                item: { id: args.id },
            }
        });
        // 3. check if the item is already in the cart
        // 4. increment by 1 if it is
        if(existingCartItem){
            return ctx.db.mutation.updateCartItem({
                where: { id: existingCartItem.id },
                data: { quantity: existingCartItem.quantity + 1 },
            }, info)
        }
        // 5. if not, create fresh cart item
        return ctx.db.mutation.createCartItem({
            data: {
                user: { connect: { id: userId } },
                item: { connect: { id: args.id } },
            }
        }, info)
    },

    async removeFromCart(parent, args, ctx, info){
        // 1. find cartItem
        const cartItem = await ctx.db.query.cartItem({
            where: { id: args.id }
        }, `{ id, user { id } }`);
        // 1.5 make sure we found an item
        if(!cartItem) throw new Error('No cartitem found');
        // 2. do they own cartItem
        if(cartItem.user.id !== ctx.request.userId) throw new Error('You don\'t own this item');
        // 3. delete cartItem
        return ctx.db.mutation.deleteCartItem({
            where: { id: args.id },
        }, info)
    },

};

module.exports = Mutations;
