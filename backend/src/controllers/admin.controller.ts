import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { whatsAppService } from '../services/whatsapp.service';

const JWT_SECRET = process.env.JWT_SECRET || 'rakna_secret_default_key';

export class AdminController {
  /**
   * تسجيل دخول مشرفي لوحة التحكم
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ success: false, message: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
        return;
      }

      const admin = await prisma.adminUser.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (!admin || !admin.isActive) {
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة أو الحساب معطل' });
        return;
      }

      const isMatch = await bcrypt.compare(password, admin.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
        return;
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح إلى لوحة التحكم',
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تسجيل دخول المسؤول' });
    }
  }

  /**
   * إحصائيات ومؤشرات الأداء اللحظية للوحة التحكم (KPIs)
   */
  static async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        totalCars,
        activeCars,
        totalTags,
        activeTags,
        inStockTags,
        totalOrders,
        pendingOrders,
        totalScans,
        revenueAgg,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.car.count(),
        prisma.car.count({ where: { isActivated: true, isTagActive: true } }),
        prisma.tag.count(),
        prisma.tag.count({ where: { status: 'ACTIVE' } }),
        prisma.tag.count({ where: { status: 'IN_STOCK' } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.tagScanLog.count(),
        prisma.order.aggregate({
          where: { status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING', 'PENDING'] } },
          _sum: { totalPrice: true },
        }),
      ]);

      const totalRevenue = revenueAgg._sum.totalPrice || 0;

      res.json({
        success: true,
        stats: {
          users: { total: totalUsers },
          cars: { total: totalCars, active: activeCars },
          tags: { total: totalTags, active: activeTags, inStock: inStockTags },
          orders: { total: totalOrders, pending: pendingOrders, totalRevenue },
          scans: { total: totalScans },
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب إحصائيات لوحة التحكم' });
    }
  }

  /**
   * وحدة توليد دفعات الـ Tags للمطابع (Batch Tag Generator)
   */
  static async generateTagsBatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { count, tagType, batchName } = req.body;
      const amount = Math.min(Math.max(parseInt(count) || 10, 1), 500); // 1 to 500 per batch
      const type = tagType === 'NANO_GLASS' ? 'NANO_GLASS' : 'TRUNK_BADGE';
      const batchNumber = batchName || `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const createdTags: any[] = [];

      for (let i = 0; i < amount; i++) {
        // Generate random alphanumeric 4-digit code e.g. #A782 or #RK92
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let randomCode = '';
        for (let j = 0; j < 4; j++) {
          randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const tagCode = `#${randomCode}`;

        // Ensure unique tag code
        const exists = await prisma.tag.findUnique({ where: { tagCode } });
        if (exists) {
          i--;
          continue;
        }

        const secretToken = `sec_${uuidv4().replace(/-/g, '')}`;
        // Generate printable QR Code SVG
        const scanUrl = `https://rakna.app/tag/${encodeURIComponent(tagCode)}`;
        const qrSvg = await QRCode.toString(scanUrl, { type: 'svg', margin: 1, color: { dark: '#111111', light: '#FFFFFF' } });

        const tag = await prisma.tag.create({
          data: {
            tagCode,
            secretToken,
            tagType: type,
            status: 'IN_STOCK',
            batchNumber,
            qrCodeSvg: qrSvg,
          },
        });

        createdTags.push({
          id: tag.id,
          tagCode: tag.tagCode,
          tagType: tag.tagType,
          status: tag.status,
          batchNumber: tag.batchNumber,
          scanUrl,
        });
      }

      res.status(201).json({
        success: true,
        message: `تم توليد ${createdTags.length} ملصق Tag جديد بنجاح للدفعة (${batchNumber})`,
        batchNumber,
        count: createdTags.length,
        tags: createdTags,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر توليد دفعة الـ Tags' });
    }
  }

  /**
   * استعراض قائمة الـ Tags في لوحة التحكم مع البحث والفلترة
   */
  static async listTags(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, type, search } = req.query;

      let whereClause: any = {};
      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status;
      }
      if (type && typeof type === 'string' && type !== 'ALL') {
        whereClause.tagType = type;
      }
      if (search && typeof search === 'string') {
        whereClause.tagCode = { contains: search.trim() };
      }

      const tags = await prisma.tag.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true, phone: true } },
          car: { select: { brand: true, model: true, colorName: true, plateNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, count: tags.length, tags });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب ملصقات الـ Tags' });
    }
  }

  /**
   * استعراض كافة طلبات المتجر مع الفلترة وتحديث الحالات
   */
  static async listOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      let whereClause: any = {};
      if (status && typeof status === 'string' && status !== 'ALL') {
        whereClause.status = status;
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, orders });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب الطلبات' });
    }
  }

  /**
   * تحديث حالة طلب الشحن
   */
  static async updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
        res.status(400).json({ success: false, message: 'حالة الطلب غير صالحة' });
        return;
      }

      const order = await prisma.order.update({
        where: { id },
        data: { status },
      });

      res.json({ success: true, message: 'تم تحديث حالة الطلب بنجاح', order });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تحديث حالة الطلب' });
    }
  }

  /**
   * استعراض المستخدمين
   */
  static async listUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        include: {
          cars: true,
          tags: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, users });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب المستخدمين' });
    }
  }

  /**
   * حظر أو فك حظر مستخدم
   */
  static async toggleUserBlock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isBlocked: !user.isBlocked },
      });

      res.json({
        success: true,
        message: updated.isBlocked ? 'تم حظر المستخدم بنجاح' : 'تم فك حظر المستخدم',
        isBlocked: updated.isBlocked,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تعديل حالة الحظر' });
    }
  }

  /**
   * جلب رسائل الـ OTP وصندوق صادر الواتساب المباشر للداشبورد
   */
  static async getWhatsAppOutbox(req: AuthRequest, res: Response): Promise<void> {
    try {
      const messages = whatsAppService.getOutbox();
      const stats = whatsAppService.getStats();
      res.json({ success: true, stats, messages });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب صندوق صادر الواتساب' });
    }
  }

  /**
   * تحديد رسالة كمرسلة أو تحديث حالتها من الداشبورد
   */
  static async markWhatsAppSent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const updated = whatsAppService.markAsSent(id);
      if (!updated) {
        res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        return;
      }
      res.json({ success: true, message: 'تم تحديث حالة الإرسال بنجاح', messageData: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تحديث حالة الرسالة' });
    }
  }

  /**
   * إرسال رسالة واتساب مخصصة لأي رقم من الداشبورد
   */
  static async sendCustomWhatsApp(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phone, text } = req.body;
      if (!phone || !text) {
        res.status(400).json({ success: false, message: 'رقم الهاتف ونص الرسالة مطلوبان' });
        return;
      }
      const cleanPhone = phone.replace(/\D/g, '');
      const encodedText = encodeURIComponent(text);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
      const whatsappWebUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

      res.json({
        success: true,
        message: 'تم تجهيز رابط الواتساب بنجاح',
        whatsappUrl,
        whatsappWebUrl,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تجهيز رسالة الواتساب' });
    }
  }
}
