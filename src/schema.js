const { gql } = require('apollo-server-express');

const schema = gql`
    type Tag {
        id: ID!
        name: String!
        slug: String!
    }
    type Mutation{
        createTag(name: String!, slug: String!): Tag!
    }
    type Query{
        tag(name: String!): Tag
    }
`;

module.exports = schema;