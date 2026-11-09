import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { webRateLimitService } from '../services/webRateLimit.service';
import { ChatExpiryService } from '../services/chatExpiry.service';

export class ChatsController {
  /**
   * جلب كافة محادثات صاحب السيارة (مع دعم فلترة الكل أو غير المقروءة)
   */
  static async getChats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = (req.query.filter as string) || 'all'; // all, unread

      // Find all cars belonging to this owner
      const userCars = await prisma.car.findMany({
        where: { userId: req.user!.id },
        select: { id: true },
      });
      const carIds = userCars.map((c) => c.id);

      const chats = await prisma.chat.findMany({
        where: {
          carId: { in: carIds },
        },
        include: {
          car: {
            select: {
              brand: true,
              model: true,
              nickname: true,
              plateNumber: true,
              colorName: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      const formatted = chats.map((ch) => {
        const lastMsg = ch.messages[0];
        const unread = lastMsg ? !lastMsg.isRead && lastMsg.senderType === 'REPORTER' : false;

        let currentStatus = ch.status;
        if (currentStatus !== 'EXPIRED' && currentStatus !== 'BLOCKED' && currentStatus !== 'CLOSED') {
          if (ChatExpiryService.isChatExpired(ch)) {
            currentStatus = 'EXPIRED';
            prisma.chat.update({ where: { id: ch.id }, data: { status: 'EXPIRED' } }).catch(() => {});
          }
        }

        return {
          id: ch.id,
          carTitle: ch.car.nickname || `${ch.car.brand} ${ch.car.model}`,
          carColor: ch.car.colorName,
          contactReason: ch.contactReason,
          status: currentStatus,
          lastMessage: lastMsg?.content || 'صورة مرفقة',
          lastMessageTime: lastMsg?.createdAt || ch.createdAt,
          hasUnread: unread,
        };
      });

      const filtered = filter === 'unread' ? formatted.filter((c) => c.hasUnread) : formatted;

      res.json({
        success: true,
        chats: filtered,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب المحادثات' });
    }
  }

  /**
   * جلب رسائل محادثة معينة
   */
  static async getMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: {
          car: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!chat || chat.car.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة أو ليست في حسابك' });
        return;
      }

      // Mark reporter messages as read
      await prisma.message.updateMany({
        where: {
          chatId: chat.id,
          senderType: 'REPORTER',
          isRead: false,
        },
        data: { isRead: true },
      });

      // Check if expired after 5 hours without owner reply
      let chatStatus = chat.status;
      if (chatStatus !== 'EXPIRED' && chatStatus !== 'BLOCKED' && chatStatus !== 'CLOSED') {
        if (ChatExpiryService.isChatExpired(chat)) {
          chatStatus = 'EXPIRED';
          await prisma.chat.update({
            where: { id: chat.id },
            data: { status: 'EXPIRED' },
          });
        }
      }

      res.json({
        success: true,
        chat: {
          id: chat.id,
          contactReason: chat.contactReason,
          status: chatStatus,
          carTitle: chat.car.nickname || `${chat.car.brand} ${chat.car.model}`,
          messages: chat.messages,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب الرسائل' });
    }
  }

  /**
   * رد صاحب السيارة على المُبلّغ
   */
  static async reply(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ success: false, message: 'نص الرسالة مطلوب' });
        return;
      }

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: { car: true },
      });

      if (!chat || chat.car.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      if (chat.status === 'BLOCKED') {
        res.status(403).json({ success: false, message: 'المحادثة محظورة' });
        return;
      }

      if (chat.status === 'EXPIRED' || chat.status === 'CLOSED' || ChatExpiryService.isChatExpired(chat)) {
        if (chat.status !== 'EXPIRED' && chat.status !== 'CLOSED') {
          await prisma.chat.update({
            where: { id: chat.id },
            data: { status: 'EXPIRED' },
          });
        }
        res.status(403).json({ success: false, message: 'انتهت مهلة الرد على هذه المحادثة (مرور 5 ساعات دون رد).' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          chatId: chat.id,
          senderType: 'OWNER',
          content: content.trim().substring(0, 500),
          isRead: false,
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
      res.status(500).json({ success: false, message: 'تعذر إرسال الرد' });
    }
  }

  /**
   * حظر المحادثة
   */
  static async block(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: { car: true },
      });

      if (!chat || chat.car.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      await prisma.chat.update({
        where: { id },
        data: { status: 'BLOCKED' },
      });

      res.json({
        success: true,
        message: 'تم حظر المحادثة بنجاح، ولن يتم استقبال أي رسائل جديدة منها',
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر حظر المحادثة' });
    }
  }

  /**
   * إبلاغ صاحب السيارة عن محادثة مسيئة أو تجاوز للحدود
   */
  static async reportChat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { reason, details } = req.body;

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: { car: true },
      });

      if (!chat || chat.car.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة' });
        return;
      }

      const report = await prisma.chatReport.create({
        data: {
          chatId: chat.id,
          reporterType: 'OWNER',
          reason: reason || 'HARASSMENT',
          details: details || null,
          status: 'PENDING',
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم استلام بلاغك بنجاح وسيقوم فريق الرقابة بمراجعة المحادثة فوراً 🛡️',
        report,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تقديم البلاغ' });
    }
  }

  /**
   * اتخاذ إجراء على المحادثة من قبل صاحب السيارة (فتح المحادثة، تجاهل، إبلاغ، إغلاق)
   */
  static async handleAction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { action, reportReason, reportDetails } = req.body; // 'OPEN', 'IGNORE', 'REPORT', 'CLOSE'

      const chat = await prisma.chat.findUnique({
        where: { id },
        include: { car: true },
      });

      if (!chat || chat.car.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة أو ليست في حسابك' });
        return;
      }

      if (action === 'OPEN' && (chat.status === 'EXPIRED' || ChatExpiryService.isChatExpired(chat))) {
        if (chat.status !== 'EXPIRED') {
          await prisma.chat.update({
            where: { id },
            data: { status: 'EXPIRED' },
          });
        }
        res.status(403).json({ success: false, message: 'انتهت صلاحية المحادثة لمرور 5 ساعات دون رد.' });
        return;
      }

      if (action === 'OPEN') {
        const updated = await prisma.chat.update({
          where: { id },
          data: { status: 'ACTIVE', lastMessageAt: new Date() },
        });

        await prisma.message.create({
          data: {
            chatId: id,
            senderType: 'SYSTEM',
            content: 'قام صاحب السيارة بفتح المحادثة، يمكنكما التحدث الآن.',
          },
        });

        res.json({ success: true, message: 'تم فتح المحادثة بنجاح ✨', chat: updated });
        return;
      }

      if (action === 'IGNORE') {
        const updated = await prisma.chat.update({
          where: { id },
          data: { status: 'IGNORED', lastMessageAt: new Date() },
        });

        const reporterIp = webRateLimitService.getIpBySession(chat.reporterSessionToken);
        if (reporterIp) {
          webRateLimitService.blockIpForCar(reporterIp, chat.carId, 'IGNORED');
        }

        await prisma.message.create({
          data: {
            chatId: id,
            senderType: 'SYSTEM',
            content: 'صاحب السيارة مشغول الآن ولا يمكنه الرد في الوقت الحالي.',
          },
        });

        res.json({ success: true, message: 'تم تجاهل الطلب وإرسال إشعار للمُبلّغ بأنك مشغول', chat: updated });
        return;
      }

      if (action === 'REPORT') {
        const updated = await prisma.chat.update({
          where: { id },
          data: { status: 'BLOCKED', lastMessageAt: new Date() },
        });

        const reporterIp = webRateLimitService.getIpBySession(chat.reporterSessionToken);
        if (reporterIp) {
          webRateLimitService.blockIpForCar(reporterIp, chat.carId, 'BLOCKED');
        }

        await prisma.chatReport.create({
          data: {
            chatId: id,
            reporterType: 'OWNER',
            reason: reportReason || 'HARASSMENT',
            details: reportDetails || 'تم الإبلاغ والحظر المباشر من شاشة القرار',
            status: 'PENDING',
          },
        });

        await prisma.message.create({
          data: {
            chatId: id,
            senderType: 'SYSTEM',
            content: 'تم حظر هذه المحادثة وإرسال بلاغ عاجل للإدارة والرقابة 🛡️.',
          },
        });

        res.json({ success: true, message: 'تم حظر المحادثة وإرسال البلاغ للإدارة بنجاح', chat: updated });
        return;
      }

      if (action === 'CLOSE') {
        const updated = await prisma.chat.update({
          where: { id },
          data: { status: 'CLOSED', lastMessageAt: new Date() },
        });

        await prisma.message.create({
          data: {
            chatId: id,
            senderType: 'SYSTEM',
            content: 'تم إغلاق المحادثة بنجاح من قبل صاحب السيارة.',
          },
        });

        res.json({ success: true, message: 'تم إغلاق المحادثة', chat: updated });
        return;
      }

      res.status(400).json({ success: false, message: 'إجراء غير مدعوم' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تنفيذ الإجراء' });
    }
  }

  /**
   * تحديد الصورة المعروضة لمرة واحدة كمشاهدة (احترقت الصورة)
   */
  static async markMessageViewed(req: AuthRequest, res: Response): Promise<void> {
    try {
      const messageId = req.params.messageId as string;
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { chat: { include: { car: true } } },
      });

      if (!message) {
        res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        return;
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { isViewed: true },
      });

      res.json({ success: true, message: 'تمت مشاهدة الصورة' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تحديث حالة المشاهدة' });
    }
  }
}

