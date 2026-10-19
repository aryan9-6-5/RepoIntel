const { findUser } = require('./store');

function greet(users, id) {
  const user = findUser(users, id);
  return 'Hello ' + user.name;
}

module.exports = { greet };
