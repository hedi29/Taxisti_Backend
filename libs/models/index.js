// libs/models/index.js
const { Pool } = require('pg');
const knex = require('knex');

// Create PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Knex setup for query building
const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
});

module.exports = {
  pgPool,
  db,
  // Export models
  User: require('./user'),
  Driver: require('./driver'),
  Ride: require('./ride'),
  Payment: require('./payment'),
  Rating: require('./rating'),
  Notification: require('./notification')
};