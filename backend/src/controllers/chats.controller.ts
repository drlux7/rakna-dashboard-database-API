import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

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
            take: 1, // Last message
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      });

      const formatted = chats.map((ch) => {
        const lastMsg = ch.messages[0];
        const unread = lastMsg ? !lastMsg.isRead && lastMsg.senderType === 'REPORTER' : false;

        return {
          id: ch.id,
          carTitle: ch.car.nickname || `${ch.car.brand} ${ch.car.model}`,
          carColor: ch.car.colorName,
          contactReason: ch.contactReason,
          status: ch.status,
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

      res.json({
        success: true,
        chat: {
          id: chat.id,
          contactReason: chat.contactReason,
          status: chat.status,
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
}
