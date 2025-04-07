// scripts/migrate.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  console.log('Running database migrations...');
  
  try {
    const client = await pool.connect();
    
    try {
      // Read SQL schema file
      const schemaPath = path.join(__dirname, '..', 'database-schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute SQL
      await client.query(sql);
      
      console.log('Database migration completed successfully!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error running migrations:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();