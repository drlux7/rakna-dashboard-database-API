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

  async getWhatsAppConfig() {
    return this.request('/admin/whatsapp/config');
  }

  async updateWhatsAppConfig(config) {
    return this.request('/admin/whatsapp/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async testWhatsAppGateway(phone) {
    return this.request('/admin/whatsapp/test', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async resendWhatsApp(id) {
    return this.request(`/admin/whatsapp/${id}/resend`, {
      method: 'POST',
    });
  }

  async getWhatsAppQrCode() {
    return this.request('/admin/whatsapp/qr');
  }

  async getWhatsAppState() {
    return this.request('/admin/whatsapp/state');
  }

  async rebootWhatsApp() {
    return this.request('/admin/whatsapp/reboot', {
      method: 'POST',
    });
  }

  async logoutWhatsApp() {
    return this.request('/admin/whatsapp/logout', {
      method: 'POST',
    });
  }

  // Live Customer Support Desk
  async getSupportThreads() {
    return this.request('/admin/support/threads');
  }

  async getSupportThreadMessages(userId) {
    return this.request(`/admin/support/threads/${userId}/messages`);
  }

  async replySupportThread(threadId, content, imageUrl) {
    return this.request(`/admin/support/threads/${threadId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content, imageUrl }),
    });
  }

  async closeSupportThread(threadId) {
    return this.request(`/admin/support/threads/${threadId}/close`, {
      method: 'POST',
    });
  }

  // Abuse Reports & Chat Moderation
  async getAbuseReports(status = 'ALL') {
    return this.request(`/admin/abuse-reports?status=${status}`);
  }

  async getReportMessages(reportId) {
    return this.request(`/admin/abuse-reports/${reportId}/messages`);
  }

  async takeReportAction(reportId, action, notes) {
    return this.request(`/admin/abuse-reports/${reportId}/action`, {
      method: 'PATCH',
      body: JSON.stringify({ action, notes }),
    });
  }
}

export const api = new AdminApiService();

