const API_BASE = 'http://localhost:5000/api/v1';

class AdminApiService {
  constructor() {
    this.token = localStorage.getItem('rakna_admin_token') || null;
    this.admin = JSON.parse(localStorage.getItem('rakna_admin_user') || 'null');
  }

  setAuth(token, admin) {
    this.token = token;
    this.admin = admin;
    if (token) {
      localStorage.setItem('rakna_admin_token', token);
      localStorage.setItem('rakna_admin_user', JSON.stringify(admin));
    } else {
      localStorage.removeItem('rakna_admin_token');
      localStorage.removeItem('rakna_admin_user');
    }
  }

  logout() {
    this.setAuth(null, null);
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ أثناء الاتصال بالخادم');
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.success && data.token) {
      this.setAuth(data.token, data.admin);
    }
    return data;
  }

  // Overview KPIs
  async getStats() {
    return this.request('/admin/stats');
  }

  // Batch Tag Generator
  async generateTagsBatch(quantity, tagType, batchNumber) {
    return this.request('/admin/tags/batch', {
      method: 'POST',
      body: JSON.stringify({ quantity, tagType, batchNumber }),
    });
  }

  // List all Tags
  async listTags() {
    return this.request('/admin/tags');
  }

  // List Orders & update status
  async listOrders() {
    return this.request('/admin/orders');
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Users management
  async listUsers() {
    return this.request('/admin/users');
  }

  async toggleUserBlock(userId) {
    return this.request(`/admin/users/${userId}/toggle-block`, {
      method: 'PATCH',
    });
  }

  // WhatsApp Gateway & Live Outbox
  async getWhatsAppOutbox() {
    return this.request('/admin/whatsapp/outbox');
  }

  async markWhatsAppSent(id) {
    return this.request(`/admin/whatsapp/${id}/mark-sent`, {
      method: 'PATCH',
    });
  }

  async sendCustomWhatsApp(phone, text) {
    return this.request('/admin/whatsapp/send-custom', {
      method: 'POST',
      body: JSON.stringify({ phone, text }),
    });
  }
}

export const api = new AdminApiService();
