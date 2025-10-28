// netlify/functions/create-product.js
const { Pool } = require('pg');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
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
        const { name, description, category, price, stock, imageData, imageName, imageType, active = true } = JSON.parse(event.body);

        // Validate required fields
        if (!name || !category || !price || stock === undefined) {
            return {
                statusCode: 400,
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'Name, category, price, and stock are required' })
            };
        }

        const client = await pool.connect();
        
        let imageBuffer = null;
        if (imageData) {
            // Remove data URL prefix if present
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Data, 'base64');
        }

        const result = await client.query(
            `INSERT INTO products (name, description, category, price, stock, image_data, image_name, image_type, active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
             RETURNING id, name, description, category, price, stock, image_name, image_type, active, created_at`,
            [name, description, category, parseFloat(price), parseInt(stock), imageBuffer, imageName, imageType, active]
        );
        
        client.release();

        const product = result.rows[0];
        const productResponse = {
            id: product.id.toString(),
            name: product.name,
            description: product.description,
            category: product.category,
            price: parseFloat(product.price),
            stock: product.stock,
            imageName: product.image_name,
            imageType: product.image_type,
            active: product.active,
            createdAt: product.created_at
        };

        return {
            statusCode: 201,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productResponse)
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
                error: 'Failed to create product',
                details: error.message 
            })
        };
    } finally {
        await pool.end();
    }
};