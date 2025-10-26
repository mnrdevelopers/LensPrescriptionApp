// build-firebase-config.js - Simple build script
const fs = require('fs');

// Get config from environment variables (GitHub Secrets)
const config = `// firebase-config.js - Auto-generated
const firebaseConfig = {
  apiKey: "${process.env.FIREBASE_API_KEY}",
  authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
  projectId: "${process.env.FIREBASE_PROJECT_ID}",
  storageBucket: "${process.env.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${process.env.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${process.env.FIREBASE_APP_ID}",
  measurementId: "${process.env.FIREBASE_MEASUREMENT_ID}"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global declarations
const auth = firebase.auth();
const db = firebase.firestore();
`;

fs.writeFileSync('firebase-config.js', config);
console.log('✅ firebase-config.js generated successfully!');
