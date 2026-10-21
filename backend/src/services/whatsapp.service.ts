import { v4 as uuidv4 } from 'uuid';

export interface WhatsAppMessage {
  id: string;
  phone: string;
  code: string;
  message: string;
  whatsappUrl: string;
  whatsappWebUrl: string;
  status: 'QUEUED' | 'SENT' | 'SIMULATED';
  createdAt: string;
  sentAt?: string;
}

class WhatsAppService {
  private outbox: WhatsAppMessage[] = [];
  private readonly maxHistory = 100;

  /**
   * إنشاء وتجهيز رسالة كود التحقق (OTP) للواتساب
   */
  queueOtpMessage(phone: string, code: string): WhatsAppMessage {
    const cleanPhone = phone.replace(/\D/g, ''); // e.g. 201012345678
    const message = `🚗 *ركنة | كود التحقق*\n\nكود التحقق لتسجيل الدخول هو: *${code}*\n\n⏱️ الكود صالح لمدة 10 دقائق.\n🔒 لا تشارك هذا الرمز مع أي شخص لحماية حسابك وسياراتك.\n\n_شكراً لاستخدامك تطبيق ركنة_`;

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

    // Keep latest 100 messages in memory for dashboard outbox
    this.outbox.unshift(msg);
    if (this.outbox.length > this.maxHistory) {
      this.outbox.pop();
    }

    console.log(`[WHATSAPP] Queued OTP for ${phone}: ${code}`);
    console.log(`[WHATSAPP] Link: ${whatsappUrl}`);

    // If Meta WhatsApp Cloud API credentials exist, attempt direct dispatch
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      this.dispatchViaCloudApi(msg).catch((err) => {
        console.warn('[WHATSAPP] Cloud API dispatch error:', err.message);
      });
    }

    return msg;
  }

  /**
   * إرسال عبر WhatsApp Cloud API المجاني (إذا كانت المتغيرات متوفرة)
   */
  private async dispatchViaCloudApi(msg: WhatsAppMessage): Promise<void> {
    try {
      const cleanPhone = msg.phone.replace(/\D/g, '');
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: msg.message },
          }),
        }
      );

      if (response.ok) {
        msg.status = 'SENT';
        msg.sentAt = new Date().toISOString();
        console.log(`[WHATSAPP] Successfully sent to ${cleanPhone} via Cloud API`);
      }
    } catch (e: any) {
      console.warn('[WHATSAPP] Cloud API error:', e.message);
    }
  }

  /**
   * جلب رسائل الـ Outbox الخاصة بالداشبورد
   */
  getOutbox(): WhatsAppMessage[] {
    return this.outbox;
  }

  /**
   * تحديد الرسالة كمرسلة من الداشبورد
   */
  markAsSent(id: string): WhatsAppMessage | null {
    const msg = this.outbox.find((m) => m.id === id);
    if (msg) {
      msg.status = 'SENT';
      msg.sentAt = new Date().toISOString();
      return msg;
    }
    return null;
  }

  /**
   * إحصائيات خدمة الواتساب
   */
  getStats() {
    const total = this.outbox.length;
    const sent = this.outbox.filter((m) => m.status === 'SENT').length;
    const queued = this.outbox.filter((m) => m.status === 'QUEUED').length;
    return { total, sent, queued };
  }
}

export const whatsAppService = new WhatsAppService();
