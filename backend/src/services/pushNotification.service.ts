import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

let firebaseInitialized = false;

try {
  let serviceAccount: any = null;

  // 1. الأولوية الأولى: قراءة المفتاح من متغير البيئة FIREBASE_SERVICE_ACCOUNT (JSON أو Base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT && process.env.FIREBASE_SERVICE_ACCOUNT.trim()) {
    try {
      const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (rawEnv.startsWith('{')) {
        serviceAccount = JSON.parse(rawEnv);
      } else {
        // فك تشفير Base64 إذا تم تمريره كـ Base64 string لتفادي مشاكل الـ newlines
        const decoded = Buffer.from(rawEnv, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }
      console.log('🔥 [FCM] Loaded Firebase credentials from FIREBASE_SERVICE_ACCOUNT environment variable');
    } catch (envErr) {
      console.error('❌ [FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', envErr);
    }
  }

  // 2. المحاولة الثانية: قراءة الملف محلياً إذا وُجد
  if (!serviceAccount) {
    const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log('🔥 [FCM] Loaded Firebase credentials from firebase-service-account.json file');
    }
  }

  if (serviceAccount) {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
    firebaseInitialized = true;
    console.log('🔥 [FCM] Firebase Admin SDK initialized successfully');
  } else {
    console.warn('⚠️ [FCM] No Firebase credentials found (neither FIREBASE_SERVICE_ACCOUNT env nor json file)');
  }
} catch (error) {
  console.error('❌ [FCM] Error initializing Firebase Admin SDK:', error);
}

// ذاكرة مؤقتة لمنع تكرار نفس الإشعار لنفس الجهاز خلال فترة وجيزة
const recentNotificationCache = new Map<string, number>();

// تنظيف دوري للذاكرة المؤقتة كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentNotificationCache.entries()) {
    if (now - timestamp > 60000) {
      recentNotificationCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  tag?: string;
  collapseKey?: string;
}

export class PushNotificationService {
  /**
   * Send a high-priority push notification to a specific user by FCM token
   */
  static async sendPushToToken(token: string, payload: PushPayload): Promise<boolean> {
    if (!firebaseInitialized || !token || typeof token !== 'string') {
      return false;
    }

    const cleanToken = token.trim();
    if (!cleanToken) return false;

    // 1. منع تكرار نفس الإشعار لنفس الجهاز (Deduplication within 15s)
    const dedupeKey = `${cleanToken}_${payload.title}_${payload.body}_${payload.data?.type || ''}_${payload.data?.chatId || payload.data?.tagCode || ''}`;
    const lastSentTime = recentNotificationCache.get(dedupeKey);
    const now = Date.now();
    if (lastSentTime && (now - lastSentTime) < 15000) {
      console.log(`⚠️ [FCM Dedupe] Suppressed duplicate notification to token: ${cleanToken.substring(0, 10)}... (Key: ${dedupeKey})`);
      return false;
    }
    recentNotificationCache.set(dedupeKey, now);

    try {
      await getMessaging().send({
        token: cleanToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          collapseKey: payload.collapseKey || payload.data?.type || 'rakna_alerts',
          notification: {
            channelId: 'rakna_alerts_channel',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            tag: payload.tag || payload.data?.type || 'rakna_notif',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-collapse-id': payload.collapseKey || payload.data?.type || 'rakna_alerts',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      console.log(`📲 [FCM] Push notification delivered successfully to token: ${cleanToken.substring(0, 10)}...`);
      return true;
    } catch (err: any) {
      console.error('❌ [FCM] Failed to send push notification:', err?.message || err);
      return false;
    }
  }

  /**
   * إرسال الإشعارات بالترتيب على دفعات مع تأخير زمني لحماية السيرفر من الضغط الزائد
   */
  static async sendPushInBatches(
    tokens: string[],
    payload: PushPayload,
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<{ sent: number; total: number }> {
    if (!firebaseInitialized || !tokens.length) {
      return { sent: 0, total: 0 };
    }

    // إزالة التكرار من قائمة التوكنات لضمان عدم إرسال إشعارين لنفس الجهاز
    const uniqueTokens = Array.from(new Set(tokens.filter(t => t && typeof t === 'string' && t.trim().length > 0).map(t => t.trim())));
    const batchSize = options.batchSize || 20;
    const delayMs = options.delayMs || 250;

    let sent = 0;
    console.log(`📦 [FCM Batch] Starting throttled delivery to ${uniqueTokens.length} unique devices (batch: ${batchSize}, delay: ${delayMs}ms)...`);

    for (let i = 0; i < uniqueTokens.length; i += batchSize) {
      const chunk = uniqueTokens.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        chunk.map(token => this.sendPushToToken(token, payload))
      );

      for (const res of results) {
        if (res.status === 'fulfilled' && res.value === true) {
          sent++;
        }
      }

      // تأخير زمني بين كل دفعة وأخرى لتوزيع حمل الشبكة ومعالج السيرفر
      if (i + batchSize < uniqueTokens.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`✅ [FCM Batch] Finished delivery: ${sent}/${uniqueTokens.length} successful.`);
    return { sent, total: uniqueTokens.length };
  }

  /**
   * Send a push notification to a user using their userId
   */
  static async sendPushToUser(prisma: any, userId: string, payload: PushPayload): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, notificationsEnabled: true },
      });

      if (!user || !user.notificationsEnabled || !user.fcmToken) {
        return false;
      }

      return await this.sendPushToToken(user.fcmToken, payload);
    } catch (e) {
      console.error('❌ [FCM] Error in sendPushToUser:', e);
      return false;
    }
  }
}
