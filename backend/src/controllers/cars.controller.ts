import { Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export class CarsController {
  /**
   * جلب كافة سيارات المستخدم المسجل مع بيانات الـ Tag المرتبط
   */
  static async getCars(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cars = await prisma.car.findMany({
        where: { userId: req.user!.id },
        include: {
          tag: {
            select: {
              id: true,
              tagCode: true,
              status: true,
              tagType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = cars.map((c) => ({
        id: c.id,
        brand: c.brand,
        model: c.model,
        year: c.year,
        plateNumber: c.plateNumber,
        colorName: c.colorName,
        nickname: c.nickname,
        isActivated: c.isActivated && c.tag !== null,
        isTagActive: c.isTagActive && c.tag !== null && c.tag.status === 'ACTIVE',
        tagCode: c.tag?.tagCode || null,
        tagStatus: c.tag?.status || 'UNASSIGNED',
        tagType: c.tag?.tagType || null,
        displayTitle: c.nickname?.trim() ? c.nickname : `${c.brand} ${c.model}`,
      }));

      res.json({ success: true, cars: formatted });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب قائمة السيارات' });
    }
  }

  /**
   * إضافة سيارة جديدة (افتراضياً: غير مفعلة وبدون Tag)
   */
  static async addCar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { brand, model, year, plateNumber, colorName, nickname, tagCode } = req.body;

      if (!model) {
        res.status(400).json({ success: false, message: 'موديل السيارة مطلوب' });
        return;
      }

      const finalBrand = (brand && brand.trim()) || 'Toyota';
      const finalModel = model.trim();
      const finalColor = colorName || 'أبيض لؤلؤي';

      // Check optional tag code if user provided one during addition
      let linkedTagId: string | null = null;
      let isActivated = false;

      if (tagCode && typeof tagCode === 'string') {
        const cleanTag = tagCode.trim().startsWith('#') ? tagCode.trim() : `#${tagCode.trim()}`;
        const tag = await prisma.tag.findUnique({ where: { tagCode: cleanTag } });

        if (tag) {
          // Check 1 Car = 1 Tag rule: Ensure tag is not already linked to another car
          if (tag.carId) {
            res.status(400).json({ success: false, message: 'هذا الـ Tag مرتبط بالفعل بسيارة أخرى' });
            return;
          }
          linkedTagId = tag.id;
          isActivated = true;
        }
      }

      const newCar = await prisma.car.create({
        data: {
          userId: req.user!.id,
          brand: finalBrand,
          model: finalModel,
          year: year || '',
          plateNumber: plateNumber || '',
          colorName: finalColor,
          nickname: nickname || null,
          isActivated,
          isTagActive: isActivated,
        },
      });

      // If valid tag was linked
      if (linkedTagId) {
        await prisma.tag.update({
          where: { id: linkedTagId },
          data: {
            carId: newCar.id,
            userId: req.user!.id,
            status: 'ACTIVE',
            activatedAt: new Date(),
          },
        });
      }

      res.status(201).json({
        success: true,
        message: isActivated ? 'تمت إضافة وتفعيل السيارة بنجاح' : 'تمت إضافة السيارة بنجاح (غير مفعّلة - يلزم ربط Tag)',
        car: {
          ...newCar,
          tagCode: tagCode || null,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إضافة السيارة' });
    }
  }

  /**
   * تعديل بيانات السيارة (الموديل، الاسم المستعار، اللون، اللوحة)
   */
  static async updateCar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { brand, model, year, plateNumber, colorName, nickname } = req.body;

      const car = await prisma.car.findFirst({
        where: { id, userId: req.user!.id },
      });

      if (!car) {
        res.status(404).json({ success: false, message: 'السيارة غير موجودة أو ليست في حسابك' });
        return;
      }

      const updated = await prisma.car.update({
        where: { id },
        data: {
          ...(brand !== undefined && { brand }),
          ...(model !== undefined && { model }),
          ...(year !== undefined && { year }),
          ...(plateNumber !== undefined && { plateNumber }),
          ...(colorName !== undefined && { colorName }),
          ...(nickname !== undefined && { nickname }),
        },
      });

      res.json({
        success: true,
        message: 'تم تحديث بيانات السيارة بنجاح',
        car: updated,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تعديل السيارة' });
    }
  }

  /**
   * حذف السيارة وتحرير الـ Tag المرتبط بها تلقائياً
   */
  static async deleteCar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const car = await prisma.car.findFirst({
        where: { id, userId: req.user!.id },
        include: { tag: true },
      });

      if (!car) {
        res.status(404).json({ success: false, message: 'السيارة غير موجودة' });
        return;
      }

      // If car has a linked tag, free it back to unassigned in owner's inventory
      if (car.tag) {
        await prisma.tag.update({
          where: { id: car.tag.id },
          data: {
            carId: null,
            status: 'UNASSIGNED',
          },
        });
      }

      await prisma.car.delete({ where: { id } });

      res.json({
        success: true,
        message: 'تم حذف السيارة بنجاح، وأصبح الـ Tag متاحاً لربطه بسيارة أخرى',
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر حذف السيارة' });
    }
  }
}
