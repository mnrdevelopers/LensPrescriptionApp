// firebase-config.js - UPDATED WITH REMOTE CONFIG

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0qbeB7cPxBu3IGgrLFph8xOwxdwFER7c",
  authDomain: "lensrxbymnr.netlify.app",
  projectId: "lensprescriptionapp-e8f48",
  storageBucket: "lensprescriptionapp-e8f48.firebasestorage.app",
  messagingSenderId: "96345105670",
  appId: "1:96345105670:web:a6f3d448aa13663e92aa87",
  measurementId: "G-GS1MLHFP13"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// ── OFFLINE PERSISTENCE ─────────────────────────────────────────────────────
// Enables Firestore's built-in offline cache (multi-tab aware).
// All reads/writes work offline; changes auto-sync when reconnected.
db.enablePersistence({ synchronizeTabs: true })
  .then(() => console.log('✅ Firestore offline persistence enabled'))
  .catch(err => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs are open — persistence available in current tab only
      console.warn('⚠️ Firestore offline: multiple tabs, limited to this tab');
      db.enablePersistence().catch(() => {});
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Firestore offline: not supported in this browser');
    } else {
      console.warn('⚠️ Firestore offline persistence error:', err);
    }
  });
// ───────────────────────────────────────────────────────────────────────────

// Initialize Remote Config
let remoteConfig;
try {
  remoteConfig = firebase.remoteConfig();
  
  // Remote Config settings
  remoteConfig.settings = {
    minimumFetchIntervalMillis: 3600000, // 1 hour in milliseconds
    fetchTimeoutMillis: 60000, // 1 minute timeout
  };

  // Define default values for Remote Config
  remoteConfig.defaultConfig = {
    "razorpay_key_id": "DISABLED",
    "imagekit_public_key": "public_LensRxKey_default",
    "imagekit_url_endpoint": "https://ik.imagekit.io/lensrx",
    "imgbb_api_key": "DISABLED",
    "free_prescription_limit": "10",
    "monthly_plan_price": "99",
    "yearly_plan_price": "499"
  };
  
  console.log('Firebase Remote Config initialized successfully');
} catch (error) {
  console.warn('Firebase Remote Config not available:', error);
  remoteConfig = null;
}

// Global variables for Image Upload (ImageKit)
let RAZORPAY_KEY_ID = "DISABLED";
let IMAGEKIT_PUBLIC_KEY = "public_Tgwwux+GBV7AFMNqyNbBpMtmgEs=";
let IMAGEKIT_PRIVATE_KEY = "private_YU1b0N68qs+lTmctpHQ6mI3VY5o=";
let IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/lensrx";
let IMGBB_API_KEY = "DISABLED";

// Subscription constants (will be updated from Remote Config)
let SUBSCRIPTION_PLANS = {
  WEEKLY: {
    name: 'weekly',
    amount: 49,
    duration: 7 // days
  },
  MONTHLY: {
    name: 'monthly',
    amount: 99,
    duration: 30 // days
  },
  YEARLY: {
    name: 'yearly',
    amount: 499,
    duration: 365 // days
  }
};

let FREE_PRESCRIPTION_LIMIT = 10;

// Remote Config Management Function
async function initializeRemoteConfig() {
  if (!remoteConfig) {
    console.warn('Remote Config not available, using default values');
    return;
  }

  try {
    console.log('Fetching Remote Config...');
    
    // Fetch and activate Remote Config
    await remoteConfig.fetchAndActivate();
    
    // Get values from Remote Config
    const razorpayKeyId = remoteConfig.getString('razorpay_key_id');
    const imagekitPublicKey = remoteConfig.getString('imagekit_public_key') || 'public_LensRxKey_default';
    const imagekitUrlEndpoint = remoteConfig.getString('imagekit_url_endpoint') || 'https://ik.imagekit.io/lensrx';
    const imgbbApiKey = remoteConfig.getString('imgbb_api_key');
    const freeLimit = remoteConfig.getValue('free_prescription_limit').asNumber();
    const weeklyPriceVal = remoteConfig.getValue('weekly_plan_price');
    const weeklyPrice = (weeklyPriceVal && weeklyPriceVal.asNumber()) ? weeklyPriceVal.asNumber() : 49;
    const monthlyPrice = remoteConfig.getValue('monthly_plan_price').asNumber() || 99;
    const yearlyPrice = remoteConfig.getValue('yearly_plan_price').asNumber() || 499;
    
    // Update global variables
    RAZORPAY_KEY_ID = razorpayKeyId;
    IMAGEKIT_PUBLIC_KEY = imagekitPublicKey;
    IMAGEKIT_URL_ENDPOINT = imagekitUrlEndpoint;
    IMGBB_API_KEY = imgbbApiKey;
    FREE_PRESCRIPTION_LIMIT = freeLimit;
    
    // Update subscription plans with dynamic pricing
    SUBSCRIPTION_PLANS = {
      WEEKLY: {
        name: 'weekly',
        amount: weeklyPrice,
        duration: 7
      },
      MONTHLY: {
        name: 'monthly',
        amount: monthlyPrice,
        duration: 30
      },
      YEARLY: {
        name: 'yearly',
        amount: yearlyPrice,
        duration: 365
      }
    };
    
    console.log('Remote Config fetched successfully:');
    console.log('- Razorpay Key:', RAZORPAY_KEY_ID !== 'DISABLED' ? '✓ Configured' : '✗ Disabled');
    console.log('- ImageKit Key:', IMAGEKIT_PUBLIC_KEY);
    console.log('- Free Limit:', FREE_PRESCRIPTION_LIMIT);
    console.log('- Weekly Price:', weeklyPrice);
    console.log('- Monthly Price:', monthlyPrice);
    console.log('- Yearly Price:', yearlyPrice);
    
    return true;
  } catch (error) {
    console.error('Error fetching Remote Config:', error);
    // Use default values if Remote Config fails
    RAZORPAY_KEY_ID = "DISABLED";
    IMAGEKIT_PUBLIC_KEY = "public_LensRxKey_default";
    IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/lensrx";
    IMGBB_API_KEY = "DISABLED";
    return false;
  }
}

// Make functions globally available
window.initializeRemoteConfig = initializeRemoteConfig;
