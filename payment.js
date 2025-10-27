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
            console.error('Error counting prescriptions:', error
