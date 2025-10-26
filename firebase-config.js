// firebase-config.js
let firebaseConfig = null;

// Your Render backend URL - UPDATE THIS!
const BACKEND_URL = 'https://lens-prescription-backend.onrender.com';

async function initializeFirebase() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/config`);
        firebaseConfig = await response.json();
        
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Set global variables
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        
        console.log('Firebase initialized with secure backend config');
        
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        // Fallback for development
        if (window.location.hostname === 'localhost') {
            console.log('Using development config');
            firebaseConfig = {
                apiKey: "AIzaSyD0qbeB7cPxBu3IGgrLFph8xOwxdwFER7c",
                authDomain: "lensprescriptionapp-e8f48.firebaseapp.com",
                projectId: "lensprescriptionapp-e8f48",
                storageBucket: "lensprescriptionapp-e8f48.firebasestorage.app",
                messagingSenderId: "96345105670",
                appId: "1:96345105670:web:a6f3d448aa13663e92aa87"
            };
            firebase.initializeApp(firebaseConfig);
            window.auth = firebase.auth();
            window.db = firebase.firestore();
        }
    }
}

initializeFirebase();
