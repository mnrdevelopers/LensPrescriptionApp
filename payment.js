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
        showCustomDialog('Error', 'Error loading payment page. Please refresh.', 'error');
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
        console.error('Payment blocked: RAZORPAY_KEY_ID is DISABLED. Check firebase-config.js or Remote Config.');
        showCustomDialog('Payment System Unavailable', 
                         'The payment system is currently unavailable. This is likely because the Razorpay API key is disabled in the app configuration.', 
                         'warning');
        return;
    }

    const plans = window.SUBSCRIPTION_PLANS;
    const plan = plans?.[planType.toUpperCase()];
    
    if (!plan) {
        showCustomDialog('Error', 'Invalid plan selected. Please try again.', 'error');
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
                // Ensure loading is handled inside the handler, as it's an asynchronous callback
                showLoading(true); 
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
                    // This handles closing the Razorpay modal
                    showLoading(false); 
                }
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();
        
        // Hide our custom loading overlay immediately since Razorpay's overlay should take over
        showLoading(false); 
        
    } catch (error) {
        console.error('Payment error:', error);
        showCustomDialog('Payment Failed', 'Payment failed: ' + (error.message || 'An unknown error occurred.'), 'error');
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
        // 🛑 IMPORTANT: Ensure 'db' is available from firebase-config.js (it is global)
        await db.collection('subscriptions').doc(currentUser.uid).set({
            userId: currentUser.uid,
            plan: planType,
            amount: amount,
            paymentId: paymentResponse.razorpay_payment_id,
            orderId: paymentResponse.razorpay_order_id,
            signature: paymentResponse.razorpay_signature,
            // Use compatible firebase field value from the global object
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(), 
            expiryDate: expiryDate,
            status: 'active'
        }, { merge: true });

        // Show success message
        showCustomDialog('Success!', 'Payment successful! Your subscription is now active. Redirecting to app...', 'success', () => {
            // Redirect back to app
            window.location.href = 'app.html';
        });
        
    } catch (error) {
        console.error('Error handling payment success:', error);
        showCustomDialog('Verification Failed', 'Payment verification failed. Please contact support with your payment ID.', 'error');
        showLoading(false);
    }
}

async function checkCurrentSubscription() {
    try {
        const subscription = await checkActiveSubscription(currentUser.uid);
        if (subscription.active) {
            // User already has active subscription
            const expiryDate = subscription.expiryDate.toLocaleDateString();
            
            // Show confirmation dialog (replaces confirm())
            showCustomDialog(
                'Active Subscription Found',
                `You already have an active ${subscription.plan} subscription until ${expiryDate}. Would you like to go back to the app?`,
                'info', 
                () => {
                    // Confirmed action (Go back to app)
                    window.location.href = 'app.html';
                },
                true // Show cancel button
            );
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

/**
 * Custom dialog function to replace alert/confirm.
 * @param {string} title - Title of the dialog.
 * @param {string} message - Message body.
 * @param {('success'|'error'|'warning'|'info')} type - Type of message for styling.
 * @param {function} [onConfirm=()=>{}] - Callback for the confirm button.
 * @param {boolean} [showCancel=false] - Whether to show the cancel button.
 */
function showCustomDialog(title, message, type = 'info', onConfirm = () => {}, showCancel = false) {
    const modal = document.getElementById('customDialogModal');
    const icon = document.getElementById('dialogIcon');
    const titleEl = document.getElementById('dialogTitle');
    const messageEl = document.getElementById('dialogMessage');
    const confirmBtn = document.getElementById('dialogConfirmBtn');
    const cancelBtn = document.getElementById('dialogCancelBtn');

    if (!modal || !icon || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
        // Fallback logging if modal elements are missing
        console.error(`[Dialog Fallback] ${title}: ${message}`);
        return;
    }

    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;

    // Determine icon and color
    let iconClass = 'fas fa-info-circle';
    let iconColor = '#1e3a8a';
    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle';
            iconColor = '#10b981'; // success-color
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle';
            iconColor = '#ef4444'; // error-color
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle';
            iconColor = '#f59e0b'; // warning-color
            break;
    }
    icon.className = iconClass + ' fa-2x mb-3';
    icon.style.color = iconColor;

    // Setup buttons
    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm(); // Execute the callback
    };

    if (showCancel) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
        };
        confirmBtn.textContent = 'Yes';
    } else {
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = 'OK';
    }

    // Show modal
    modal.style.display = 'flex';
}


// Firebase subscription check function (required by payment.js)
async function checkActiveSubscription(userId) {
    try {
        // 🛑 IMPORTANT: Ensure 'db' is available from firebase-config.js (it is global)
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
        console.warn('Error checking subscription (Database/Network Issue):', error);
        // Fallback return: Assume not active on error
        return { active: false };
    }
}

// Make functions globally available
window.selectPlan = selectPlan;
window.proceedToPayment = proceedToPayment;
window.checkActiveSubscription = checkActiveSubscription;
window.showCustomDialog = showCustomDialog; // Export dialog function
