const { gql } = require('apollo-server-express');

const schema = gql`
    type Tag {
        id: ID!
        name: String!
        slug: String!
    }
    type Mutation{
        apolloCreateTag(name: String!, slug: String!): Tag!
    }
    type Query{
        apolloTag(name: String!): Tag
    }
`;

module.exports = schema;