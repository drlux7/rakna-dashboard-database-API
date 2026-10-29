import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { whatsAppService } from '../services/whatsapp.service';

import dotenv from 'dotenv';
dotenv.config();

const getJwtSecret = () => process.env.JWT_SECRET || 'rakna_super_secret_jwt_key_2026_veritag';

// Mock OTP store for dev/testing (in production, use Redis with expiration)
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export class AuthController {
  /**
   * إرسال كود التحقق لرقم الهاتف المصري (+20)
   */
  static async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      let { phone, isLogin } = req.body;
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

      // في حالة تسجيل الدخول، التحقق من أن الرقم مسجل مسبقاً في قاعدة البيانات
      if (isLogin === true || isLogin === 'true') {
        const existingUser = await prisma.user.findUnique({
          where: { phone },
        });

        if (!existingUser) {
          res.status(404).json({
            success: false,
            code: 'USER_NOT_FOUND',
            message: 'هذا الرقم غير مسجل في قاعدة البيانات، يجب تسجيل الدخول كمستخدم جديد',
          });
          return;
        }
      }

      // Generate 4-digit random OTP code (1000 - 9999)
      const isDev = process.env.NODE_ENV !== 'production';
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      console.log(`[OTP] Generated 4-digit random OTP for ${phone}: ${code}`);

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
        // Send generated code in dev mode for easy testing / debugging
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
      let { phone, otp, name } = req.body;
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
      // Validate against the randomly generated 4-digit OTP stored in memory
      const isMatch = stored && stored.code === otp && stored.expiresAt > Date.now();

      if (!isMatch) {
        res.status(400).json({ success: false, message: 'كود التحقق غير صحيح أو منتهي الصلاحية' });
        return;
      }

      otpStore.delete(phone);

      const resolvedName = (name && typeof name === 'string' && name.trim().length > 0)
        ? name.trim()
        : 'صاحب المركبة';

      // Find or create user
      let user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            phone,
            name: resolvedName,
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
      } else if (resolvedName !== 'صاحب المركبة' && (!user.name || user.name === 'صاحب المركبة')) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name: resolvedName },
        });
      }

      if (user.isBlocked) {
        res.status(403).json({ success: false, message: 'هذا الحساب محظور لمخالفة معايير الأمان والخصوصية' });
        return;
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, phone: user.phone },
        getJwtSecret(),
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

  /**
   * جلب إعدادات الخصوصية والأمان لحساب المستخدم
   */
  static async getPrivacySettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });
      if (!user) {
        res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        return;
      }
      res.json({
        success: true,
        settings: {
          allowReporterPhotos: user.allowReporterPhotos ?? true,
          blurPhotosUntilTap: user.blurPhotosUntilTap ?? true,
          autoDeleteAfter30Days: user.autoDeleteAfter30Days ?? false,
          allowFreeChat: user.allowFreeChat ?? false, // Default is false: only predefined quick messages
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب إعدادات الخصوصية' });
    }
  }

  /**
   * تحديث إعدادات الخصوصية والأمان (وقفل/فتح الشات الحر)
   */
  static async updatePrivacySettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { allowReporterPhotos, blurPhotosUntilTap, autoDeleteAfter30Days, allowFreeChat } = req.body;
      const data: any = {};
      if (allowReporterPhotos !== undefined) data.allowReporterPhotos = Boolean(allowReporterPhotos);
      if (blurPhotosUntilTap !== undefined) data.blurPhotosUntilTap = Boolean(blurPhotosUntilTap);
      if (autoDeleteAfter30Days !== undefined) data.autoDeleteAfter30Days = Boolean(autoDeleteAfter30Days);
      if (allowFreeChat !== undefined) data.allowFreeChat = Boolean(allowFreeChat);

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data,
      });

      // تطبيق التحديث على جميع مركبات المستخدم التابعة له
      if (allowFreeChat !== undefined || allowReporterPhotos !== undefined) {
        await prisma.car.updateMany({
          where: { userId: user.id },
          data: {
            ...(allowFreeChat !== undefined && { allowFreeChat: Boolean(allowFreeChat) }),
            ...(allowReporterPhotos !== undefined && { allowReporterPhotos: Boolean(allowReporterPhotos) }),
          },
        });
      }

      res.json({
        success: true,
        message: 'تم حفظ إعدادات الخصوصية بنجاح',
        settings: {
          allowReporterPhotos: user.allowReporterPhotos,
          blurPhotosUntilTap: user.blurPhotosUntilTap,
          autoDeleteAfter30Days: user.autoDeleteAfter30Days,
          allowFreeChat: user.allowFreeChat,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر حفظ إعدادات الخصوصية' });
    }
  }
}
