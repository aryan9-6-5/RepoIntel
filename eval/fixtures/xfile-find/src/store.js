// Returns the user with this id, or null when there is none.
function findUser(users, id) {
  return users.find((u) => u.id === id) || null;
}

module.exports = { findUser };
