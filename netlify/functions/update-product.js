// netlify/functions/update-product.js
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

    if (event.httpMethod !== 'PUT') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const productId = event.path.split('/').pop();
    
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
        const { name, description, category, price, stock, imageData, imageName, imageType, active } = JSON.parse(event.body);

        const client = await pool.connect();
        
        // Build dynamic update query based on provided fields
        const updateFields = [];
        const queryParams = [];
        let paramCount = 1;

        if (name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            queryParams.push(name);
        }
        if (description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            queryParams.push(description);
        }
        if (category !== undefined) {
            updateFields.push(`category = $${paramCount++}`);
            queryParams.push(category);
        }
        if (price !== undefined) {
            updateFields.push(`price = $${paramCount++}`);
            queryParams.push(parseFloat(price));
        }
        if (stock !== undefined) {
            updateFields.push(`stock = $${paramCount++}`);
            queryParams.push(parseInt(stock));
        }
        if (active !== undefined) {
            updateFields.push(`active = $${paramCount++}`);
            queryParams.push(active);
        }

        // Handle image update
        if (imageData) {
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            updateFields.push(`image_data = $${paramCount++}`);
            queryParams.push(imageBuffer);
            updateFields.push(`image_name = $${paramCount++}`);
            queryParams.push(imageName);
            updateFields.push(`image_type = $${paramCount++}`);
            queryParams.push(imageType);
        }

        if (updateFields.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No fields to update' })
            };
        }

        queryParams.push(productId);
        
        const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        
        const result = await client.query(query, queryParams);
        client.release();

        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Product not found' })
            };
        }

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
            updatedAt: product.updated_at
        };

        return {
            statusCode: 200,
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
                error: 'Failed to update product',
                details: error.message 
            })
        };
    } finally {
        await pool.end();
    }
};