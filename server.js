const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();

// Get environment variables
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const IMG_BB_API_KEY = process.env.IMG_BB_API_KEY;

// CORS - Allow GitHub Pages and local development
const allowedOrigins = [
  'https://mnrdevelopers.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Log blocked origins for debugging
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: FIREBASE_PRIVATE_KEY,
  client_email: FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Initialize Firebase Admin with error handling
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

const db = admin.firestore();

// Routes
app.get('/api/config', (req, res) => {
  res.json({
    apiKey: "AIzaSyD0qbeB7cPxBu3IGgrLFph8xOwxdwFER7c",
    authDomain: "lensprescriptionapp-e8f48.firebaseapp.com",
    projectId: "lensprescriptionapp-e8f48",
    storageBucket: "lensprescriptionapp-e8f48.firebasestorage.app",
    messagingSenderId: "96345105670",
    appId: "1:96345105670:web:a6f3d448aa13663e92aa87"
  });
});

// Secure Image Upload
app.post('/api/upload-image', async (req, res) => {
  try {
    const { imageData, token } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Upload to ImgBB using secure backend API key
    const formData = new FormData();
    formData.append("image", imageData.split(',')[1]);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_API_KEY}`, {
      method: "POST",
      body: formData
    });

    const imgbbData = await imgbbResponse.json();

    if (imgbbData.success) {
      res.json({ 
        success: true, 
        url: imgbbData.data.url
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: imgbbData.error?.message || 'Image upload failed' 
      });
    }
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Lens Prescription Backend'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log('Allowed origins:', allowedOrigins);
});
