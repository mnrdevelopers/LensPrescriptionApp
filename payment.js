// payment.js - Subscription and Payment Management with Razorpay

let userSubscription = null;
let prescriptionCount = 0;

// Razorpay configuration
const RAZORPAY_CONFIG = {
    key: "9Ub53bGT9y9KHiOzyf9q9BVz", // Replace with your Razorpay test key
    theme: {
        color: "#667eea"
    }
};

// Initialize payment system
function initializePaymentSystem() {
    checkUserSubscription();
    trackPrescriptionUsage();
}

// Check user subscription status
async function checkUserSubscription() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Check if user is in free trial period (first 30 days)
        const userCreationTime = user.metadata.creationTime;
        const trialEndDate = new Date(new Date(userCreationTime).getTime() + 30 * 24 * 60 * 60 * 1000);
        const isTrialActive = new Date() < trialEndDate;

        if (isTrialActive) {
            userSubscription = {
                plan: 'trial',
                status: 'active',
                end_date: trialEndDate.toISOString(),
                prescriptions_used: 0,
                prescription_limit: 50 // Trial limit
            };
            updateSubscriptionUI();
            return;
        }

        // Check paid subscription in Firestore
        const subscriptionDoc = await db.collection('subscriptions').doc(user.uid).get();
        
        if (subscriptionDoc.exists) {
            const subscriptionData = subscriptionDoc.data();
            const subscriptionEndDate = new Date(subscriptionData.end_date);
            const isSubscriptionActive = new Date() < subscriptionEndDate;

            if (isSubscriptionActive) {
                userSubscription = {
                    ...subscriptionData,
                    status: 'active',
                    prescriptions_used: subscriptionData.prescriptions_used || 0
                };
            } else {
                userSubscription = {
                    status: 'expired',
                    plan: subscriptionData.plan
                };
            }
        } else {
            // No subscription found - trial expired
            userSubscription = {
                status: 'expired',
                plan: null
            };
        }

        updateSubscriptionUI();
        
    } catch (error) {
        console.error('Error checking subscription:', error);
        userSubscription = { status: 'error' };
    }
}

// Track prescription usage
function trackPrescriptionUsage() {
    const user = auth.currentUser;
    if (!user) return;

    // Count prescriptions for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    db.collection('prescriptions')
        .where('userId', '==', user.uid)
        .where('createdAt', '>=', startOfMonth)
        .get()
        .then(snapshot => {
            prescriptionCount = snapshot.size;
            updateUsageUI();
        })
        .catch(error => {
            console.error('Error counting prescriptions:', error);
        });
}

// Update subscription status in UI
function updateSubscriptionUI() {
    const subscriptionStatus = document.getElementById('subscriptionStatus');
    const subscriptionStatusMobile = document.getElementById('subscriptionStatusMobile');
    const upgradeButton = document.getElementById('upgradeButton');
    const upgradeButtonMobile = document.getElementById('upgradeButtonMobile');
    
    const elements = [subscriptionStatus, subscriptionStatusMobile];
    
    elements.forEach(element => {
        if (!element) return;

        if (userSubscription?.status === 'active') {
            if (userSubscription.plan === 'trial') {
                const daysLeft = Math.ceil((new Date(userSubscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
                element.innerHTML = `
                    <span class="badge bg-warning">
                        <i class="fas fa-star"></i> Free Trial - ${daysLeft} days left
                    </span>
                `;
            } else {
                element.innerHTML = `
                    <span class="badge bg-success">
                        <i class="fas fa-crown"></i> ${userSubscription.plan?.charAt(0).toUpperCase() + userSubscription.plan?.slice(1)} Plan
                    </span>
                `;
            }
        } else {
            element.innerHTML = `
                <span class="badge bg-danger">
                    <i class="fas fa-exclamation-triangle"></i> Subscription Required
                </span>
            `;
        }
    });

    // Show upgrade buttons if needed
    const upgradeButtons = [upgradeButton, upgradeButtonMobile];
    upgradeButtons.forEach(button => {
        if (button) {
            button.style.display = (userSubscription?.status !== 'active' || userSubscription?.plan === 'trial') ? 'block' : 'none';
        }
    });
}

// Update usage counter in UI
function updateUsageUI() {
    const usageElement = document.getElementById('prescriptionUsage');
    const usageElementMobile = document.getElementById('prescriptionUsageMobile');
    
    const elements = [usageElement, usageElementMobile];
    
    elements.forEach(element => {
        if (!element || !userSubscription) return;

        const limit = userSubscription.prescription_limit || 
                     (userSubscription.plan === 'basic' ? 100 :
                      userSubscription.plan === 'professional' ? 500 :
                      userSubscription.plan === 'trial' ? 50 : 0);

        const percentage = limit > 0 ? (prescriptionCount / limit) * 100 : 0;

        element.innerHTML = `
            <div class="usage-container">
                <small class="text-muted">Prescriptions: ${prescriptionCount}/${limit}</small>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar ${percentage > 80 ? 'bg-warning' : 'bg-success'}" 
                         style="width: ${Math.min(percentage, 100)}%">
                    </div>
                </div>
            </div>
        `;
    });
}

// Check if user can create more prescriptions
function canCreatePrescription() {
    if (!userSubscription || userSubscription.status !== 'active') {
        return false;
    }

    const limit = userSubscription.prescription_limit || 
                 (userSubscription.plan === 'basic' ? 100 :
                  userSubscription.plan === 'professional' ? 500 :
                  userSubscription.plan === 'trial' ? 50 : 0);

    return prescriptionCount < limit;
}

// Show upgrade modal when limits are reached
function showUpgradeModal(message = null) {
    const modalHTML = `
        <div class="modal-overlay" id="upgradeModal" style="display: flex;">
            <div class="modal-content large">
                <h3><i class="fas fa-crown"></i> Upgrade Your Plan</h3>
                <div class="text-center mb-4">
                    <p class="mb-3">${message || 'You need an active subscription to continue using Lens Prescription.'}</p>
                </div>
                
                <div class="pricing-options">
                    <div class="pricing-option" onclick="selectUpgradePlan('basic')">
                        <h5>Basic Plan</h5>
                        <div class="price">₹99/month</div>
                        <small>100 prescriptions per month</small>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> Digital Records</li>
                            <li><i class="fas fa-check"></i> Basic Search</li>
                            <li><i class="fas fa-check"></i> PDF Export</li>
                        </ul>
                    </div>
                    <div class="pricing-option featured" onclick="selectUpgradePlan('professional')">
                        <div class="popular-badge">MOST POPULAR</div>
                        <h5>Professional Plan</h5>
                        <div class="price">₹199/month</div>
                        <small>500 prescriptions per month</small>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> All Basic Features</li>
                            <li><i class="fas fa-check"></i> Advanced Analytics</li>
                            <li><i class="fas fa-check"></i> Thermal Printing</li>
                            <li><i class="fas fa-check"></i> WhatsApp Sharing</li>
                        </ul>
                    </div>
                    <div class="pricing-option" onclick="selectUpgradePlan('enterprise')">
                        <h5>Enterprise Plan</h5>
                        <div class="price">₹499/year</div>
                        <small>Unlimited prescriptions</small>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> All Professional Features</li>
                            <li><i class="fas fa-check"></i> Custom Reports</li>
                            <li><i class="fas fa-check"></i> Multi-User Access</li>
                            <li><i class="fas fa-check"></i> Priority Support</li>
                        </ul>
                    </div>
                </div>
                
                <div class="modal-buttons mt-4">
                    <button class="btn btn-secondary" onclick="closeUpgradeModal()">Maybe Later</button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('upgradeModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add CSS for pricing options
    const style = document.createElement('style');
    style.textContent = `
        .pricing-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .pricing-option {
            padding: 25px 20px;
            border: 2px solid #e9ecef;
            border-radius: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            background: white;
        }
        .pricing-option:hover {
            border-color: #667eea;
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .pricing-option.featured {
            border-color: #667eea;
            background: linear-gradient(135deg, #f8f9ff, #e8ecff);
            transform: scale(1.05);
        }
        .pricing-option.featured:hover {
            transform: scale(1.05) translateY(-5px);
        }
        .popular-badge {
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        .pricing-option h5 {
            margin-bottom: 15px;
            color: #333;
            font-size: 1.3rem;
        }
        .pricing-option .price {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .pricing-option small {
            color: #666;
            display: block;
            margin-bottom: 15px;
        }
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 15px 0 0 0;
            text-align: left;
        }
        .feature-list li {
            padding: 5px 0;
            color: #666;
            font-size: 0.9rem;
        }
        .feature-list li i {
            color: #28a745;
            margin-right: 8px;
        }
    `;
    document.head.appendChild(style);
}

// Close upgrade modal
function closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.remove();
}

// Select plan from upgrade modal
function selectUpgradePlan(planType) {
    closeUpgradeModal();
    initializeRazorpayPayment(planType);
}

// Initialize Razorpay payment
async function initializeRazorpayPayment(planType) {
    const user = auth.currentUser;
    if (!user) {
        showStatusMessage('Please login to continue with payment.', 'error');
        return;
    }

    const plan = getPlanDetails(planType);
    if (!plan) {
        showStatusMessage('Invalid plan selected.', 'error');
        return;
    }

    try {
        // Create order on your backend (for production) or use direct payment (for testing)
        const orderResponse = await createRazorpayOrder(plan);
        
        const options = {
            key: RAZORPAY_CONFIG.key,
            amount: plan.amount,
            currency: "INR",
            name: "Lens Prescription App",
            description: plan.description,
            image: "lenslogo.png",
            order_id: orderResponse.id,
            handler: function (response) {
                handlePaymentSuccess(response, planType);
            },
            prefill: {
                name: user.displayName || "Optometrist",
                email: user.email,
                contact: "" // You can collect phone number during signup
            },
            notes: {
                plan: planType,
                user_id: user.uid,
                plan_name: plan.name
            },
            theme: RAZORPAY_CONFIG.theme,
            modal: {
                ondismiss: function() {
                    showStatusMessage('Payment cancelled.', 'info');
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Razorpay initialization error:', error);
        showStatusMessage('Error initializing payment. Please try again.', 'error');
    }
}

// Create Razorpay order (for production - you need a backend)
async function createRazorpayOrder(plan) {
    // For testing without backend, create a mock order
    // In production, call your backend API to create a Razorpay order
    
    const mockOrder = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: plan.amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}`
    };
    
    return mockOrder;
}

// Get plan details
function getPlanDetails(planType) {
    const plans = {
        basic: {
            name: "Basic Plan",
            amount: 9900, // in paise (₹99)
            description: "Basic Plan - 100 prescriptions per month",
            duration: 30 // days
        },
        professional: {
            name: "Professional Plan", 
            amount: 19900, // in paise (₹199)
            description: "Professional Plan - 500 prescriptions per month",
            duration: 30 // days
        },
        enterprise: {
            name: "Enterprise Plan",
            amount: 49900, // in paise (₹499)
            description: "Enterprise Plan - Unlimited prescriptions for 1 year",
            duration: 365 // days
        }
    };
    
    return plans[planType];
}

// Handle successful payment
async function handlePaymentSuccess(response, planType) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // Verify payment signature (in production, do this on your backend)
        const isPaymentValid = await verifyPaymentSignature(response);
        
        if (!isPaymentValid) {
            showStatusMessage('Payment verification failed. Please contact support.', 'error');
            return;
        }

        const plan = getPlanDetails(planType);
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + plan.duration * 24 * 60 * 60 * 1000);

        // Save subscription to Firestore
        const subscriptionData = {
            plan: planType,
            plan_name: plan.name,
            amount: plan.amount / 100, // Convert back to rupees
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            prescriptions_used: 0,
            prescription_limit: planType === 'basic' ? 100 : 
                              planType === 'professional' ? 500 : 
                              'unlimited',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('subscriptions').doc(user.uid).set(subscriptionData);
        
        // Update local subscription state
        userSubscription = {
            ...subscriptionData,
            status: 'active'
        };
        
        updateSubscriptionUI();
        
        showStatusMessage(`🎉 Payment successful! Your ${plan.name} is now active.`, 'success');
        
        // Refresh prescription count
        trackPrescriptionUsage();

    } catch (error) {
        console.error('Error processing payment:', error);
        showStatusMessage('Payment successful but there was an error activating your subscription. Please contact support.', 'error');
    }
}

// Verify payment signature (for production - should be done on backend)
async function verifyPaymentSignature(response) {
    // In production, call your backend to verify the signature
    // For testing purposes, we'll return true
    // NEVER do signature verification on frontend in production
    
    try {
        // Mock verification - replace with actual backend call
        const verificationResponse = await mockBackendVerification(response);
        return verificationResponse.success;
    } catch (error) {
        console.error('Payment verification error:', error);
        return false;
    }
}

// Mock backend verification (replace with actual API call)
async function mockBackendVerification(response) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For testing, always return success
    // In production, this should call your backend to verify the signature
    return { success: true };
}

// Show status message
function showStatusMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.payment-status-message');
    existingMessages.forEach(msg => msg.remove());

    const statusMessage = document.createElement('div');
    statusMessage.className = `payment-status-message alert alert-${type}`;
    statusMessage.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        min-width: 300px;
        padding: 15px 20px;
        border-radius: 10px;
        background: ${type === 'success' ? '#28a745' : 
                     type === 'error' ? '#dc3545' : 
                     type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: white;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    statusMessage.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(statusMessage);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (statusMessage.parentNode) {
            statusMessage.remove();
        }
    }, 5000);
}

// Enhanced prescription submission with subscription check
async function submitPrescriptionWithCheck() {
    // Check subscription status
    if (!canCreatePrescription()) {
        let message = 'Your free trial has ended. ';
        if (userSubscription?.status === 'expired') {
            message += 'Please upgrade to continue creating prescriptions.';
        } else {
            message += `You've reached your monthly limit (${prescriptionCount}/${userSubscription?.prescription_limit}).`;
        }
        showUpgradeModal(message);
        return false;
    }

    // If checks pass, proceed with normal submission
    return await submitPrescription();
}

// Make functions globally available
window.initializePaymentSystem = initializePaymentSystem;
window.checkUserSubscription = checkUserSubscription;
window.canCreatePrescription = canCreatePrescription;
window.showUpgradeModal = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.selectUpgradePlan = selectUpgradePlan;
window.initializeRazorpayPayment = initializeRazorpayPayment;
window.submitPrescriptionWithCheck = submitPrescriptionWithCheck;
