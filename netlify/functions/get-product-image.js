// netlify/functions/get-product-image.js
const { Pool } = require('pg');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const productId = event.queryStringParameters?.id;
    
    if (!productId) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Product ID is required' })
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
        const result = await client.query(
            'SELECT image_data, image_type, image_name FROM products WHERE id = $1',
            [productId]
        );
        client.release();

        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Product not found' })
            };
        }

        const product = result.rows[0];
        
        if (!product.image_data) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Image not found' })
            };
        }

        // Convert bytea to base64
        const imageBuffer = product.image_data;
        const base64Image = imageBuffer.toString('base64');
        const imageDataUrl = `data:${product.image_type};base64,${base64Image}`;

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageUrl: imageDataUrl,
                imageType: product.image_type,
                imageName: product.image_name
            })
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
                error: 'Failed to fetch product image',
                details: error.message 
            })
        };
    } finally {
        await pool.end();
    }
};