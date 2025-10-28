// netlify/functions/create-order.js
const Razorpay = require('razorpay');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { planType, amount, currency = 'INR' } = JSON.parse(event.body);
    
    // Validate plan type
    const validPlans = ['monthly', 'yearly'];
    if (!validPlans.includes(planType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid plan type' })
      };
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const options = {
      amount: amount * 100, // amount in paise
      currency: currency,
      receipt: `receipt_${planType}_${Date.now()}`,
      notes: {
        planType: planType
      }
    };

    const order = await razorpay.orders.create(options);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      })
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create order' })
    };
  }
};
