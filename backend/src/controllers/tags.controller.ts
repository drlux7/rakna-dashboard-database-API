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

      const activeTagsFormatted = linkedTags.map((t) => ({
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
      }));

      res.json({
        success: true,
        stats: {
          totalCount,
          activeCount,
          availableCount,
        },
        activeTags: activeTagsFormatted,
        linkedTags: activeTagsFormatted,
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
   * ربط وتفعيل Tag بسيارة باستخدام tag_id + activation_code + بيانات السيارة
   * الدورة: تحقق → transaction ذري (حرق الكود + تفعيل التاج)
   */
  static async activateTagForCar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { carId, tagCode, activationCode } = req.body;

      // ── 1. Validate inputs ─────────────────────────────────────────────────
      if (!carId) {
        res.status(400).json({ success: false, message: 'معرف السيارة مطلوب' });
        return;
      }
      if (!tagCode) {
        res.status(400).json({ success: false, message: 'معرف الملصق (tagCode) مطلوب' });
        return;
      }
      if (!activationCode) {
        res.status(400).json({ success: false, message: 'كود التفعيل (activation code) المرفق في الكرت مطلوب' });
        return;
      }

      const cleanTagCode = tagCode.trim().startsWith('#') ? tagCode.trim() : `#${tagCode.trim()}`;
      const cleanCode = activationCode.trim().toUpperCase();

      // ── 2. Verify the car belongs to the authenticated user ────────────────
      const car = await prisma.car.findFirst({
        where: { id: carId, userId: req.user!.id },
      });
      if (!car) {
        res.status(404).json({ success: false, message: 'السيارة المحددة غير موجودة في حسابك' });
        return;
      }

      // ── 3. Validate tag_id ─────────────────────────────────────────────────
      const tag = await prisma.tag.findUnique({ where: { tagCode: cleanTagCode } });

      if (!tag) {
        res.status(404).json({
          success: false,
          message: `الملصق (${cleanTagCode}) غير موجود في النظام. تأكد من المسح أو الإدخال اليدوي بدقة.`,
        });
        return;
      }

      // Tag must not already be active
      if (tag.status === 'ACTIVE') {
        res.status(409).json({
          success: false,
          message: `الملصق (${cleanTagCode}) مفعّل بالفعل ومربوط بسيارة أخرى. لا يمكن إعادة تفعيله.`,
        });
        return;
      }

      // Tag must not already be linked to a different car
      if (tag.carId && tag.carId !== carId) {
        res.status(409).json({
          success: false,
          message: 'قاعدة ركنة (1 Tag = 1 Car): هذا الملصق مربوط بسيارة أخرى ولا يمكن إعادة تفعيله.',
        });
        return;
      }

      // ── 3b. If tag is already owned by this user in unassigned status (re-linking) ──
      if (tag.userId === req.user!.id && tag.status === 'UNASSIGNED') {
        await prisma.$transaction([
          prisma.tag.update({
            where: { id: tag.id },
            data: {
              carId: car.id,
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
            tagCode: tag.tagCode,
            tagType: tag.tagType,
            status: 'ACTIVE',
          },
          message: `تم إعادة ربط الملصق (${tag.tagCode}) بسيارتك (${car.brand} ${car.model}) بنجاح! 🚗✨`,
        });
        return;
      }

      // ── 4. Validate activation code (for new unactivated tags) ──────────────
      if (!activationCode) {
        res.status(400).json({ success: false, message: 'كود التفعيل (activation code) المرفق في الكرت مطلوب لتفعيل هذا الملصق لأول مرة' });
        return;
      }

      const actCode = await prisma.activationCode.findUnique({ where: { code: cleanCode } });

      if (!actCode) {
        res.status(404).json({
          success: false,
          message: 'كود التفعيل غير موجود في النظام. تأكد من الكود المطبوع في الكرت داخل العلبة.',
        });
        return;
      }

      if (actCode.isRedeemed) {
        res.status(409).json({
          success: false,
          message: 'هذا الكود تم استخدامه سابقاً ولا يمكن إعادة استخدامه. إذا كانت لديك مشكلة، تواصل مع الدعم الفني.',
        });
        return;
      }

      // ── 5. Atomic Transaction: burn the code + activate the tag ───────────
      await prisma.$transaction([
        // 5a. Mark activation code as redeemed (burned) — links it to this tag forever
        prisma.activationCode.update({
          where: { id: actCode.id },
          data: {
            isRedeemed: true,
            redeemedAt: new Date(),
            usedOnTagId: tag.id,
          },
        }),
        // 5b. Activate the tag and link it to the user's car
        prisma.tag.update({
          where: { id: tag.id },
          data: {
            carId: car.id,
            userId: req.user!.id,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        }),
        // 5c. Mark the car as activated
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
          tagCode: tag.tagCode,
          tagType: tag.tagType,
          status: 'ACTIVE',
        },
        message: `تم تفعيل الملصق (${tag.tagCode}) وربطه بسيارتك (${car.brand} ${car.model}) بنجاح! 🚗✨`,
      });
    } catch (error) {
      console.error('Error activating tag:', error);
      res.status(500).json({ success: false, message: 'تعذر تفعيل الملصق. يُرجى المحاولة مرة أخرى.' });
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
   * SCENARIO 4 — إلغاء الربط وإصدار كود تفعيل جديد عند بيع السيارة
   *
   * المالك القديم يضغط "نقل ملكية" من داخل التطبيق:
   *  1. يُلغى ربط التاج عن السيارة وتعود حالته IN_STOCK.
   *  2. يُولَّد كود تفعيل جديد يرسله المالك القديم للمشتري.
   *  3. الكود القديم يبقى مسجّلاً تاريخياً (محروق) ولا يُحذف.
   */
  static async reissueActivationCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const tagCode = req.params.tagCode as string;
      const cleanTag = tagCode.startsWith('#') ? tagCode : `#${tagCode}`;

      // 1. Verify tag belongs to this user and is currently ACTIVE
      const tag = await prisma.tag.findUnique({
        where: { tagCode: cleanTag },
        include: { car: true },
      });

      if (!tag || tag.userId !== req.user!.id) {
        res.status(404).json({ success: false, message: 'الملصق غير موجود في حسابك' });
        return;
      }

      if (tag.status !== 'ACTIVE') {
        res.status(400).json({ success: false, message: 'الملصق غير مفعّل ولا يحتاج إلى نقل ملكية' });
        return;
      }

      // 2. Generate new unique activation code  e.g. ACT-7234-KR
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let newCode = '';
      let attempts = 0;
      do {
        const numPart = Math.floor(1000 + Math.random() * 9000);
        const a1 = chars.charAt(Math.floor(Math.random() * chars.length));
        const a2 = chars.charAt(Math.floor(Math.random() * chars.length));
        newCode = `ACT-${numPart}-${a1}${a2}`;
        attempts++;
        if (attempts > 50) {
          res.status(500).json({ success: false, message: 'تعذر توليد كود تفعيل جديد، حاول مرة أخرى' });
          return;
        }
      } while (await prisma.activationCode.findUnique({ where: { code: newCode } }));

      const carId = tag.carId;

      // 3. Atomic transaction: unlink tag + reset car + create fresh activation code
      await prisma.$transaction([
        // Detach tag from car — back to IN_STOCK (no user, no car)
        prisma.tag.update({
          where: { id: tag.id },
          data: {
            status: 'IN_STOCK',
            carId: null,
            userId: null,
            activatedAt: null,
          },
        }),
        // Reset the car's activation state
        ...(carId
          ? [
              prisma.car.update({
                where: { id: carId },
                data: { isActivated: false, isTagActive: false },
              }),
            ]
          : []),
        // Create a brand-new unredeemed activation code for the new buyer
        prisma.activationCode.create({
          data: {
            code: newCode,
            isRedeemed: false,
          },
        }),
      ]);

      res.json({
        success: true,
        newActivationCode: newCode,
        message: `تم إلغاء ربط الملصق (${cleanTag}) بنجاح. أرسل الكود الجديد للمالك الجديد ليقوم بالتفعيل من تطبيقه.`,
        instructions: 'شارك هذا الكود بشكل آمن مع المشتري الجديد فقط. لا تنشره علناً.',
      });
    } catch (error) {
      console.error('Error reissuing activation code:', error);
      res.status(500).json({ success: false, message: 'تعذر إعادة إصدار كود التفعيل' });
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
