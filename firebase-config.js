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

// Subscription constants
const SUBSCRIPTION_PLANS = {
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

const FREE_PRESCRIPTION_LIMIT = 10;
