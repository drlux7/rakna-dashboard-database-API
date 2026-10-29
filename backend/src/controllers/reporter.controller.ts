import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
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

      const tag = await prisma.tag.findFirst({
        where: {
          OR: [
            { tagCode: cleanTag },
            { tagCode: tagCode },
            { secretToken: tagCode },
            { secretToken: cleanTag.replace(/^#/, '') },
            { secretToken: { startsWith: tagCode } },
            { secretToken: { startsWith: cleanTag.replace(/^#/, '') } },
          ],
        },
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

      // Check if the current scanner is the owner of the tag
      let isOwner = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rakna_super_secret_jwt_key_2026_veritag') as any;
          if (decoded && (tag.userId === decoded.id || tag.car?.userId === decoded.id)) {
            isOwner = true;
          }
        } catch (_) {}
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

      // If car is linked and active and NOT scanned by the owner himself, create scan notification
      if (tag.car && tag.status === 'ACTIVE' && tag.car.isTagActive && !isOwner) {
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
          isOwner,
        },
        car: tag.car
          ? {
              id: tag.car.id,
              brand: tag.car.brand,
              model: tag.car.model,
              colorName: tag.car.colorName,
              displayTitle: tag.car.nickname || `${tag.car.brand} ${tag.car.model}`,
              allowFreeChat: tag.car.allowFreeChat ?? false,
              allowReporterPhotos: tag.car.allowReporterPhotos ?? true,
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

      // Check if the caller is the owner
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rakna_super_secret_jwt_key_2026_veritag') as any;
          if (decoded && (tag.userId === decoded.id || tag.car.userId === decoded.id)) {
            res.status(400).json({ success: false, message: 'أنت صاحب هذا الملصق، لا يمكنك محادثة نفسك 😅' });
            return;
          }
        } catch (_) {}
      }

      if (tag.status === 'PAUSED' || !tag.car.isTagActive) {
        res.status(400).json({ success: false, message: 'ملصق السيارة متوقف مؤقتاً حالياً من قبل المالك' });
        return;
      }

      const reporterToken = sessionToken || `rep_${uuidv4()}`;
      const COOLDOWN_SECONDS = 15;
      const MAX_UNANSWERED_MESSAGES = 5;

      // ──────────────── Check if an active chat already exists for this reporter & car ────────────────
      const existingChat = await prisma.chat.findFirst({
        where: {
          carId: tag.car.id,
          reporterSessionToken: reporterToken,
          status: 'ACTIVE',
          createdAt: { gt: new Date(Date.now() - 3 * 60 * 60 * 1000) }, // within last 3 hours
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingChat) {
        // Check cooldown since last reporter message
        const lastReporterMsg = await prisma.message.findFirst({
          where: { chatId: existingChat.id, senderType: 'REPORTER' },
          orderBy: { createdAt: 'desc' },
        });

        if (lastReporterMsg) {
          const elapsed = (Date.now() - new Date(lastReporterMsg.createdAt).getTime()) / 1000;
          if (elapsed < COOLDOWN_SECONDS) {
            const waitSec = Math.ceil(COOLDOWN_SECONDS - elapsed);
            res.status(429).json({
              success: false,
              message: `يرجى الانتظار ${waitSec} ثانية قبل إرسال رسالة أخرى منعاً للإزعاج.`,
              retryAfter: waitSec,
            });
            return;
          }
        }

        // Check unanswered quota
        const lastOwnerMsg = await prisma.message.findFirst({
          where: { chatId: existingChat.id, senderType: 'OWNER' },
          orderBy: { createdAt: 'desc' },
        });

        const reporterCount = await prisma.message.count({
          where: {
            chatId: existingChat.id,
            senderType: 'REPORTER',
            ...(lastOwnerMsg ? { createdAt: { gt: lastOwnerMsg.createdAt } } : {}),
          },
        });

        if (reporterCount >= MAX_UNANSWERED_MESSAGES) {
          res.status(429).json({
            success: false,
            message: `لقد أرسلت الحد الأقصى (${MAX_UNANSWERED_MESSAGES} رسائل). يرجى انتظار رد صاحب السيارة.`,
            limitReached: true,
            remainingMessages: 0,
          });
          return;
        }

        // Append initial message to existing chat
        if (initialMessage && initialMessage.trim().length > 0) {
          await prisma.message.create({
            data: {
              chatId: existingChat.id,
              senderType: 'REPORTER',
              content: initialMessage.trim().substring(0, 500),
              imageUrl: imageUrl || null,
              isViewOnce: Boolean(isViewOnce),
            },
          });

          await prisma.chat.update({
            where: { id: existingChat.id },
            data: { lastMessageAt: new Date() },
          });

          try {
            await prisma.notification.create({
              data: {
                userId: tag.car.userId,
                carId: tag.car.id,
                tagCode: tag.tagCode,
                type: 'CAR_ALERT',
                title: 'تنبيه جديد بخصوص سيارتك',
                message: `رسالة جديدة: "${initialMessage.trim().substring(0, 80)}"`,
                actionLabel: 'فتح المحادثة',
              },
            });
          } catch (_) {}
        }

        const remaining = Math.max(0, MAX_UNANSWERED_MESSAGES - (reporterCount + 1));

        res.status(200).json({
          success: true,
          message: 'تم إرسال بلاغك وتنبيه صاحب السيارة بنجاح ومجهول الهوية بالكامل',
          chatId: existingChat.id,
          chat: {
            id: existingChat.id,
            carId: existingChat.carId,
            contactReason: existingChat.contactReason,
            status: existingChat.status,
          },
          sessionToken: reporterToken,
          remainingMessages: remaining,
          cooldownSeconds: COOLDOWN_SECONDS,
        });
        return;
      }

      // Create new chat
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
        chat: {
          id: chat.id,
          carId: chat.carId,
          contactReason: chat.contactReason,
          status: chat.status,
        },
        sessionToken: reporterToken,
        remainingMessages: MAX_UNANSWERED_MESSAGES - 1,
        cooldownSeconds: COOLDOWN_SECONDS,
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

      const COOLDOWN_SECONDS = 15;
      const MAX_UNANSWERED_MESSAGES = 5;

      // ──────────────── 1. Anti-Spam Check: Cooldown between consecutive reporter messages ────────────────
      const lastReporterMessage = await prisma.message.findFirst({
        where: { chatId: chat.id, senderType: 'REPORTER' },
        orderBy: { createdAt: 'desc' },
      });

      if (lastReporterMessage) {
        const elapsedSec = (Date.now() - new Date(lastReporterMessage.createdAt).getTime()) / 1000;
        if (elapsedSec < COOLDOWN_SECONDS) {
          const waitSec = Math.ceil(COOLDOWN_SECONDS - elapsedSec);
          res.status(429).json({
            success: false,
            message: `يرجى الانتظار ${waitSec} ثانية قبل إرسال رسالة أخرى منعاً للإزعاج.`,
            retryAfter: waitSec,
          });
          return;
        }
      }

      // ──────────────── 2. Anti-Spam Check: Limit consecutive messages without owner reply ────────────────
      const lastOwnerMessage = await prisma.message.findFirst({
        where: { chatId: chat.id, senderType: 'OWNER' },
        orderBy: { createdAt: 'desc' },
      });

      const reporterMessagesCount = await prisma.message.count({
        where: {
          chatId: chat.id,
          senderType: 'REPORTER',
          ...(lastOwnerMessage ? { createdAt: { gt: lastOwnerMessage.createdAt } } : {}),
        },
      });

      if (reporterMessagesCount >= MAX_UNANSWERED_MESSAGES) {
        res.status(429).json({
          success: false,
          message: `لقد أرسلت الحد الأقصى (${MAX_UNANSWERED_MESSAGES} رسائل). يرجى انتظار رد صاحب السيارة.`,
          limitReached: true,
          remainingMessages: 0,
        });
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

      // Send instant push notification to Car Owner
      try {
        await prisma.notification.create({
          data: {
            userId: chat.car.userId,
            carId: chat.car.id,
            tagCode: '',
            type: 'CAR_ALERT',
            title: 'رسالة جديدة من المُبلّغ',
            message: content.trim().substring(0, 80),
            actionLabel: 'فتح المحادثة',
          },
        });
      } catch (notifErr) {
        console.error('Failed to create notification for reporter message:', notifErr);
      }

      const remaining = Math.max(0, MAX_UNANSWERED_MESSAGES - (reporterMessagesCount + 1));

      res.status(201).json({
        success: true,
        message,
        remainingMessages: remaining,
        cooldownSeconds: COOLDOWN_SECONDS,
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

  /**
   * جلب رسائل المحادثة للمُبلّغ المجهول لمتابعة ردود صاحب السيارة لحظياً
   */
  static async getReporterChatMessages(req: Request, res: Response): Promise<void> {
    try {
      const chatId = req.params.chatId as string;

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          car: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!chat) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      // تحديد رسائل المالك كمقروءة للمُبلّغ
      await prisma.message.updateMany({
        where: {
          chatId: chat.id,
          senderType: 'OWNER',
          isRead: false,
        },
        data: { isRead: true },
      });

      const MAX_UNANSWERED_MESSAGES = 5;
      const lastOwnerMsg = [...chat.messages].reverse().find((m) => m.senderType === 'OWNER');
      const reporterMsgsSince = chat.messages.filter((m) => {
        if (m.senderType !== 'REPORTER') return false;
        if (!lastOwnerMsg) return true;
        return new Date(m.createdAt) > new Date(lastOwnerMsg.createdAt);
      });
      const remaining = Math.max(0, MAX_UNANSWERED_MESSAGES - reporterMsgsSince.length);

      res.json({
        success: true,
        chat: {
          id: chat.id,
          status: chat.status,
          contactReason: chat.contactReason,
          carTitle: chat.car ? (chat.car.nickname || `${chat.car.brand} ${chat.car.model}`) : '',
          carColor: chat.car?.colorName || '',
        },
        messages: chat.messages,
        remainingMessages: remaining,
        limitReached: remaining <= 0,
        maxAllowed: MAX_UNANSWERED_MESSAGES,
        cooldownSeconds: 15,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب رسائل المحادثة' });
    }
  }

  /**
   * جلب كافة الرسائل السريعة المعتمدة النشطة لتطبيق ركنة
   */
  static async getQuickMessages(req: Request, res: Response): Promise<void> {
    try {
      const messages = await prisma.quickMessage.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({
        success: true,
        messages,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب الرسائل السريعة' });
    }
  }
}

