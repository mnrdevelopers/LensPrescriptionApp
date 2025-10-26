// api-helper.js
class ApiHelper {
  constructor() {
    this.baseURL = 'http://localhost:3001';
  }

  async getAuthToken() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Please login first');
    return await user.getIdToken();
  }

  async request(endpoint, options = {}) {
    try {
      const token = await this.getAuthToken();
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        ...options
      };

      if (options.body) {
        config.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }
      
      return result;
    } catch (error) {
      console.error('API error:', error);
      throw error;
    }
  }

  async getProfile() {
    return this.request('/profile');
  }

  async saveProfile(profileData) {
    return this.request('/profile', {
      method: 'POST',
      body: profileData
    });
  }

  async getPrescriptions(search = '') {
    const endpoint = search ? `/prescriptions?search=${search}` : '/prescriptions';
    return this.request(endpoint);
  }

  async savePrescription(prescriptionData) {
    return this.request('/prescriptions', {
      method: 'POST',
      body: prescriptionData
    });
  }

  async deletePrescription(prescriptionId) {
    return this.request(`/prescriptions/${prescriptionId}`, {
      method: 'DELETE'
    });
  }
}

window.apiHelper = new ApiHelper();
