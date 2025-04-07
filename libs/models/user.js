// libs/models/user.js
const { db } = require('./index');

const User = {
  async findById(id) {
    return db('profiles').where({ id }).first();
  },
  
  async create(user) {
    return db('profiles').insert(user).returning('*');
  },
  
  async update(id, user) {
    return db('profiles').where({ id }).update(user).returning('*');
  }
};

module.exports = User;