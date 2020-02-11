const { ApolloServer, UserInputError, gql } = require('apollo-server');
const con = require('./db');
var bcrypt = require('bcryptjs');
// The GraphQL schema
const typeDefs = gql`
  type Query {
    users: [User]
  }
  type Mutation {
      createUser(name: String!, email: String!, title: String!, password: String) :  User,
      me (email: String!, password: String!) : User
  }
  type User {
    email: String,
    name: String,
    id: ID,
    password: String,
    title: String,
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Query: {
    users: () => {
        return getUsers();
    }
  },
  Mutation: {
        me: async (parent, {email, password}) => {
            const found_data = await getUser(email, password)
            if(found_data) {
                return found_data;
            }
            console.log('throw')
            throw new UserInputError('Incorrect credentials!');
            
        },
      createUser: (parent, user) => {
        user.password = bcrypt.hashSync(user.password)
        return createUser(user);
      }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  
});
server.listen(4000).then(({ url }) => {
  console.log(`Server ready at ${url}`);
});

function getUser(email, password) {
    return new Promise((resolve, reject) => {
        con.query("SELECT * FROM users where email=?;", [email], (err, result) => {
            if (err) reject(err);
            if(result.length && bcrypt.compareSync(password, result[0].password)) {
                resolve(result[0]);
            } else {
                resolve(null)
            }
        });
    });
}
function getUsers() {
    return new Promise((resolve, reject) => {
      con.query("SELECT * FROM users;", (err, result) => {
          if (err) reject(err);
          resolve(result);
      });
    });
}

function createUser(user_data) {
    return new Promise((resolve, reject) => {
        con.query("INSERT INTO users SET ?;", user_data, (err, result) => {
            if (err) return reject(err);
            con.query("SELECT * FROM users WHERE ?;", {id: result.insertId}, (err, result) => {
                resolve(result[0])
            });
        });
    });
}