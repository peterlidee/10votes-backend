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
    enum ItemOrderByInput {
        createdAt_ASC
        createdAt_DESC
        voteCount_ASC
        voteCount_DESC
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

    # we have to declare PageInfo, ItemIdge and AggregateItem so ItemConnection can work
    type PageInfo {
        hasNextPage: Boolean!
        hasPreviousPage: Boolean!
        startCursor: String
        endCursor: String
    }
    type ItemEdge {
        node: Item!
        cursor: String!
    }
    type AggregateItem {
        count: Int!
    }
    type ItemConnection {
        pageInfo: PageInfo!
        edges: [ItemEdge]!
        aggregate: AggregateItem!
    }


    type Mutation{
        signup(email: String!, password: String!): User!
        login(email: String!, password: String!): User!
        logout: SuccessMessage
        requestReset(email: String!): SuccessMessage
        resetPassword(resetToken: String!, password: String!, confirmPassword: String!): User!

        createItem(image: String, largeImage: String, location: String, tags: [String]!): Item!
        updateItem(id: ID!, location: String, newTagNames: [String], oldTagNames: [String], oldTagIds: [ID], voteCount: Int): Item!
        deleteItem(id: ID!): Item

        createTag(name: String!, slug: String!): Tag!
        castVote(itemId: ID!): Vote!
        deleteVote(voteId: ID!, itemId: ID!): Vote!
        
        createLocation(name: String!, countryCode: String!): Location!
    }
    type Query{
        me: User
        tag(tagSlug: String!): Tag
        #calls TagWhereInput, namesIn for exact search, nameContains for partial fit, 'tes' will yield 'test' and 'test1'
        tags(namesIn: [String!], nameContains: String): [Tag]!

        #location(where: LocationWhereUniqueInput): Location
        location(slug: String): Location
        #calls LocationWhereInput, matches nameContains or (locationSlug AND countrycode)
        locations(nameContains: String, locationSlug: String, countryCode: String): [Location]!
        
        country(countryCode: String!): Country

        # calls (where: ItemWhereUniqueInput!)
        item(itemId: ID!): Item
        #items(where: ItemWhereInput, orderBy: ItemOrderByInput, skip: Int, first: Int): [Item]!
        items(tagSlug: String, locationSlug: String, countryCode: String, orderBy: ItemOrderByInput, skip: Int, first: Int): [Item]!

        itemsConnection(tagSlug: String, locationSlug: String, countryCode: String): ItemConnection!

        # calls (where: VoteWhereInput) -> user: UserWhereInput  -> id: ID
        userVotes: [Vote]!
        # use case: get all items from current user: where: ItemWhereInput -> user: UserWhereInput -> id
        userItems: [Item]!


    }
`;

module.exports = schema;
// TODO? remove succesMessage?