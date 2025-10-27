// payment.js - Subscription and Payment Management

let userSubscription = null;
let prescriptionCount = 0;

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
    const upgradeButton = document.getElementById('upgradeButton');
    
    if (!subscriptionStatus) return;

    if (userSubscription?.status === 'active') {
        if (userSubscription.plan === 'trial') {
            const daysLeft = Math.ceil((new Date(userSubscription.end_date) - new Date()) / (1000 * 60 * 60 * 24));
            subscriptionStatus.innerHTML = `
                <span class="badge bg-warning">
                    <i class="fas fa-star"></i> Free Trial - ${daysLeft} days left
                </span>
            `;
        } else {
            subscriptionStatus.innerHTML = `
                <span class="badge bg-success">
                    <i class="fas fa-crown"></i> ${userSubscription.plan?.charAt(0).toUpperCase() + userSubscription.plan?.slice(1)} Plan
                </span>
            `;
        }
        
        if (upgradeButton) {
            upgradeButton.style.display = 'inline-block';
        }
    } else {
        subscriptionStatus.innerHTML = `
            <span class="badge bg-danger">
                <i class="fas fa-exclamation-triangle"></i> Subscription Required
            </span>
        `;
        
        if (upgradeButton) {
            upgradeButton.style.display = 'inline-block';
        }
        
        // Show upgrade modal if trying to use premium features
        showUpgradeModal();
    }
}

// Update usage counter in UI
function updateUsageUI() {
    const usageElement = document.getElementById('prescriptionUsage');
    if (!usageElement || !userSubscription) return;

    const limit = userSubscription.prescription_limit || 
                 (userSubscription.plan === 'basic' ? 100 :
                  userSubscription.plan === 'professional' ? 500 :
                  userSubscription.plan === 'trial' ? 50 : 0);

    const percentage = limit > 0 ? (prescriptionCount / limit) * 100 : 0;

    usageElement.innerHTML = `
        <div class="usage-container">
            <small class="text-muted">Prescriptions this month: ${prescriptionCount}/${limit}</small>
            <div class="progress" style="height: 6px;">
                <div class="progress-bar ${percentage > 80 ? 'bg-warning' : 'bg-success'}" 
                     style="width: ${Math.min(percentage, 100)}%">
                </div>
            </div>
        </div>
    `;
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
                <h3>Upgrade Your Plan</h3>
                <div class="text-center mb-4">
                    <i class="fas fa-crown fa-3x text-warning mb-3"></i>
                    <p class="mb-3">${message || 'You need an active subscription to continue using Lens Prescription.'}</p>
                </div>
                
                <div class="pricing-options">
                    <div class="pricing-option" onclick="selectUpgradePlan('basic')">
                        <h5>Basic Plan</h5>
                        <div class="price">₹99/month</div>
                        <small>100 prescriptions</small>
                    </div>
                    <div class="pricing-option featured" onclick="selectUpgradePlan('professional')">
                        <h5>Professional Plan</h5>
                        <div class="price">₹199/month</div>
                        <small>500 prescriptions</small>
                    </div>
                    <div class="pricing-option" onclick="selectUpgradePlan('enterprise')">
                        <h5>Enterprise Plan</h5>
                        <div class="price">₹499/year</div>
                        <small>Unlimited prescriptions</small>
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
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .pricing-option {
            padding: 20px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .pricing-option:hover {
            border-color: #667eea;
            transform: translateY(-2px);
        }
        .pricing-option.featured {
            border-color: #667eea;
            background: #f8f9ff;
        }
        .pricing-option h5 {
            margin-bottom: 10px;
            color: #333;
        }
        .pricing-option .price {
            font-size: 1.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }
        .pricing-option small {
            color: #666;
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
    
    // Redirect to payment page or show payment modal
    if (typeof showPaymentModal === 'function') {
        showPaymentModal(planType);
    } else {
        // Fallback: redirect to landing page
        sessionStorage.setItem('selectedPlan', planType);
        window.location.href = 'index.html#pricing';
    }
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

// Update app.js to use the enhanced submission
function initializeAppWithPayments() {
    // Original initialization
    initializeApp();
    
    // Payment system initialization
    initializePaymentSystem();
}

// Make functions globally available
window.initializePaymentSystem = initializePaymentSystem;
window.checkUserSubscription = checkUserSubscription;
window.canCreatePrescription = canCreatePrescription;
window.showUpgradeModal = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.selectUpgradePlan = selectUpgradePlan;
window.submitPrescriptionWithCheck = submitPrescriptionWithCheck;
[file content end]
