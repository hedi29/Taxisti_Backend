// libs/models/device.js
const { db } = require('./index');

// This table needs to be created, as it's not in the original schema
// We'll create the table on first use if it doesn't exist
(async () => {
  const exists = await db.schema.hasTable('devices');
  if (!exists) {
    await db.schema.createTable('devices', (table) => {
      table.uuid('id').defaultTo(db.raw('uuid_generate_v4()')).primary();
      table.uuid('user_id').references('id').inTable('profiles').notNullable();
      table.string('token').notNullable().unique();
      table.string('device_type').notNullable();
      table.string('device_name');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  }
})();

const Device = {
  async findByUser(userId) {
    return db('devices').where({ user_id: userId });
  },
  
  async findByToken(token) {
    return db('devices').where({ token }).first();
  },
  
  async create(device) {
    return db('devices').insert(device).returning('*');
  },
  
  async update(id, device) {
    return db('devices').where({ id }).update(device).returning('*');
  },
  
  async delete(id) {
    return db('devices').where({ id }).delete();
  },
  
  async removeByToken(token) {
    return db('devices').where({ token }).delete();
  }
};

module.exports = Device;