import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';

export class ReporterController {
  /**
   * قراءة كود الـ Tag بالـ QR أو NFC وإرجاع بيانات السيارة المجهولة
   * لا يتم إرجاع أي اسم أو رقم هاتف لمالك السيارة نهائياً (Zero-Knowledge)
   */
  static async resolveTag(req: Request, res: Response): Promise<void> {
    try {
      const tagCode = req.params.tagCode as string;
      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;

      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
        include: {
          car: true,
        },
      });

      if (!tag) {
        res.status(404).json({
          success: false,
          message: 'رمز الـ Tag غير مسجل في نظام ركنة',
        });
        return;
      }

      // Log scan activity
      const method = (req.query.method as string) === 'NFC' ? 'NFC' : 'QR';
      await prisma.tagScanLog.create({
        data: {
          tagId: tag.id,
          method,
          ipAddress: req.ip || null,
          userAgent: req.headers['user-agent'] || null,
        },
      });

      // If car is linked and active, create scan notification for owner
      if (tag.car && tag.status === 'ACTIVE' && tag.car.isTagActive) {
        await prisma.notification.create({
          data: {
            userId: tag.car.userId,
            carId: tag.car.id,
            tagCode: tag.tagCode,
            type: 'TAG_SCAN',
            title: `تم مسح الـ Tag لسيارة ${tag.car.brand} ${tag.car.model}`,
            message: `قام شخص ما بمسح ملصق سيارتك (${tag.tagCode}) عبر تقنية ${method}.`,
            actionLabel: 'تفاصيل المسح',
          },
        });
      }

      const isCarActive = tag.status === 'ACTIVE' && (tag.car?.isTagActive ?? false);

      res.json({
        success: true,
        tag: {
          code: tag.tagCode,
          type: tag.tagType,
          isActive: isCarActive,
          statusText: isCarActive ? 'نشط' : (tag.status === 'PAUSED' ? 'متوقف مؤقتاً' : 'غير مفعّل'),
        },
        car: tag.car
          ? {
              id: tag.car.id,
              brand: tag.car.brand,
              model: tag.car.model,
              colorName: tag.car.colorName,
              displayTitle: tag.car.nickname || `${tag.car.brand} ${tag.car.model}`,
            }
          : null,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر قراءة بيانات الـ Tag' });
    }
  }

  /**
   * توليد جلسة مجهولة للمُبلّغ (لا تتطلب إنشاء حساب)
   */
  static async initSession(req: Request, res: Response): Promise<void> {
    try {
      const sessionToken = `rep_session_${uuidv4()}`;
      res.json({
        success: true,
        sessionToken,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إنشاء جلسة المُبلّغ' });
    }
  }

  /**
   * إنشاء محادثة مجهولة جديدة وتحديد سبب التواصل
   */
  static async createChat(req: Request, res: Response): Promise<void> {
    try {
      const { tagCode, contactReason, initialMessage, sessionToken, isViewOnce, imageUrl } = req.body;

      if (!tagCode || !contactReason) {
        res.status(400).json({ success: false, message: 'كود الـ Tag وسبب التواصل مطلوبان' });
        return;
      }

      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;
      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
        include: { car: true },
      });

      if (!tag || !tag.car) {
        res.status(404).json({ success: false, message: 'المركبة غير متاحة أو لم يتم ربطها بعد' });
        return;
      }

      if (tag.status === 'PAUSED' || !tag.car.isTagActive) {
        res.status(400).json({ success: false, message: 'ملصق السيارة متوقف مؤقتاً حالياً من قبل المالك' });
        return;
      }

      const reporterToken = sessionToken || `rep_${uuidv4()}`;

      // Create Chat
      const chat = await prisma.chat.create({
        data: {
          carId: tag.car.id,
          reporterSessionToken: reporterToken,
          contactReason: contactReason || 'OTHER',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
        },
      });

      // Map contact reason to Arabic title for notification
      const reasonMap: Record<string, string> = {
        CAR_BLOCKING: 'السيارة تعيق حركة المرور',
        LIGHTS_ON: 'الأنوار تعمل دون داعٍ',
        CAR_INCIDENT: 'حدث طارئ للسيارة',
        CONSTRUCTION: 'أعمال أو إنشاءات في الموقع',
        OTHER: 'رسالة بخصوص سيارتك',
      };

      const reasonArabic = reasonMap[contactReason] || 'تنبيه بخصوص سيارتك';

      // Insert Initial Message if present
      if (initialMessage && initialMessage.trim().length > 0) {
        await prisma.message.create({
          data: {
            chatId: chat.id,
            senderType: 'REPORTER',
            content: initialMessage.trim().substring(0, 500),
            imageUrl: imageUrl || null,
            isViewOnce: Boolean(isViewOnce),
          },
        });
      }

      // Send instant push notification to Car Owner
      await prisma.notification.create({
        data: {
          userId: tag.car.userId,
          carId: tag.car.id,
          tagCode: tag.tagCode,
          type: 'CAR_ALERT',
          title: reasonArabic,
          message: initialMessage ? `بلاغ جديد: "${initialMessage.trim().substring(0, 80)}..."` : `تواصل شخص معك بخصوص: ${reasonArabic}`,
          actionLabel: 'فتح المحادثة',
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم إرسال بلاغك وتنبيه صاحب السيارة بنجاح ومجهول الهوية بالكامل',
        chatId: chat.id,
        sessionToken: reporterToken,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إنشاء المحادثة' });
    }
  }

  /**
   * إرسال رسالة إضافية من المُبلّغ
   */
  static async sendReporterMessage(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.chatId as string;
      const { content, sessionToken, imageUrl, isViewOnce } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ success: false, message: 'نص الرسالة مطلوب' });
        return;
      }

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: { car: true },
      });

      if (!chat) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      if (chat.status === 'BLOCKED') {
        res.status(403).json({ success: false, message: 'هذه المحادثة تم إغلاقها' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          senderType: 'REPORTER',
          content: content.trim().substring(0, 500),
          imageUrl: imageUrl || null,
          isViewOnce: Boolean(isViewOnce),
        },
      });

      await prisma.chat.update({
        where: { id: chat.id },
        data: { lastMessageAt: new Date() },
      });

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إرسال الرسالة' });
    }
  }

  /**
   * إبلاغ المُبلّغ المجهول عن محادثة مسيئة أو صورة غير لائقة
   */
  static async reportChat(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.chatId as string;
      const { reason, details } = req.body;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
      });

      if (!chat) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      const report = await prisma.chatReport.create({
        data: {
          chatId: chat.id,
          reporterType: 'REPORTER',
          reason: reason || 'HARASSMENT',
          details: details || null,
          status: 'PENDING',
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم استلام البلاغ بنجاح وسيقوم فريق الرقابة بفحص المحادثة فوراً 🛡️',
        report,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تقديم البلاغ' });
    }
  }
}

