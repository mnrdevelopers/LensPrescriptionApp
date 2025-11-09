// Payment page JavaScript
let selectedPlan = 'yearly';
let user = null;

// Initialize payment page
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    user = await checkAuth();
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Initialize the page
    await initializePaymentPage();
});

// Check user authentication
async function checkAuth() {
    return new Promise((resolve) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                resolve(user);
            } else {
                resolve(null);
            }
        });
    });
}

// Initialize payment page
async function initializePaymentPage() {
    // Load Remote Config
    await initializeRemoteConfig();
    
    // Update plan prices
    updatePlanPrices();
    
    // Check current subscription status
    await updateCurrentPlanStatus();
    
    // Select default plan
    selectPlan('yearly');
}

// Update plan prices from Remote Config
function updatePlanPrices() {
    const monthlyPrice = SUBSCRIPTION_PLANS.MONTHLY.amount;
    const yearlyPrice = SUBSCRIPTION_PLANS.YEARLY.amount;
    
    // Update price displays
    document.getElementById('monthlyPrice').textContent = `₹${monthlyPrice}`;
    document.getElementById('yearlyPrice').textContent = `₹${yearlyPrice}`;
    
    // Calculate and display savings
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    const savingsPercentage = Math.round((savings / monthlyCost) * 100);
    
    document.getElementById('yearlySavings').textContent = `Save ${savingsPercentage}%`;
}

// Update current plan status
async function updateCurrentPlanStatus() {
    const subscription = await checkActiveSubscription(user.uid);
    const statusElement = document.getElementById('currentPlanStatus');
    
    if (subscription.active) {
        const expiryDate = subscription.expiryDate.toLocaleDateString();
        statusElement.innerHTML = `
            <i class="fas fa-crown me-2"></i>
            <strong>You are currently a Premium Member</strong> - Your subscription is active until ${expiryDate}
            <br><small>You can still upgrade or change your plan</small>
        `;
        statusElement.className = 'alert alert-success text-center mb-4';
    } else {
        statusElement.innerHTML = `
            <i class="fas fa-info-circle me-2"></i>
            <strong>You are on the Free Plan</strong> - ${FREE_PRESCRIPTION_LIMIT} prescriptions per month
            <br><small>Upgrade to unlock unlimited prescriptions and premium features</small>
        `;
        statusElement.className = 'alert alert-info text-center mb-4';
    }
}

// Select plan
function selectPlan(planType) {
    selectedPlan = planType;
    
    // Update UI
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelectorAll(`.${planType}-plan`).forEach(card => {
        card.classList.add('selected');
    });
    
    // Update radio buttons
    document.getElementById(`${planType}Plan`).checked = true;
}

// Proceed to payment
async function proceedToPayment() {
    if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'DISABLED') {
        showStatusMessage('Payment system is currently unavailable. Please try again later.', 'error');
        return;
    }

    const plan = SUBSCRIPTION_PLANS[selectedPlan.toUpperCase()];
    if (!plan) {
        showStatusMessage('Invalid plan selected.', 'error');
        return;
    }

    try {
        // Show processing modal
        document.getElementById('paymentProcessingModal').style.display = 'flex';

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: plan.amount * 100,
            currency: 'INR',
            name: 'Lens Rx',
            description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Subscription`,
            handler: async function(response) {
                await handlePaymentSuccess(response, selectedPlan, plan.amount);
            },
            prefill: {
                name: user.displayName || '',
                email: user.email
            },
            theme: {
                color: '#007bff'
            },
            modal: {
                ondismiss: function() {
                    document.getElementById('paymentProcessingModal').style.display = 'none';
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        
    } catch (error) {
        document.getElementById('paymentProcessingModal').style.display = 'none';
        showStatusMessage('Payment failed: ' + error.message, 'error');
    }
}

// Handle payment success
async function handlePaymentSuccess(paymentResponse, planType, amount) {
    try {
        const now = new Date();
        const plan = SUBSCRIPTION_PLANS[planType.toUpperCase()];
        const expiryDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

        await firebase.firestore().collection('subscriptions').doc(user.uid).set({
            userId: user.uid,
            plan: planType,
            amount: amount,
            paymentId: paymentResponse.razorpay_payment_id,
            orderId: paymentResponse.razorpay_order_id,
            signature: paymentResponse.razorpay_signature,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            expiryDate: expiryDate,
            status: 'active'
        });

        showStatusMessage('Payment successful! Your subscription is now active.', 'success');
        
        // Redirect back to app after successful payment
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 2000);

    } catch (error) {
        showStatusMessage('Payment verification failed. Please contact support.', 'error');
    }
}

// Check active subscription
async function checkActiveSubscription(userId) {
    try {
        const subscriptionDoc = await firebase.firestore().collection('subscriptions').doc(userId).get();

        if (subscriptionDoc.exists) {
            const subscription = subscriptionDoc.data();
            const now = new Date();
            
            if (subscription.expiryDate && typeof subscription.expiryDate.toDate === 'function') {
                const expiryDate = subscription.expiryDate.toDate();
                
                const isActive = expiryDate > now;
                let remainingDays = 0;
                
                if (isActive) {
                    const diffTime = expiryDate.getTime() - now.getTime();
                    remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
                
                return {
                    active: isActive,
                    plan: subscription.plan,
                    expiryDate: expiryDate,
                    remainingDays: remainingDays
                };
            }
        }

        return { active: false };
    } catch (error) {
        console.error('Error checking subscription:', error);
        return { active: false };
    }
}

// Status message function
function showStatusMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());

    const statusMessage = document.createElement('div');
    statusMessage.className = `status-message alert status-${type}`;
    statusMessage.innerHTML = `
        <i class="fas fa-${getStatusIcon(type)}"></i>
        ${message}
    `;
    statusMessage.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        min-width: 250px;
        padding: 12px 16px;
        border-radius: 8px;
        background: ${getStatusColor(type)};
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
    `;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        if (statusMessage.parentNode) {
            statusMessage.remove();
        }
    }, 4000);
}

function getStatusIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

function getStatusColor(type) {
    const colors = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    return colors[type] || '#17a2b8';
}

// Go back to app
function goBack() {
    window.location.href = 'app.html';
}

// Make functions globally available
window.selectPlan = selectPlan;
window.proceedToPayment = proceedToPayment;
window.goBack = goBack;
