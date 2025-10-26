// firebase-config-template.js - Safe template for GitHub Pages
// This file gets copied to firebase-config.js during deployment

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN", 
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase only if config is valid
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } else {
    console.warn('Firebase config not set - using placeholder');
    // Create mock Firebase objects to prevent errors
    window.auth = {
      currentUser: null,
      onAuthStateChanged: () => {},
      signOut: () => Promise.resolve()
    };
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
        }),
        add: () => Promise.resolve({ id: 'mock-id' })
      })
    };
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Set global variables safely
if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
  window.auth = firebase.auth();
  window.db = firebase.firestore();
} else {
  console.warn('Firebase not available - using mock objects');
}
