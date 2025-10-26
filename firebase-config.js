// firebase-config.js - ENHANCED VERSION
let firebaseConfig = null;
let isFirebaseInitialized = false;

// Your Render backend URL
const BACKEND_URL = 'https://lens-prescription-backend.onrender.com';

// Development config fallback
const devConfig = {
  apiKey: "AIzaSyD0qbeB7cPxBu3IGgrLFph8xOwxdwFER7c",
  authDomain: "lensprescriptionapp-e8f48.firebaseapp.com",
  projectId: "lensprescriptionapp-e8f48",
  storageBucket: "lensprescriptionapp-e8f48.firebasestorage.app",
  messagingSenderId: "96345105670",
  appId: "1:96345105670:web:a6f3d448aa13663e92aa87"
};

async function initializeFirebase() {
  if (isFirebaseInitialized) {
    console.log('Firebase already initialized');
    return;
  }

  try {
    console.log('Initializing Firebase...');
    
    // Try to get config from backend first
    const response = await fetch(`${BACKEND_URL}/api/config`);
    
    if (response.ok) {
      firebaseConfig = await response.json();
      console.log('Loaded config from backend');
    } else {
      throw new Error('Backend config not available');
    }
    
  } catch (error) {
    console.log('Using development config:', error.message);
    firebaseConfig = devConfig;
  }

  try {
    // Initialize Firebase
    if (typeof firebase !== 'undefined') {
      const app = firebase.initializeApp(firebaseConfig);
      
      // Set global variables immediately
      window.auth = firebase.auth();
      window.db = firebase.firestore();
      
      isFirebaseInitialized = true;
      console.log('Firebase initialized successfully');
      
      // Dispatch custom event that Firebase is ready
      window.dispatchEvent(new CustomEvent('firebase-ready', {
        detail: { auth: window.auth, db: window.db }
      }));
    } else {
      throw new Error('Firebase SDK not loaded');
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    initializeFallbackAuth();
  }
}

function initializeFallbackAuth() {
  console.log('Initializing fallback authentication...');
  
  // Create mock auth object with basic functionality
  window.auth = {
    currentUser: null,
    onAuthStateChanged: (callback) => {
      // Simulate no user logged in
      setTimeout(() => callback(null), 100);
      return () => {}; // Return unsubscribe function
    },
    signInWithEmailAndPassword: (email, password) => {
      return Promise.reject(new Error('Firebase not available'));
    },
    createUserWithEmailAndPassword: (email, password) => {
      return Promise.reject(new Error('Firebase not available'));
    },
    sendPasswordResetEmail: (email) => {
      return Promise.reject(new Error('Firebase not available'));
    },
    signOut: () => Promise.resolve()
  };
  
  // Create mock firestore
  window.db = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => null }),
        set: () => Promise.resolve()
      }),
      where: () => ({
        orderBy: () => ({
          get: () => Promise.resolve({ forEach: () => {} })
        }),
        get: () => Promise.resolve({ forEach: () => {} })
      })
    })
  };
  
  console.log('Fallback authentication initialized');
}

// Initialize immediately
initializeFirebase();
