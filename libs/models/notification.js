// libs/models/notification.js
const { db } = require('./index');

const Notification = {
  async findById(id) {
    return db('notifications').where({ id }).first();
  },
  
  async findByUser(userId) {
    return db('notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  },
  
  async create(notification) {
    return db('notifications').insert(notification).returning('*');
  },
  
  async update(id, notification) {
    return db('notifications').where({ id }).update(notification).returning('*');
  },
  
  async delete(id) {
    return db('notifications').where({ id }).delete();
  },
  
  async markAllAsRead(userId) {
    return db('notifications')
      .where({ user_id: userId, is_read: false })
      .update({ is_read: true });
  }
};

module.exports = Notification;