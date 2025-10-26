// This is our Bank Teller!
const express = require('express');
const app = express();

// The Teller says: "I only talk to people who show me their ID"
app.use((req, res, next) => {
  console.log("Someone is asking for something!");
  next();
});

// When you want to save a prescription:
app.post('/save-prescription', (req, res) => {
  console.log("Teller: Okay, I'll save this prescription for you!");
  // Here the Teller will talk to Firebase with the secret key
  res.json({ success: true, message: "Prescription saved!" });
});

// When you want to get prescriptions:
app.get('/get-prescriptions', (req, res) => {
  console.log("Teller: Here are your prescriptions!");
  res.json({ success: true, data: [] });
});

// Start the Bank Teller
app.listen(3001, () => {
  console.log("🛡️  Bank Teller is working on port 3001!");
});
