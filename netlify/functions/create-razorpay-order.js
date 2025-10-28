// netlify/functions/create-razorpay-order.js
const Razorpay = require('razorpay');

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { amount, currency = 'INR', receipt } = JSON.parse(event.body);

        // Validate required fields
        if (!amount || !receipt) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Amount and receipt are required' })
            };
        }

        // Initialize Razorpay
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        // Create order
        const order = await razorpay.orders.create({
            amount: amount, // amount in the smallest currency unit (paise for INR)
            currency: currency,
            receipt: receipt,
            payment_capture: 1 // auto capture
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(order)
        };
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({ 
                error: 'Failed to create order',
                details: error.message 
            })
        };
    }
};