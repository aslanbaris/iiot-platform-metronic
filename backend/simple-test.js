const { Pool } = require('pg');

// Enable debug logging
process.env.DEBUG = 'pg:*';

const pool = new Pool({
  host: '127.0.0.1', // Try explicit IP instead of localhost
  port: 5432,
  database: 'iiot_platform',
  user: 'iiot_user',
  ssl: false,
  statement_timeout: 5000,
  query_timeout: 5000,
  connectionTimeoutMillis: 5000,
});

console.log('Attempting to connect with config:', {
  host: '127.0.0.1',
  port: 5432,
  database: 'iiot_platform', 
  user: 'iiot_user',
  ssl: false
});

async function test() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    console.log('Success:', result.rows[0]);
    client.release();
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

test();