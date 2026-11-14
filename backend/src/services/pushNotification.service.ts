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

export class PushNotificationService {
  /**
   * Send a high-priority push notification to a specific user by FCM token
   */
  static async sendPushToToken(token: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
    if (!firebaseInitialized || !token) {
      return false;
    }

    try {
      await getMessaging().send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'rakna_alerts_channel',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
      console.log(`📲 [FCM] Push notification delivered successfully to token: ${token.substring(0, 10)}...`);
      return true;
    } catch (err: any) {
      console.error('❌ [FCM] Failed to send push notification:', err?.message || err);
      return false;
    }
  }

  /**
   * Send a push notification to a user using their userId
   */
  static async sendPushToUser(prisma: any, userId: string, payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<boolean> {
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
