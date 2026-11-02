import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

// Dynamic import helper to support ESM package (@whiskeysockets/baileys) in Node CommonJS target
const importDynamic = (modulePath: string): Promise<any> => {
  return (Function('m', 'return import(m)'))(modulePath);
};
const pino = require('pino');

export type WhatsAppProvider =
  | 'BAILEYS'
  | 'GREEN_API'
  | 'META_CLOUD_API'
  | 'ULTRAMSG'
  | 'CUSTOM_GATEWAY'
  | 'SIMULATED_LINK';

export interface WhatsAppConfig {
  provider: WhatsAppProvider;
  isAutoSendEnabled: boolean;
  // Green-API (Legacy)
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
  provider: 'BAILEYS',
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

  // Baileys Engine Internal State
  private baileysSocket: any = null;
  private baileysQr: string | null = null;
  private baileysState: 'authorized' | 'notAuthorized' | 'connecting' | 'error' = 'notAuthorized';
  private baileysPhone: string | null = null;
  private readonly baileysAuthDir: string;
  private isBaileysInitializing = false;

  constructor() {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
    }
    this.configFilePath = path.join(dataDir, 'whatsapp_config.json');
    this.baileysAuthDir = path.join(dataDir, 'baileys_auth');
    this.config = this.loadConfig();

    // Start Baileys immediately if Baileys is active
    if (this.config.provider === 'BAILEYS') {
      this.initBaileys().catch((err) => {
        console.error('[WHATSAPP-BAILEYS] Startup init error:', err);
      });
    }
  }

  /**
   * تهيئة عميل Baileys المحلي المستقل
   */
  public async initBaileys(): Promise<void> {
    if (this.isBaileysInitializing) return;
    this.isBaileysInitializing = true;
    this.baileysState = 'connecting';

    try {
      if (!fs.existsSync(this.baileysAuthDir)) {
        fs.mkdirSync(this.baileysAuthDir, { recursive: true });
      }

      const baileysMod = await importDynamic('@whiskeysockets/baileys');
      const makeWASocket = baileysMod.default || baileysMod;
      const { DisconnectReason, useMultiFileAuthState } = baileysMod;

      const { state, saveCreds } = await useMultiFileAuthState(this.baileysAuthDir);

      this.baileysSocket = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['Rakna Admin Dashboard', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.baileysSocket.ev.on('creds.update', saveCreds);

      this.baileysSocket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.baileysQr = await QRCode.toDataURL(qr, { margin: 2, scale: 7 });
            this.baileysState = 'notAuthorized';
            console.log('[WHATSAPP-BAILEYS] New QR Code generated for pairing.');
          } catch (qrErr) {
            console.error('[WHATSAPP-BAILEYS] QR Generation error:', qrErr);
          }
        }

        if (connection === 'open') {
          this.baileysQr = null;
          this.baileysState = 'authorized';
          const rawId = this.baileysSocket?.user?.id || '';
          this.baileysPhone = rawId.split(':')[0] || rawId.split('@')[0] || '';
          console.log(`[WHATSAPP-BAILEYS] ✅ Connected successfully! Linked WhatsApp Phone: +${this.baileysPhone}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          console.log(`[WHATSAPP-BAILEYS] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            this.baileysState = 'connecting';
            setTimeout(() => {
              this.isBaileysInitializing = false;
              this.initBaileys();
            }, 4000);
          } else {
            this.baileysState = 'notAuthorized';
            this.baileysPhone = null;
            this.baileysQr = null;
            try {
              fs.rmSync(this.baileysAuthDir, { recursive: true, force: true });
            } catch (_) {}
            setTimeout(() => {
              this.isBaileysInitializing = false;
              this.initBaileys();
            }, 2000);
          }
        }
      });
    } catch (err: any) {
      console.error('[WHATSAPP-BAILEYS] Failed to initialize Baileys client:', err.message);
      this.baileysState = 'error';
    } finally {
      this.isBaileysInitializing = false;
    }
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

    return { ...DEFAULT_CONFIG };
  }

  /**
   * حفظ الإعدادات في الملف
   */
  public saveConfig(newConfig: Partial<WhatsAppConfig>): WhatsAppConfig {
    const prevProvider = this.config.provider;
    this.config = { ...this.config, ...newConfig };
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
      console.log('[WHATSAPP] Configuration updated successfully.');

      // If switched to Baileys, start it
      if (this.config.provider === 'BAILEYS' && (!this.baileysSocket || prevProvider !== 'BAILEYS')) {
        this.initBaileys();
      }
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
   * إرسال تنبيه أو إشعار فوري إلى رقم الهاتف مباشرة عبر واتساب (لإشعار المالك حتى والتطبيق مغلق)
   */
  public async sendDirectAlert(phone: string, text: string): Promise<boolean> {
    if (!phone) return false;
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

    const msg: WhatsAppMessage = {
      id: uuidv4(),
      phone,
      code: 'ALERT',
      message: text,
      whatsappUrl,
      whatsappWebUrl,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
    };

    this.outbox.unshift(msg);
    if (this.outbox.length > this.maxHistory) {
      this.outbox.pop();
    }

    if (this.config.isAutoSendEnabled && this.config.provider !== 'SIMULATED_LINK') {
      try {
        const res = await this.dispatchViaActiveProvider(msg);
        return res.success;
      } catch (err: any) {
        console.warn(`[WHATSAPP] Failed to send direct alert to ${phone}:`, err?.message || err);
        return false;
      }
    }
    return true;
  }

  /**
   * إرسال رسالة باستخدام المزود النشط المحدد
   */
  public async dispatchViaActiveProvider(msg: WhatsAppMessage): Promise<{ success: boolean; error?: string }> {
    let cleanPhone = msg.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '2' + cleanPhone;
    msg.providerUsed = this.config.provider;

    try {
      switch (this.config.provider) {
        case 'BAILEYS': {
          if (!this.baileysSocket || this.baileysState !== 'authorized') {
            throw new Error('خدمة Baileys غير متصلة بحساب واتساب حالياً. يرجى مسح رمز الـ QR من الداشبورد.');
          }

          const jid = `${cleanPhone}@s.whatsapp.net`;
          await this.baileysSocket.sendMessage(jid, { text: msg.message });

          msg.status = 'SENT';
          msg.sentAt = new Date().toISOString();
          delete msg.errorMessage;
          console.log(`[WHATSAPP-BAILEYS] Sent OTP successfully to ${cleanPhone}`);
          return { success: true };
        }

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

          const data: any = await res.json().catch(() => ({}));
          if (!res.ok || data.error) {
            throw new Error(data.message || data.error || `Green-API HTTP ${res.status}`);
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
          console.log(`[WHATSAPP] Link simulated for ${cleanPhone}: ${msg.whatsappUrl}`);
          return { success: true };
        }
      }
    } catch (err: any) {
      msg.status = 'FAILED';
      msg.errorMessage = err.message || 'خطأ غير معروف أثناء الإرسال';
      console.warn(`[WHATSAPP] Dispatch error for ${cleanPhone}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * إرسال رسالة تجريبية لاختبار عمل البوابة الحالية
   */
  public async sendTestOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const testCode = Math.floor(100000 + Math.random() * 900000).toString();
    const msg = this.queueOtpMessage(phone, testCode);

    const result = await this.dispatchViaActiveProvider(msg);

    this.config.lastTestAt = new Date().toISOString();
    if (result.success) {
      this.config.lastTestStatus = 'SUCCESS';
      this.config.lastTestMessage = `تم الإرسال بنجاح إلى ${phone}`;
      this.saveConfig({
        lastTestStatus: 'SUCCESS',
        lastTestMessage: this.config.lastTestMessage,
        lastTestAt: this.config.lastTestAt,
      });
      return { success: true, message: `تم إرسال كود الاختبار (${testCode}) بنجاح إلى ${phone}` };
    } else {
      this.config.lastTestStatus = 'FAILED';
      this.config.lastTestMessage = result.error;
      this.saveConfig({
        lastTestStatus: 'FAILED',
        lastTestMessage: result.error,
        lastTestAt: this.config.lastTestAt,
      });
      return { success: false, message: `فشل الاختبار: ${result.error}` };
    }
  }

  /**
   * إعادة إرسال رسالة سابقة
   */
  public async resendMessage(id: string): Promise<WhatsAppMessage | null> {
    const msg = this.outbox.find((m) => m.id === id);
    if (!msg) return null;

    msg.status = 'QUEUED';
    delete msg.errorMessage;
    await this.dispatchViaActiveProvider(msg);
    return msg;
  }

  /**
   * استعراض صندوق الصادر
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
      connectedPhone: this.baileysPhone,
    };
  }

  /**
   * جلب رمز الـ QR Code لمسحه بالهاتف (يدعم Baileys أو Green-API)
   */
  public async getQrCode(): Promise<{ type: string; message?: string; status?: string; phone?: string | null; error?: string }> {
    try {
      if (this.config.provider === 'BAILEYS') {
        if (!this.baileysSocket) {
          await this.initBaileys();
        }
        return {
          type: 'qrCode',
          message: this.baileysQr || undefined,
          status: this.baileysState,
          phone: this.baileysPhone,
        };
      }

      // Legacy Green-API fallback
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
   * فحص حالة الحساب (authorized, notAuthorized, connecting, etc.)
   */
  public async getStateInstance(): Promise<{ stateInstance: string; phone?: string | null; error?: string }> {
    try {
      if (this.config.provider === 'BAILEYS') {
        return {
          stateInstance: this.baileysState,
          phone: this.baileysPhone,
        };
      }

      // Legacy Green-API fallback
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
      if (this.config.provider === 'BAILEYS') {
        if (this.baileysSocket) {
          try {
            await this.baileysSocket.logout();
          } catch (_) {}
          this.baileysSocket.end(undefined);
          this.baileysSocket = null;
        }
        this.baileysState = 'notAuthorized';
        this.baileysPhone = null;
        this.baileysQr = null;

        try {
          fs.rmSync(this.baileysAuthDir, { recursive: true, force: true });
        } catch (_) {}

        setTimeout(() => this.initBaileys(), 1500);
        return { isLogout: true };
      }

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
      if (this.config.provider === 'BAILEYS') {
        if (this.baileysSocket) {
          try {
            this.baileysSocket.end(undefined);
          } catch (_) {}
          this.baileysSocket = null;
        }
        this.baileysState = 'connecting';
        this.isBaileysInitializing = false;
        setTimeout(() => this.initBaileys(), 1500);
        return { isReboot: true };
      }

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
