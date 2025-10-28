// netlify/functions/get-imgbb-key.js
// Securely retrieves the IMG_BB_API_KEY from Netlify environment variables.

exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const apiKey = process.env.IMG_BB_API_KEY;

        if (!apiKey) {
             console.error('IMG_BB_API_KEY is not set in Netlify environment variables.');
             return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Configuration Error: Image Upload Key missing.' })
            };
        }

        // Return the API key to the client-side JavaScript
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                key: apiKey
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Failed to fetch ImgBB key',
                details: error.message 
            })
        };
    }
};
