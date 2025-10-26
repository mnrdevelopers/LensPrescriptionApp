const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Initialize Firebase Admin
const admin = require('firebase-admin');

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Routes
app.get('/api/config', (req, res) => {
  // Return only public Firebase config (no secret keys)
  res.json({
    apiKey: "AIzaSyD0qbeB7cPxBu3IGgrLFph8xOwxdwFER7c",
    authDomain: "lensprescriptionapp-e8f48.firebaseapp.com",
    projectId: "lensprescriptionapp-e8f48",
    storageBucket: "lensprescriptionapp-e8f48.firebasestorage.app",
    messagingSenderId: "96345105670",
    appId: "1:96345105670:web:a6f3d448aa13663e92aa87"
  });
});

// Secure Image Upload Endpoint
app.post('/api/upload-image', async (req, res) => {
  try {
    const { imageData, token } = req.body;
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Upload to ImgBB using secure backend API key
    const formData = new FormData();
    formData.append("image", imageData.split(',')[1]);

    const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMG_BB_API_KEY}`, {
      method: "POST",
      body: formData
    });

    const imgbbData = await imgbbResponse.json();

    if (imgbbData.success) {
      res.json({ 
        success: true, 
        url: imgbbData.data.url,
        deleteUrl: imgbbData.data.delete_url 
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});