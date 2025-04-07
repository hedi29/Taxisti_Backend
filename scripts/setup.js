// scripts/setup.js
const { pgPool } = require('../libs/models');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  console.log('Setting up database...');
  
  try {
    const client = await pgPool.connect();
    
    // Read SQL schema file
    const sql = fs.readFileSync(path.join(__dirname, '../database-schema.sql'), 'utf8');
    
    // Execute SQL
    await client.query(sql);
    
    console.log('Database setup completed successfully!');
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error setting up database:', err);
    process.exit(1);
  }
}

setupDatabase();