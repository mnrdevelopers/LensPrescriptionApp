const { Pool } = require('pg');

// Initialize PostgreSQL pool with your Neon connection
// FIX 1: Change to use the NEON_DATABASE_URL environment variable for consistency
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  let client; // Declare client outside try block

  try {
    // Connect to Neon database and fetch products
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, name, description, price, stock, category, image_name as "imageName"
      FROM products 
      WHERE stock > 0 
      ORDER BY name
    `);
    
    client.release();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result.rows)
    };

  } catch (error) {
    console.error('Database error:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch products',
        details: error.message 
      })
    };
  } finally {
    // FIX 2: Ensure the client is released back to the pool if it was successfully acquired.
    // The previous release() call inside the try block handles the success case.
    // However, if an error occurred *after* connecting but *before* releasing, it might be missed.
    // For serverless best practice, the original in-try release is often sufficient, 
    // but in case of connection failure, we ensure the process exits cleanly by ending the pool.
    await pool.end();
  }
};
