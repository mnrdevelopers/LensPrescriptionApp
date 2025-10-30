// api/verify-payment.js (serverless function)
const crypto = require('crypto');

export default async function handler(request, context) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { paymentId, orderId, signature, plan, amount } = await request.json();

    // Verify payment signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + '|' + paymentId)
      .digest('hex');

    if (expectedSignature === signature) {
      // Payment verification successful
      return new Response(JSON.stringify({
        success: true,
        paymentId: paymentId,
        orderId: orderId
      }), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      // Payment verification failed
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment verification failed'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}