const { gql } = require('apollo-server-express');

const schema = gql`
    enum Permission{
        ADMIN
        USER
        ITEMCREATE
        ITEMUPDATE
        ITEMDELETE
        PERMISSIONUPDATE
    }
    type User {
        id: ID!
        email: String!
        password: String!
        resetToken: String
        resetTokenExpiry: Float
        permissions: [Permission]
        items: [Item]!
        votes: [Vote]!
    }
    type Item {
        id: ID!
        image: String
        largeImage: String
        user: User!
        location: Location!
        tags: [Tag]!
        votes: [Vote]!
        voteCount: Int
    }
    type Tag {
        id: ID!
        name: String!
        slug: String!
    }
    type Country {
        id: ID!
        name: String!
        countryCode: String!
    }
    type Location {
        id: ID!
        name: String!
        slug: String!
        country: Country!
        items: [Item]!
    }
    type Vote {
        id: ID!
        item: Item!
        user: User! 
    }
    type SuccessMessage{
        message: String
    }

    type Mutation{
        signup(email: String!, password: String!): User!
        login(email: String!, password: String!): User!
        logout: SuccessMessage
        requestReset(email: String!): SuccessMessage
        resetPassword(resetToken: String!, password: String!, confirmPassword: String!): User!
        createItem(image: String, largeImage: String, location: String, tags: [String]!): Item!
        createTag(name: String!, slug: String!): Tag!
    }
    type Query{
        me: User
        tag(name: String!): Tag
        
        #tags(where: TagWhereInput): [Tag]!

        #calls TagWhereInput
        tags(names: [String!]!): [Tag]!

        #location(where: LocationWhereUniqueInput): Location
        #locations(where: LocationWhereInput): [Location]!
    }
`;

module.exports = schema;
// TODO? remove succesMessage?