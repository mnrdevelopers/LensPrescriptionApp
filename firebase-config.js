// firebase-config.js - Updated version
let firebaseConfig = null;
let configLoaded = false;

async function initializeFirebase() {
    try {
        // Fetch config from secure backend
        const response = await fetch('http://localhost:3001/api/config');
        firebaseConfig = await response.json();
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Set global variables
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        
        configLoaded = true;
        console.log('Firebase initialized successfully with secure config');
        
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        // Fallback - you might want to show an error to the user
    }
}

// Initialize immediately
initializeFirebase();
