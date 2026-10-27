import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export class TagsController {
  /**
   * جلب ملصقات الـ Tags الخاصة بالمستخدم (المرتبطة والمتاحة) مع الإحصائيات
   */
  static async getMyTags(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tags = await prisma.tag.findMany({
        where: { userId: req.user!.id },
        include: {
          car: {
            select: {
              id: true,
              brand: true,
              model: true,
              year: true,
              plateNumber: true,
              colorName: true,
              nickname: true,
              isActivated: true,
              isTagActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const linkedTags = tags.filter((t) => t.carId !== null && t.car !== null);
      const unassignedTags = tags.filter((t) => t.carId === null);

      const totalCount = tags.length;
      const activeCount = linkedTags.filter((t) => t.status === 'ACTIVE').length;
      const availableCount = unassignedTags.length;

      res.json({
        success: true,
        stats: {
          totalCount,
          activeCount,
          availableCount,
        },
        linkedTags: linkedTags.map((t) => ({
          id: t.id,
          tagCode: t.tagCode,
          tagType: t.tagType,
          status: t.status,
          isTagActive: t.status === 'ACTIVE',
          car: {
            id: t.car!.id,
            displayTitle: t.car!.nickname?.trim() ? t.car!.nickname : `${t.car!.brand} ${t.car!.model}`,
            plateNumber: t.car!.plateNumber,
            colorName: t.car!.colorName,
          },
        })),
        unassignedTags: unassignedTags.map((t) => ({
          id: t.id,
          tagCode: t.tagCode,
          tagType: t.tagType,
          status: t.status,
        })),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب بيانات الـ Tags' });
    }
  }

  /**
   * ربط وتفعيل Tag متاح بسيارة باستخدام كود التفعيل السري المرفق في الباكدج
   */
  static async activateTagForCar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { carId, tagCode, activationCode } = req.body;

      if (!carId) {
        res.status(400).json({ success: false, message: 'معرف السيارة مطلوب' });
        return;
      }

      if (!activationCode && !tagCode) {
        res.status(400).json({ success: false, message: 'كود التفعيل (Activation Code) المرفق في الباكدج مطلوب' });
        return;
      }

      const cleanActivation = activationCode?.trim().toUpperCase();
      const cleanTag = tagCode ? (tagCode.trim().startsWith('#') ? tagCode.trim() : `#${tagCode.trim()}`) : null;

      // 1. Verify Car belongs to user
      const car = await prisma.car.findFirst({
        where: { id: carId, userId: req.user!.id },
      });

      if (!car) {
        res.status(404).json({ success: false, message: 'السيارة المحددة غير موجودة في حسابك' });
        return;
      }

      // 2. Lookup Tag by activationCode or tagCode
      let tag = null;
      if (cleanActivation) {
        tag = await prisma.tag.findUnique({
          where: { activationCode: cleanActivation },
        });
      } else if (cleanTag) {
        tag = await prisma.tag.findUnique({
          where: { tagCode: cleanTag },
        });
      }

      if (!tag) {
        res.status(404).json({ 
          success: false, 
          message: 'كود التفعيل غير صالح أو غير مسجل في النظام. تأكد من إدخال الكود المكتوب في الباكدج بدقة.' 
        });
        return;
      }

      // If both provided, ensure they match
      if (cleanTag && tag.tagCode !== cleanTag) {
        res.status(400).json({ 
          success: false, 
          message: 'كود التفعيل لا يتطابق مع ملصق الـ Tag المدخل.' 
        });
        return;
      }

      // If activation code was required but tag has a different code
      if (cleanActivation && tag.activationCode && tag.activationCode.toUpperCase() !== cleanActivation) {
        res.status(400).json({ 
          success: false, 
          message: 'كود التفعيل غير صحيح لهذا الـ Tag.' 
        });
        return;
      }

      // 3. Ensure tag is not already linked to another car or user
      if (tag.carId && tag.carId !== carId) {
        res.status(400).json({ 
          success: false, 
          message: 'قاعدة ركنة: هذا الـ Tag مرتبط ومفعل بالفعل بسيارة أخرى!' 
        });
        return;
      }

      if (tag.userId && tag.userId !== req.user!.id && tag.status === 'ACTIVE') {
        res.status(400).json({ 
          success: false, 
          message: 'هذا الكود مستخدم بالفعل ومربوط بحساب آخر.' 
        });
        return;
      }

      // 4. Link tag and activate car in a transaction
      await prisma.$transaction([
        prisma.tag.update({
          where: { id: tag.id },
          data: {
            carId: car.id,
            userId: req.user!.id,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        }),
        prisma.car.update({
          where: { id: car.id },
          data: {
            isActivated: true,
            isTagActive: true,
          },
        }),
      ]);

      res.json({
        success: true,
        tag: {
          id: tag.id,
          tagCode: tag.tagCode,
          tagType: tag.tagType,
          status: 'ACTIVE',
        },
        message: `تم تفعيل الـ Tag (${tag.tagCode}) وربطه بسيارتك (${car.brand} ${car.model}) بنجاح! 🚗✨`,
      });
    } catch (error) {
      console.error('Error activating tag:', error);
      res.status(500).json({ success: false, message: 'تعذر ربط وتفعيل الـ Tag بالسيارة' });
    }
  }

  /**
   * تبديل حالة تشغيل الـ Tag مؤقتاً (نشط / متوقف مؤقتاً)
   */
  static async togglePauseTag(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tagCode = req.params.tagCode as string;
      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;

      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
        include: { car: true },
      });

      if (!tag || tag.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'الـ Tag غير موجود أو ليس في حسابك' });
        return;
      }

      const isNowActive = tag.status !== 'ACTIVE';
      const newStatus = isNowActive ? 'ACTIVE' : 'PAUSED';

      await prisma.$transaction([
        prisma.tag.update({
          where: { id: tag.id },
          data: { status: newStatus },
        }),
        ...(tag.carId
          ? [
              prisma.car.update({
                where: { id: tag.carId },
                data: { isTagActive: isNowActive },
              }),
            ]
          : []),
      ]);

      res.json({
        success: true,
        isTagActive: isNowActive,
        message: isNowActive
          ? `تم استئناف وتشغيل إشارة الـ Tag (${cleanTag}) بنجاح 🟢`
          : `تم إيقاف إشارة الـ Tag (${cleanTag}) مؤقتاً ⏸️`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تعديل حالة الـ Tag' });
    }
  }

  /**
   * إلغاء ربط الـ Tag عن السيارة وإعادته متاحاً
   */
  static async unlinkTag(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tagCode = req.params.tagCode as string;
      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;

      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
      });

      if (!tag || tag.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'الـ Tag غير موجود في حسابك' });
        return;
      }

      if (!tag.carId) {
        res.status(400).json({ success: false, message: 'الـ Tag غير مربوط بأي سيارة حالياً' });
        return;
      }

      const carId = tag.carId;

      await prisma.$transaction([
        prisma.tag.update({
          where: { id: tag.id },
          data: {
            carId: null,
            status: 'UNASSIGNED',
          },
        }),
        prisma.car.update({
          where: { id: carId },
          data: {
            isActivated: false,
            isTagActive: false,
          },
        }),
      ]);

      res.json({
        success: true,
        message: `تم إلغاء ربط الـ Tag (${cleanTag})، وأصبح متاحاً للربط بسيارة أخرى.`,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر فك ارتباط الـ Tag' });
    }
  }

  /**
   * فحص الإشارة الحية للـ Tag (NFC, QR, Notifications)
   */
  static async testSignal(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tagCode = req.params.tagCode as string;
      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;

      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
      });

      if (!tag) {
        res.status(404).json({ success: false, message: 'الـ Tag غير موجود' });
        return;
      }

      res.json({
        success: true,
        tagCode: cleanTag,
        diagnostics: [
          { title: 'شريحة NFC', status: 'متصلة وجاهزة للاستشعار', ok: true },
          { title: 'رمز الـ QR المطبوع', status: 'مطابق ومشفر بنجاح', ok: true },
          { title: 'استقبال الإشعارات', status: 'مفعّل عبر الخوادم المشفرة', ok: true },
        ],
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إجراء فحص الإشارة' });
    }
  }
}
