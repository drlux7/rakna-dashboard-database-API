import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type WhatsAppProvider =
  | 'GREEN_API'
  | 'META_CLOUD_API'
  | 'ULTRAMSG'
  | 'CUSTOM_GATEWAY'
  | 'SIMULATED_LINK';

export interface WhatsAppConfig {
  provider: WhatsAppProvider;
  isAutoSendEnabled: boolean;
  // Green-API (Free Developer Tier)
  greenApiIdInstance: string;
  greenApiToken: string;
  greenApiHost: string;
  // Meta WhatsApp Cloud API (Free 1000 conv/month)
  metaToken: string;
  metaPhoneNumberId: string;
  // UltraMsg
  ultraMsgInstanceId: string;
  ultraMsgToken: string;
  // Custom Gateway
  customEndpoint: string;
  customAuthHeader: string;
  // Message template
  otpTemplate: string;
  // Last test results
  lastTestStatus?: 'SUCCESS' | 'FAILED';
  lastTestMessage?: string;
  lastTestAt?: string;
}

export interface WhatsAppMessage {
  id: string;
  phone: string;
  code: string;
  message: string;
  whatsappUrl: string;
  whatsappWebUrl: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SIMULATED';
  providerUsed?: string;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  provider: 'GREEN_API',
  isAutoSendEnabled: true,
  greenApiIdInstance: '',
  greenApiToken: '',
  greenApiHost: 'https://api.green-api.com',
  metaToken: '',
  metaPhoneNumberId: '',
  ultraMsgInstanceId: '',
  ultraMsgToken: '',
  customEndpoint: '',
  customAuthHeader: '',
  otpTemplate:
    '🚗 *ركنة | كود التحقق*\n\nكود التحقق لتسجيل الدخول إلى حسابك هو: *{code}*\n\n⏱️ الكود صالح لمدة 10 دقائق.\n🔒 لا تشارك هذا الرمز مع أي شخص لحماية حسابك وسياراتك.\n\n_شكراً لاستخدامك ركنة (Rakna)_',
};

class WhatsAppService {
  private outbox: WhatsAppMessage[] = [];
  private readonly maxHistory = 150;
  private config: WhatsAppConfig;
  private readonly configFilePath: string;

  constructor() {
    this.configFilePath = path.join(process.cwd(), 'whatsapp_config.json');
    this.config = this.loadConfig();
  }

  /**
   * تحميل الإعدادات من الملف أو البيئة
   */
  private loadConfig(): WhatsAppConfig {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('[WHATSAPP] Could not read whatsapp_config.json, using defaults.');
    }

    // Fallback to process.env if available
    const envConfig: Partial<WhatsAppConfig> = {};
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      envConfig.provider = 'META_CLOUD_API';
      envConfig.metaToken = process.env.WHATSAPP_TOKEN;
      envConfig.metaPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    }
    if (process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN) {
      envConfig.provider = 'GREEN_API';
      envConfig.greenApiIdInstance = process.env.GREEN_API_ID_INSTANCE;
      envConfig.greenApiToken = process.env.GREEN_API_TOKEN;
    }

    return { ...DEFAULT_CONFIG, ...envConfig };
  }

  /**
   * حفظ الإعدادات في الملف
   */
  public saveConfig(newConfig: Partial<WhatsAppConfig>): WhatsAppConfig {
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('[WHATSAPP] Configuration updated successfully.');
    } catch (e) {
      console.error('[WHATSAPP] Failed to persist whatsapp_config.json:', e);
    }
    return this.getConfig();
  }

  /**
   * استرجاع الإعدادات الحالية مع إخفاء المفاتيح السرية
   */
  public getConfig(maskSecrets: boolean = false): WhatsAppConfig {
    if (!maskSecrets) {
      return { ...this.config };
    }

    const mask = (val: string) => {
      if (!val || val.length <= 6) return val ? '••••••' : '';
      return `${val.substring(0, 3)}••••${val.substring(val.length - 3)}`;
    };

    return {
      ...this.config,
      greenApiToken: mask(this.config.greenApiToken),
      metaToken: mask(this.config.metaToken),
      ultraMsgToken: mask(this.config.ultraMsgToken),
      customAuthHeader: mask(this.config.customAuthHeader),
    };
  }

  /**
   * صياغة نص الرسالة بناءً على القالب والكود
   */
  private formatMessage(code: string): string {
    const template = this.config.otpTemplate || DEFAULT_CONFIG.otpTemplate;
    return template.replace(/\{code\}/g, code);
  }

  /**
   * إدراج طلب OTP في الصندوق وإرساله تلقائياً إذا كانت البوابة مفعلة
   */
  public queueOtpMessage(phone: string, code: string): WhatsAppMessage {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = this.formatMessage(code);

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

    const msg: WhatsAppMessage = {
      id: uuidv4(),
      phone,
      code,
      message,
      whatsappUrl,
      whatsappWebUrl,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    this.outbox.unshift(msg);
    if (this.outbox.length > this.maxHistory) {
      this.outbox.pop();
    }

    console.log(`[WHATSAPP] Queued OTP for ${phone}: ${code}`);

    // Automatic API Dispatch
    if (this.config.isAutoSendEnabled && this.config.provider !== 'SIMULATED_LINK') {
      this.dispatchViaActiveProvider(msg).catch((err) => {
        console.warn('[WHATSAPP] Auto-dispatch failed:', err.message);
      });
    }

    return msg;
  }

  /**
   * إرسال رسالة باستخدام المزود النشط المحدد
   */
  public async dispatchViaActiveProvider(msg: WhatsAppMessage): Promise<{ success: boolean; error?: string }> {
    const cleanPhone = msg.phone.replace(/\D/g, '');
    msg.providerUsed = this.config.provider;

    try {
      switch (this.config.provider) {
        case 'GREEN_API': {
          if (!this.config.greenApiIdInstance || !this.config.greenApiToken) {
            throw new Error('بيانات Green-API غير مكتملة (idInstance أو apiTokenInstance مفقود)');
          }
          const host = this.config.greenApiHost || 'https://api.green-api.com';
          const url = `${host}/waInstance${this.config.greenApiIdInstance}/sendMessage/${this.config.greenApiToken}`;
          const chatId = `${cleanPhone}@c.us`;

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId,
              message: msg.message,
            }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.message || `Green-API HTTP ${res.status}`);
          }
          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          delete msg.errorMessage;
          console.log(`[WHATSAPP] Sent via Green-API to ${cleanPhone}`);
          return { success: true };
        }

        case 'META_CLOUD_API': {
          if (!this.config.metaToken || !this.config.metaPhoneNumberId) {
            throw new Error('بيانات Meta Cloud API غير مكتملة (Token أو Phone Number ID مفقود)');
          }
          const url = `https://graph.facebook.com/v21.0/${this.config.metaPhoneNumberId}/messages`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.config.metaToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { preview_url: false, body: msg.message },
            }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error?.message || `Meta API HTTP ${res.status}`);
          }
          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          delete msg.errorMessage;
          console.log(`[WHATSAPP] Sent via Meta Cloud API to ${cleanPhone}`);
          return { success: true };
        }

        case 'ULTRAMSG': {
          if (!this.config.ultraMsgInstanceId || !this.config.ultraMsgToken) {
            throw new Error('بيانات UltraMsg غير مكتملة (Instance ID أو Token مفقود)');
          }
          const url = `https://api.ultramsg.com/${this.config.ultraMsgInstanceId}/messages/chat`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: this.config.ultraMsgToken,
              to: cleanPhone,
              body: msg.message,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.error) {
            throw new Error(data.error || `UltraMsg HTTP ${res.status}`);
          }
          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          delete msg.errorMessage;
          return { success: true };
        }

        case 'CUSTOM_GATEWAY': {
          if (!this.config.customEndpoint) {
            throw new Error('رابط الـ Webhook المخصص غير محدد');
          }
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (this.config.customAuthHeader) {
            headers['Authorization'] = this.config.customAuthHeader;
          }
          const res = await fetch(this.config.customEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              phone: cleanPhone,
              code: msg.code,
              message: msg.message,
            }),
          });
          if (!res.ok) {
            throw new Error(`Custom Gateway HTTP ${res.status}`);
          }
          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          delete msg.errorMessage;
          return { success: true };
        }

        case 'SIMULATED_LINK':
        default: {
          msg.status = 'SIMULATED';
          return { success: true };
        }
      }
    } catch (err: any) {
      msg.status = 'FAILED';
      msg.errorMessage = err.message || 'فشل الاتصال بمزود الواتساب';
      console.warn(`[WHATSAPP] Dispatch error for ${cleanPhone}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * اختبار الاتصال وإرسال كود تجريبي
   */
  public async sendTestOtp(phone: string): Promise<{ success: boolean; message: string; details?: any }> {
    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    const msg = this.queueOtpMessage(phone, testCode);

    const result = await this.dispatchViaActiveProvider(msg);
    this.config.lastTestAt = new Date().toISOString();

    if (result.success) {
      this.config.lastTestStatus = 'SUCCESS';
      this.config.lastTestMessage = `تم الإرسال بنجاح إلى ${phone} عبر ${this.config.provider}`;
      this.saveConfig({});
      return {
        success: true,
        message: `تم إرسال كود التحقق التجريبي (${testCode}) بنجاح إلى الرقم ${phone}!`,
        details: { code: testCode, provider: this.config.provider, status: msg.status },
      };
    } else {
      this.config.lastTestStatus = 'FAILED';
      this.config.lastTestMessage = result.error || 'فشل الاتصال';
      this.saveConfig({});
      return {
        success: false,
        message: `تعذر الإرسال: ${result.error}`,
        details: { provider: this.config.provider, error: result.error },
      };
    }
  }

  /**
   * إعادة إرسال رسالة مسجلة في الصندوق
   */
  public async resendMessage(id: string): Promise<WhatsAppMessage | null> {
    const msg = this.outbox.find((m) => m.id === id);
    if (!msg) return null;

    msg.status = 'QUEUED';
    await this.dispatchViaActiveProvider(msg);
    return msg;
  }

  /**
   * جلب رسائل الـ Outbox الخاصة بالداشبورد
   */
  public getOutbox(): WhatsAppMessage[] {
    return this.outbox;
  }

  /**
   * تحديد الرسالة كمرسلة يدويًا من الداشبورد
   */
  public markAsSent(id: string): WhatsAppMessage | null {
    const msg = this.outbox.find((m) => m.id === id);
    if (msg) {
      msg.status = 'SENT';
      msg.sentAt = new Date().toISOString();
      delete msg.errorMessage;
      return msg;
    }
    return null;
  }

  /**
   * إحصائيات خدمة الواتساب
   */
  public getStats() {
    const total = this.outbox.length;
    const sent = this.outbox.filter((m) => m.status === 'SENT').length;
    const queued = this.outbox.filter((m) => m.status === 'QUEUED').length;
    const failed = this.outbox.filter((m) => m.status === 'FAILED').length;
    const simulated = this.outbox.filter((m) => m.status === 'SIMULATED').length;
    return {
      total,
      sent,
      queued,
      failed,
      simulated,
      activeProvider: this.config.provider,
      isAutoSendEnabled: this.config.isAutoSendEnabled,
      lastTestStatus: this.config.lastTestStatus,
    };
  }

  /**
   * جلب رمز الـ QR Code الخاص بـ Green-API لمسحه بالهاتف
   */
  public async getQrCode(): Promise<{ type: string; message?: string; error?: string }> {
    try {
      if (!this.config.greenApiIdInstance || !this.config.greenApiToken) {
        throw new Error('يرجى حفظ معرّف النسخة idInstance والرمز apiTokenInstance أولاً');
      }
      const host = this.config.greenApiHost || 'https://api.green-api.com';
      const url = `${host}/waInstance${this.config.greenApiIdInstance}/qr/${this.config.greenApiToken}`;
      const res = await fetch(url);
      const data: any = await res.json();
      return data;
    } catch (err: any) {
      return { type: 'error', error: err.message || 'تعذر جلب رمز QR' };
    }
  }

  /**
   * فحص حالة الحساب في Green-API (authorized, notAuthorized, etc.)
   */
  public async getStateInstance(): Promise<{ stateInstance: string; error?: string }> {
    try {
      if (!this.config.greenApiIdInstance || !this.config.greenApiToken) {
        return { stateInstance: 'notConfigured' };
      }
      const host = this.config.greenApiHost || 'https://api.green-api.com';
      const url = `${host}/waInstance${this.config.greenApiIdInstance}/getStateInstance/${this.config.greenApiToken}`;
      const res = await fetch(url);
      const data: any = await res.json();
      return data;
    } catch (err: any) {
      return { stateInstance: 'error', error: err.message };
    }
  }

  /**
   * تسجيل الخروج من الهاتف المرتبط لربط رقم جديد
   */
  public async logoutInstance(): Promise<{ isLogout: boolean; error?: string }> {
    try {
      const host = this.config.greenApiHost || 'https://api.green-api.com';
      const url = `${host}/waInstance${this.config.greenApiIdInstance}/logout/${this.config.greenApiToken}`;
      const res = await fetch(url, { method: 'POST' });
      const data: any = await res.json();
      return data;
    } catch (err: any) {
      return { isLogout: false, error: err.message };
    }
  }

  /**
   * إعادة تشغيل النسخة (Reboot)
   */
  public async rebootInstance(): Promise<{ isReboot: boolean; error?: string }> {
    try {
      const host = this.config.greenApiHost || 'https://api.green-api.com';
      const url = `${host}/waInstance${this.config.greenApiIdInstance}/reboot/${this.config.greenApiToken}`;
      const res = await fetch(url, { method: 'POST' });
      const data: any = await res.json();
      return data;
    } catch (err: any) {
      return { isReboot: false, error: err.message };
    }
  }
}

export const whatsAppService = new WhatsAppService();
