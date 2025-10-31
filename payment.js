// payment.js - Complete with all dependencies

let selectedPlan = 'yearly';
let currentUser = null;

// Initialize payment page
document.addEventListener('DOMContentLoaded', async function() {
    await initializePaymentPage();
    setupEventListeners();
});

async function initializePaymentPage() {
    try {
        // Check authentication
        currentUser = await checkAuthentication();
        if (!currentUser) {
            window.location.href = 'auth.html';
            return;
        }

        // Initialize Remote Config
        const configLoaded = await initializeRemoteConfig();
        if (!configLoaded) {
            console.warn('Remote Config failed, using defaults');
        }

        // Update user status
        updateUserStatus();
        
        // Render pricing plans
        renderPricingPlans();
        
        // Check current subscription
        await checkCurrentSubscription();
        
    } catch (error) {
        console.error('Error initializing payment page:', error);
        alert('Error loading payment page. Please refresh.');
    }
}

function checkAuthentication() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // Stop listening after first check
            if (user) {
                resolve(user);
            } else {
                resolve(null);
            }
        });
        
        // Timeout fallback
        setTimeout(() => {
            unsubscribe();
            resolve(null);
        }, 5000);
    });
}

function updateUserStatus() {
    const userStatus = document.getElementById('userStatus');
    if (userStatus && currentUser) {
        userStatus.textContent = `Logged in as ${currentUser.email}`;
    }
}

function renderPricingPlans() {
    const pricingGrid = document.getElementById('pricingGrid');
    if (!pricingGrid) return;

    // Use global variables from firebase-config.js
    const monthlyPrice = window.SUBSCRIPTION_PLANS?.MONTHLY?.amount || 99;
    const yearlyPrice = window.SUBSCRIPTION_PLANS?.YEARLY?.amount || 499;
    
    // Calculate savings for yearly plan
    const monthlyCost = monthlyPrice * 12;
    const savings = monthlyCost - yearlyPrice;
    const savingsPercentage = Math.round((savings / monthlyCost) * 100);

    pricingGrid.innerHTML = `
        <!-- Monthly Plan -->
        <div class="plan-card" onclick="selectPlan('monthly')">
            <div class="plan-header">
                <h3 class="plan-name">Monthly Plan</h3>
                <div class="plan-price">
                    <div class="price-amount">₹${monthlyPrice}</div>
                    <div class="price-period">per month</div>
                </div>
            </div>
            <ul class="plan-features">
                <li>Unlimited Prescriptions</li>
                <li>All Premium Features</li>
                <li>Priority Email Support</li>
                <li>Cancel Anytime</li>
            </ul>
            <button class="plan-button" onclick="event.stopPropagation(); proceedToPayment('monthly')">
                <i class="fas fa-credit-card"></i>
                Choose Monthly
            </button>
        </div>

        <!-- Yearly Plan -->
        <div class="plan-card featured" onclick="selectPlan('yearly')">
            <div class="plan-badge">Most Popular</div>
            <div class="plan-header">
                <h3 class="plan-name">Yearly Plan</h3>
                <div class="plan-price">
                    <div class="price-amount">₹${yearlyPrice}</div>
                    <div class="price-period">per year</div>
                    <div class="price-savings">Save ${savingsPercentage}%</div>
                </div>
            </div>
            <ul class="plan-features">
                <li>Unlimited Prescriptions</li>
                <li>All Premium Features</li>
                <li>Priority Email & Phone Support</li>
                <li>Best Value - Save ${savingsPercentage}%</li>
            </ul>
            <button class="plan-button" onclick="event.stopPropagation(); proceedToPayment('yearly')">
                <i class="fas fa-crown"></i>
                Choose Yearly
            </button>
        </div>
    `;

    // Select yearly plan by default
    selectPlan('yearly');
}

function selectPlan(planType) {
    selectedPlan = planType;
    
    // Update UI
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('featured');
    });
    
    document.querySelectorAll('.plan-card').forEach(card => {
        const button = card.querySelector('.plan-button');
        if (button.textContent.includes(planType === 'yearly' ? 'Yearly' : 'Monthly')) {
            card.classList.add('featured');
        }
    });
}

async function proceedToPayment(planType = selectedPlan) {
    // Use global RAZORPAY_KEY_ID from firebase-config.js
    const razorpayKey = window.RAZORPAY_KEY_ID;
    
    if (!razorpayKey || razorpayKey === 'DISABLED') {
        alert('Payment system is currently unavailable. Please try again later.');
        return;
    }

    const plans = window.SUBSCRIPTION_PLANS;
    const plan = plans?.[planType.toUpperCase()];
    
    if (!plan) {
        alert('Invalid plan selected.');
        return;
    }

    showLoading(true);

    try {
        const options = {
            key: razorpayKey,
            amount: plan.amount * 100, // Convert to paise
            currency: 'INR',
            name: 'Lens Prescription',
            description: `${planType.charAt(0).toUpperCase() + planType.slice(1)} Subscription`,
            handler: async function(response) {
                await handlePaymentSuccess(response, planType, plan.amount);
            },
            prefill: {
                name: currentUser.displayName || '',
                email: currentUser.email,
                contact: '' // You can add phone if available
            },
            theme: {
                color: '#1e3a8a'
            },
            modal: {
                ondismiss: function() {
                    showLoading(false);
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
        showLoading(false);
    }
}

async function handlePaymentSuccess(paymentResponse, planType, amount) {
    showLoading(true);

    try {
        // Calculate expiry date
        const now = new Date();
        const plan = window.SUBSCRIPTION_PLANS[planType.toUpperCase()];
        const expiryDate = new Date(now.getTime() + plan.duration * 24 * 60 * 60 * 1000);

        // Save subscription to Firestore
        await db.collection('subscriptions').doc(currentUser.uid).set({
            userId: currentUser.uid,
            plan: planType,
            amount: amount,
            paymentId: paymentResponse.razorpay_payment_id,
            orderId: paymentResponse.razorpay_order_id,
            signature: paymentResponse.razorpay_signature,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            expiryDate: expiryDate,
            status: 'active'
        }, { merge: true });

        // Show success message
        alert('🎉 Payment successful! Your subscription is now active. Redirecting to app...');
        
        // Redirect back to app
        setTimeout(() => {
            window.location.href = 'app.html';
        }, 2000);

    } catch (error) {
        console.error('Error handling payment success:', error);
        alert('❌ Payment verification failed. Please contact support with your payment ID.');
        showLoading(false);
    }
}

async function checkCurrentSubscription() {
    try {
        const subscription = await checkActiveSubscription(currentUser.uid);
        if (subscription.active) {
            // User already has active subscription
            const expiryDate = subscription.expiryDate.toLocaleDateString();
            const result = confirm(`You already have an active ${subscription.plan} subscription until ${expiryDate}. Would you like to go back to the app?`);
            
            if (result) {
                window.location.href = 'app.html';
            }
        }
    } catch (error) {
        console.warn('Error checking subscription:', error);
    }
}

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function setupEventListeners() {
    // Update free limit count
    const freeLimitCount = document.getElementById('freeLimitCount');
    if (freeLimitCount) {
        const freeLimit = window.FREE_PRESCRIPTION_LIMIT || 10;
        freeLimitCount.textContent = freeLimit;
    }
}

// Firebase subscription check function (required by payment.js)
async function checkActiveSubscription(userId) {
    try {
        const subscriptionDoc = await db.collection('subscriptions')
            .doc(userId)
            .get();

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
        console.warn('Error checking subscription:', error);
        return { active: false };
    }
}

// Make functions globally available
window.selectPlan = selectPlan;
window.proceedToPayment = proceedToPayment;
window.checkActiveSubscription = checkActiveSubscription;
