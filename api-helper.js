// This is how your app talks to the Bank Teller
class APIHelper {
  constructor() {
    this.tellerURL = "http://localhost:3001"; // Bank Teller's address
  }

  async talkToTeller(endpoint, data = null) {
    try {
      // Get your ID token from Firebase
      const user = firebase.auth().currentUser;
      const idToken = await user.getIdToken();
      
      const options = {
        method: data ? 'POST' : 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      // Send request to Bank Teller
      const response = await fetch(`${this.tellerURL}${endpoint}`, options);
      return await response.json();
      
    } catch (error) {
      console.error("Oops! Couldn't reach the Bank Teller:", error);
      throw error;
    }
  }

  // Simple methods to use in your app:
  async savePrescription(prescriptionData) {
    return this.talkToTeller('/save-prescription', prescriptionData);
  }

  async getPrescriptions() {
    return this.talkToTeller('/get-prescriptions');
  }

  async saveProfile(profileData) {
    return this.talkToTeller('/save-profile', profileData);
  }

  async getProfile() {
    return this.talkToTeller('/get-profile');
  }
}

// Create one helper for your whole app to use
window.apiHelper = new APIHelper();
