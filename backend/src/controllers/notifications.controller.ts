import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export class NotificationsController {
  /**
   * جلب كافة الإشعارات مع دعم الفلاتر الأربعة
   */
  static async getNotifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const filter = (req.query.filter as string) || 'all'; // all, unread, cars, tags

      let whereClause: any = { userId: req.user!.id };

      if (filter === 'unread') {
        whereClause.isRead = false;
      } else if (filter === 'cars') {
        whereClause.type = { in: ['CAR_ALERT', 'SECURITY'] };
      } else if (filter === 'tags') {
        whereClause.type = 'TAG_SCAN';
      }

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        include: {
          car: {
            select: {
              brand: true,
              model: true,
              plateNumber: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const unreadCount = await prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      });

      res.json({
        success: true,
        unreadCount,
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          actionLabel: n.actionLabel,
          isRead: n.isRead,
          tagCode: n.tagCode,
          carName: n.car ? (n.car.nickname || `${n.car.brand} ${n.car.model}`) : null,
          plateNumber: n.car?.plateNumber || null,
          createdAt: n.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب الإشعارات' });
    }
  }

  /**
   * تحديد كافة الإشعارات كمقروءة
   */
  static async markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true },
      });

      res.json({ success: true, message: 'تم تحديد كافة الإشعارات كمقروءة' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تحديث الإشعارات' });
    }
  }

  /**
   * حذف إشعار محدد
   */
  static async deleteNotification(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const notif = await prisma.notification.findFirst({
        where: { id, userId: req.user!.id },
      });

      if (!notif) {
        res.status(404).json({ success: false, message: 'الإشعار غير موجود' });
        return;
      }

      await prisma.notification.delete({ where: { id } });
      res.json({ success: true, message: 'تم حذف الإشعار بنجاح' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر حذف الإشعار' });
    }
  }

  /**
   * مسح جميع الإشعارات
   */
  static async clearAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      await prisma.notification.deleteMany({
        where: { userId: req.user!.id },
      });

      res.json({ success: true, message: 'تم مسح كافة الإشعارات' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر مسح الإشعارات' });
    }
  }
}
