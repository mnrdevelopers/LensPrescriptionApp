// firebase-config.js
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

// Add these global declarations
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize Remote Config
const remoteConfig = firebase.remoteConfig();

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
