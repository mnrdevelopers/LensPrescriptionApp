// api-helper.js - Safe way to talk to backend
class ApiHelper {
  constructor() {
    // Use local backend during development
    this.baseURL = 'http://localhost:3001';
  }

  // Get authentication token from Firebase
  async getAuthToken() {
    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('Please login first');
      }
      return await user.getIdToken();
    } catch (error) {
      console.error('Failed to get auth token:', error);
      throw error;
    }
  }

  // Make API request to backend
  async makeRequest(endpoint, options = {}) {
    try {
      const token = await this.getAuthToken();
      
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...options
      };

      // Add body for POST/PUT requests
      if (options.body) {
        config.body = JSON.stringify(options.body);
      }

      console.log(`📡 Making request to: ${this.baseURL}${endpoint}`);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('API request failed:', error);
      
      // Show user-friendly error messages
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please check if backend is running.');
      }
      
      throw error;
    }
  }

  // ========== PROFILE METHODS ==========
  async getProfile() {
    return this.makeRequest('/profile');
  }

  async saveProfile(profileData) {
    return this.makeRequest('/profile', {
      method: 'POST',
      body: profileData
    });
  }

  // ========== PRESCRIPTION METHODS ==========
  async getPrescriptions(search = '') {
    const endpoint = search ? `/prescriptions?search=${encodeURIComponent(search)}` : '/prescriptions';
    return this.makeRequest(endpoint);
  }

  async savePrescription(prescriptionData) {
    return this.makeRequest('/prescriptions', {
      method: 'POST',
      body: prescriptionData
    });
  }

  async deletePrescription(prescriptionId) {
    return this.makeRequest(`/prescriptions/${prescriptionId}`, {
      method: 'DELETE'
    });
  }

  // ========== REPORT METHODS ==========
  async getDailyReport() {
    return this.makeRequest('/reports/daily');
  }

  async getWeeklyReport() {
    return this.makeRequest('/reports/weekly');
  }

  async getMonthlyReport() {
    return this.makeRequest('/reports/monthly');
  }

  // ========== HEALTH CHECK ==========
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return await response.json();
    } catch (error) {
      throw new Error('Backend server is not running');
    }
  }
}

// Create global instance
window.apiHelper = new ApiHelper();
