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

// Global variables that will be updated from Remote Config
let RAZORPAY_KEY_ID = "DISABLED";
let IMGBB_API_KEY = "DISABLED";

// Subscription constants (will be updated from Remote Config)
let SUBSCRIPTION_PLANS = {
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
    const imgbbApiKey = remoteConfig.getString('imgbb_api_key');
    const freeLimit = remoteConfig.getValue('free_prescription_limit').asNumber();
    const monthlyPrice = remoteConfig.getValue('monthly_plan_price').asNumber();
    const yearlyPrice = remoteConfig.getValue('yearly_plan_price').asNumber();
    
    // Update global variables
    RAZORPAY_KEY_ID = razorpayKeyId;
    IMGBB_API_KEY = imgbbApiKey;
    FREE_PRESCRIPTION_LIMIT = freeLimit;
    
    // Update subscription plans with dynamic pricing
    SUBSCRIPTION_PLANS = {
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
    console.log('- ImgBB Key:', IMGBB_API_KEY !== 'DISABLED' ? '✓ Configured' : '✗ Disabled');
    console.log('- Free Limit:', FREE_PRESCRIPTION_LIMIT);
    console.log('- Monthly Price:', monthlyPrice);
    console.log('- Yearly Price:', yearlyPrice);
    
    return true;
  } catch (error) {
    console.error('Error fetching Remote Config:', error);
    // Use default values if Remote Config fails
    RAZORPAY_KEY_ID = "DISABLED";
    IMGBB_API_KEY = "DISABLED";
    return false;
  }
}

// Make functions globally available
window.initializeRemoteConfig = initializeRemoteConfig;
