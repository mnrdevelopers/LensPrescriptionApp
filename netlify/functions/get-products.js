// netlify/functions/get-products.js
const { Pool } = require('pg');

exports.handler = async function(event, context) {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
    };

    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const pool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        const client = await pool.connect();
        
        // Get query parameters for filtering
        const { category, active = 'true' } = event.queryStringParameters || {};
        
        let query = 'SELECT id, name, description, category, price, stock, image_url, image_name, image_type, active, created_at FROM products';
        let queryParams = [];
        let conditions = [];
        
        // Add conditions based on query parameters
        if (active !== undefined) {
            conditions.push(`active = $${conditions.length + 1}`);
            queryParams.push(active === 'true');
        }
        
        if (category && category !== 'all') {
            conditions.push(`category = $${conditions.length + 1}`);
            queryParams.push(category);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY created_at DESC';
        
        const result = await client.query(query, queryParams);
        client.release();
        
        const products = result.rows.map(product => ({
            id: product.id.toString(),
            name: product.name,
            description: product.description,
            category: product.category,
            price: parseFloat(product.price),
            stock: product.stock,
            imageUrl: product.image_url,
            imageName: product.image_name,
            imageType: product.image_type,
            active: product.active,
            createdAt: product.created_at
        }));
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(products)
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
        await pool.end();
    }
};