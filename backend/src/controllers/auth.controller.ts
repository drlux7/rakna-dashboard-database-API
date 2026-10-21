import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { whatsAppService } from '../services/whatsapp.service';

const JWT_SECRET = process.env.JWT_SECRET || 'rakna_secret_default_key';

// Mock OTP store for dev/testing (in production, use Redis with expiration)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export class AuthController {
  /**
   * إرسال كود التحقق لرقم الهاتف المصري (+20)
   */
  static async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      let { phone } = req.body;
      if (!phone || typeof phone !== 'string') {
        res.status(400).json({ success: false, message: 'يرجى إدخال رقم هاتف صحيح' });
        return;
      }

      phone = phone.trim();
      if (!phone.startsWith('+20')) {
        if (phone.startsWith('01')) {
          phone = '+20' + phone.substring(1);
        } else if (phone.startsWith('1')) {
          phone = '+20' + phone;
        }
      }

      // Generate 6-digit OTP code (e.g. 123456 in dev or random in prod)
      const isDev = process.env.NODE_ENV !== 'production';
      const code = isDev ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP for 10 minutes
      otpStore.set(phone, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      // Queue and prepare WhatsApp message
      const waMsg = whatsAppService.queueOtpMessage(phone, code);

      // Mask phone for response (e.g. +20 10 ••• •• 78)
      const masked = phone.length > 7
        ? `${phone.substring(0, 5)} ••• •• ${phone.substring(phone.length - 2)}`
        : phone;

      res.json({
        success: true,
        message: 'تم تجهيز كود التحقق وإرساله عبر الواتساب بنجاح',
        maskedPhone: masked,
        whatsappUrl: waMsg.whatsappUrl,
        whatsappWebUrl: waMsg.whatsappWebUrl,
        // Send mock code in dev mode for easy testing
        devOtp: isDev ? code : undefined,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إرسال كود التحقق' });
    }
  }

  /**
   * التحقق من كود الـ OTP وتسجيل الدخول / إنشاء الحساب
   */
  static async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      let { phone, otp } = req.body;
      if (!phone || !otp) {
        res.status(400).json({ success: false, message: 'رقم الهاتف وكود التحقق مطلوبان' });
        return;
      }

      phone = phone.trim();
      if (!phone.startsWith('+20')) {
        if (phone.startsWith('01')) {
          phone = '+20' + phone.substring(1);
        }
      }

      const stored = otpStore.get(phone);
      // Allow default '123456' in dev or matching stored OTP
      const isMatch = stored && stored.code === otp && stored.expiresAt > Date.now();
      const isDevBypass = process.env.NODE_ENV !== 'production' && otp === '123456';

      if (!isMatch && !isDevBypass) {
        res.status(400).json({ success: false, message: 'كود التحقق غير صحيح أو منتهي الصلاحية' });
        return;
      }

      otpStore.delete(phone);

      // Find or create user
      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            phone,
            name: 'صاحب المركبة',
            isVerified: true,
          },
        });

        // Create welcome notification
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'SYSTEM',
            title: 'مرحباً بك في ركنة!',
            message: 'تم تأكيد رقم هاتفك وتفعيل حسابك. هويتك ورقمك محميان بالكامل.',
            actionLabel: 'استكشف التطبيق',
          },
        });
      }

      if (user.isBlocked) {
        res.status(403).json({ success: false, message: 'هذا الحساب محظور لمخالفة معايير الأمان والخصوصية' });
        return;
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, phone: user.phone },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        message: 'تم التحقق بنجاح',
        token,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          notificationsEnabled: user.notificationsEnabled,
          themePreference: user.themePreference,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'حدث خطأ أثناء التحقق' });
    }
  }

  /**
   * جلب بيانات الملف الشخصي
   */
  static async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          cars: true,
          tags: true,
        },
      });

      if (!user) {
        res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        return;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          notificationsEnabled: user.notificationsEnabled,
          themePreference: user.themePreference,
          carsCount: user.cars.length,
          tagsCount: user.tags.length,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب البيانات' });
    }
  }

  /**
   * تحديث بيانات الحساب (الاسم، تفضيلات الإشعارات، الثيم)
   */
  static async updateMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, notificationsEnabled, themePreference } = req.body;
      const updated = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(name !== undefined && { name }),
          ...(notificationsEnabled !== undefined && { notificationsEnabled }),
          ...(themePreference !== undefined && { themePreference }),
        },
      });

      res.json({
        success: true,
        message: 'تم تحديث بيانات الحساب بنجاح',
        user: {
          id: updated.id,
          phone: updated.phone,
          name: updated.name,
          notificationsEnabled: updated.notificationsEnabled,
          themePreference: updated.themePreference,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تحديث البيانات' });
    }
  }
}
