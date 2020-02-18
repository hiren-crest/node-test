const { ApolloServer, UserInputError, gql, PubSub } = require('apollo-server');
const con = require('./db');
var bcrypt = require('bcryptjs');
const pubsub = new PubSub();
// The GraphQL schema
const typeDefs = gql`
  type Query {
    users: [User]
  }

  type Mutation {
      createUser(name: String!, email: String!, title: String!, password: String, id: ID) :  User
      me (email: String!, password: String!) : User
      deleteUser(id: ID!) : String
  }

  type Subscription {
    userAdded: User!,
    userDeleted: ID!
  }

  type User {
    email: String
    name: String
    id: ID
    password: String
    title: String
  }
`;

// A map of functions which return data for the schema.
const resolvers = {
  Subscription: {
    userAdded: {
      subscribe: () => {
        return pubsub.asyncIterator(['USER_ADDED'])
      },
    },
    userDeleted: {
      subscribe: () => {
        return pubsub.asyncIterator(['USER_DELETED'])
      },
    }
  },
  Query: {
    users: (parent, args, context, info) => {
      const searched_type = info.fieldNodes.find((field_node) => field_node.name.value == 'users')
      let selected_fields = ['*']
      if(searched_type) {
        selected_fields = searched_type.selectionSet.selections.map((selection) => selection.name.value)
      }
        return getUsers(selected_fields);
    }
  },
  Mutation: {
        me: async (parent, {email, password}) => {
            const found_data = await getUser(email, password)
            if(found_data) {
                return found_data;
            }
            throw new UserInputError('Incorrect credentials!', 'email');
            
        },
      createUser: async (parent, user) => {
        if(user.password) {
          user.password = bcrypt.hashSync(user.password)
        } else {
          delete user.password
        }
        if(user.id) {
          const id = user.id
          delete user.id
          const updated_user = await updateUser(user, id);
          pubsub.publish('USER_ADDED', { userAdded: updated_user });
          return updated_user
        }
        const created_user = await createUser(user);
        pubsub.publish('USER_ADDED', { userAdded: created_user });
        return created_user
      },
      deleteUser: (parent, {id}) => {
        pubsub.publish('USER_DELETED', { userDeleted: id });
        return deleteUser(id);
      }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  
});
server.listen(4000).then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url} and subscription at ${subscriptionsUrl }`);
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
function getUsers(selected_fields) {
    return new Promise((resolve, reject) => {
      con.query(`SELECT ${selected_fields.join(',')} FROM users;`, (err, result) => {
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

function updateUser(user_data, id) {
    return new Promise((resolve, reject) => {
        con.query(`UPDATE users SET ? WHERE id= ?;`, [user_data, id], (err, result) => {
            if (err) return reject(err);
            con.query("SELECT * FROM users WHERE ?;", {id: id}, (err, result) => {
                resolve(result[0])
            });
        });
    });
}

function deleteUser(id) {
  return new Promise((resolve, reject) => {
      con.query(`DELETE FROM users WHERE id = ?;`, id, (err, result) => {
          if (err) return reject(err);
          resolve('User deleted Successfully!');
      });
  });
}