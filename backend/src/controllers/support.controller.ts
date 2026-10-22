import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export class SupportController {
  /**
   * جلب رسائل المحادثة النشطة الحالية للمستخدم
   * في حال تم إغلاق المحادثة السابقة من قِبل الإدارة، يتم إرجاع مصفوفة فارغة لتبدأ محادثة جديدة نظيفة في التطبيق
   */
  static async getMyMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      // البحث عن التذكرة المفتوحة الحالية
      let activeTicket = await prisma.supportTicket.findFirst({
        where: { userId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });

      // إذا كانت هناك رسائل قديمة بدون تذكرة، نربطها بأول تذكرة
      if (!activeTicket) {
        const orphanCount = await prisma.supportMessage.count({
          where: { userId, ticketId: null },
        });

        if (orphanCount > 0) {
          activeTicket = await prisma.supportTicket.create({
            data: { userId, status: 'OPEN' },
          });
          await prisma.supportMessage.updateMany({
            where: { userId, ticketId: null },
            data: { ticketId: activeTicket.id },
          });
        }
      }

      // إذا لم تكن هناك أي تذكرة مفتوحة (المحادثة مغلقة)، يرجع التطبيق شاشة نظيفة
      if (!activeTicket) {
        res.json({
          success: true,
          ticket: null,
          isClosed: true,
          messages: [],
        });
        return;
      }

      const messages = await prisma.supportMessage.findMany({
        where: { ticketId: activeTicket.id },
        orderBy: { createdAt: 'asc' },
      });

      // تحديد رسائل الدعم الفني كمقروءة للمستخدم
      await prisma.supportMessage.updateMany({
        where: {
          ticketId: activeTicket.id,
          senderType: 'SUPPORT',
          isRead: false,
        },
        data: { isRead: true },
      });

      res.json({
        success: true,
        ticket: activeTicket,
        isClosed: false,
        messages,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب محادثة الدعم الفني' });
    }
  }

  /**
   * إرسال رسالة من المستخدم إلى فريق الدعم الفني
   * إذا كانت المحادثة السابقة مغلقة، يتم فتح تذكرة جديدة تلقائياً
   */
  static async sendMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { content, imageUrl } = req.body;

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        res.status(400).json({ success: false, message: 'نص الرسالة مطلوب' });
        return;
      }

      // البحث عن تذكرة مفتوحة أو إنشاء تذكرة جديدة فوراً
      let activeTicket = await prisma.supportTicket.findFirst({
        where: { userId, status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeTicket) {
        activeTicket = await prisma.supportTicket.create({
          data: {
            userId,
            status: 'OPEN',
          },
        });
      }

      const msg = await prisma.supportMessage.create({
        data: {
          userId,
          ticketId: activeTicket.id,
          senderType: 'USER',
          content: content.trim(),
          imageUrl: imageUrl || null,
        },
      });

      // تحديث وقت التذكرة
      await prisma.supportTicket.update({
        where: { id: activeTicket.id },
        data: { updatedAt: new Date() },
      });

      res.status(201).json({
        success: true,
        message: 'تم إرسال رسالتك لفريق الدعم الفني بنجاح',
        data: msg,
        ticket: activeTicket,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إرسال الرسالة للدعم الفني' });
    }
  }
}
