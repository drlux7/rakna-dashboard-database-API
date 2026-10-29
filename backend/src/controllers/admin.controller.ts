import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { whatsAppService } from '../services/whatsapp.service';

import dotenv from 'dotenv';
dotenv.config();

const getJwtSecret = () => process.env.JWT_SECRET || 'rakna_super_secret_jwt_key_2026_veritag';

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
        getJwtSecret(),
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
      const rawCount = req.body.count ?? req.body.quantity;
      const rawBatch = req.body.batchName || req.body.batchNumber;
      const amount = Math.min(Math.max(parseInt(rawCount) || 10, 1), 500); // 1 to 500 per batch
      const type = req.body.tagType === 'NANO_GLASS' ? 'NANO_GLASS' : 'TRUNK_BADGE';
      const batchNumber = rawBatch || `BATCH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const withCodes = req.body.generatePairedCodes === true;

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

        let activationCodeStr: string | null = null;
        if (withCodes) {
          const numPart = Math.floor(1000 + Math.random() * 9000);
          const alphaPart = chars.charAt(Math.floor(Math.random() * chars.length)) + chars.charAt(Math.floor(Math.random() * chars.length));
          activationCodeStr = `ACT-${numPart}-${alphaPart}`;
          const actExists = await prisma.activationCode.findUnique({ where: { code: activationCodeStr } });
          if (actExists) {
            i--;
            continue;
          }

          await prisma.activationCode.create({
            data: {
              code: activationCodeStr,
              isRedeemed: false,
              batchNumber,
            },
          });
        }

        const secretToken = `sec_${uuidv4().replace(/-/g, '')}`;
        // Generate printable QR Code SVG pointing to the Web Chat Page
        const cleanCodeWithoutHash = tagCode.replace(/^#/, '');
        const serverBaseUrl = process.env.PUBLIC_WEB_URL || process.env.API_BASE_URL || 'http://localhost:5000';
        const scanUrl = `${serverBaseUrl}/t/${encodeURIComponent(cleanCodeWithoutHash)}`;
        const qrSvg = await QRCode.toString(scanUrl, {
          type: 'svg',
          width: 140,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' },
        });

        // Create tag (no activationCode field in tags table)
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
          activationCode: activationCodeStr,
          tagType: tag.tagType,
          status: tag.status,
          batchNumber: tag.batchNumber,
          scanUrl,
          qrCodeSvg: tag.qrCodeSvg,
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
   * وحدة توليد دفعات أكواد التفعيل لكرت الباكدج (Activation Codes Generator)
   */
  static async generateActivationCodesBatch(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rawCount = req.body.count ?? req.body.quantity;
      const rawBatch = req.body.batchName || req.body.batchNumber;
      const amount = Math.min(Math.max(parseInt(rawCount) || 10, 1), 500);
      const batchNumber = rawBatch || `ACT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const createdCodes: any[] = [];

      for (let i = 0; i < amount; i++) {
        const numPart = Math.floor(1000 + Math.random() * 9000);
        const a1 = chars.charAt(Math.floor(Math.random() * chars.length));
        const a2 = chars.charAt(Math.floor(Math.random() * chars.length));
        const code = `ACT-${numPart}-${a1}${a2}`;

        const exists = await prisma.activationCode.findUnique({ where: { code } });
        if (exists) {
          i--;
          continue;
        }

        const act = await prisma.activationCode.create({
          data: {
            code,
            isRedeemed: false,
            batchNumber,
          },
        });

        createdCodes.push(act);
      }

      res.status(201).json({
        success: true,
        message: `تم توليد ${createdCodes.length} كود تفعيل جديد بنجاح للدفعة (${batchNumber})`,
        batchNumber,
        count: createdCodes.length,
        codes: createdCodes,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر توليد دفعة أكواد التفعيل' });
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
          activationCode: { select: { code: true, isRedeemed: true, redeemedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const formattedTags = tags.map((t: any) => ({
        ...t,
        activationCode: t.activationCode?.code || null,
        isRedeemed: t.activationCode?.isRedeemed || false,
        redeemedAt: t.activationCode?.redeemedAt || null,
      }));

      res.json({ success: true, count: formattedTags.length, tags: formattedTags });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب ملصقات الـ Tags' });
    }
  }

  /**
   * استعراض كافة أكواد التفعيل
   */
  static async listActivationCodes(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, search } = req.query;
      let whereClause: any = {};
      if (status === 'REDEEMED') {
        whereClause.isRedeemed = true;
      } else if (status === 'FRESH') {
        whereClause.isRedeemed = false;
      }
      if (search && typeof search === 'string') {
        whereClause.code = { contains: search.trim() };
      }

      const codes = await prisma.activationCode.findMany({
        where: whereClause,
        include: {
          usedOnTag: {
            select: {
              tagCode: true,
              tagType: true,
              status: true,
              car: {
                select: {
                  brand: true,
                  model: true,
                  plateNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      res.json({ success: true, count: codes.length, codes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب أكواد التفعيل' });
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

      // Also queue in service for tracking
      whatsAppService.queueOtpMessage(phone, 'CUSTOM');

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

  /**
   * جلب إعدادات بوابة الواتساب
   */
  static async getWhatsAppConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const config = whatsAppService.getConfig(false);
      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب إعدادات الواتساب' });
    }
  }

  /**
   * تحديث إعدادات ومفاتيح بوابة الواتساب من الداشبورد
   */
  static async updateWhatsAppConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const updated = whatsAppService.saveConfig(req.body);
      res.json({
        success: true,
        message: 'تم تحديث وحفظ إعدادات بوابة الواتساب بنجاح ⚡',
        config: updated,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر حفظ الإعدادات' });
    }
  }

  /**
   * اختبار الاتصال وإرسال كود OTP تجريبي للتحقق من المفاتيح
   */
  static async testWhatsAppGateway(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phone } = req.body;
      if (!phone) {
        res.status(400).json({ success: false, message: 'رقم الهاتف مطلوب للاختبار' });
        return;
      }
      const result = await whatsAppService.sendTestOtp(phone);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'خطأ أثناء اختبار البوابة' });
    }
  }

  /**
   * إعادة محاولة إرسال رسالة من الصندوق
   */
  static async resendWhatsAppMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const result = await whatsAppService.resendMessage(id);
      if (!result) {
        res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        return;
      }
      res.json({ success: true, message: 'تمت محاولة إعادة الإرسال', messageData: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر إعادة الإرسال' });
    }
  }

  /**
   * جلب رمز الـ QR Code الخاص بـ Green-API لمسحه بهاتف الأدمن
   */
  static async getWhatsAppQrCode(req: AuthRequest, res: Response): Promise<void> {
    try {
      const qrData = await whatsAppService.getQrCode();
      const state = await whatsAppService.getStateInstance();
      res.json({ success: true, qrData, state });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر جلب رمز QR' });
    }
  }

  /**
   * فحص حالة الحساب في Green-API
   */
  static async getWhatsAppState(req: AuthRequest, res: Response): Promise<void> {
    try {
      const state = await whatsAppService.getStateInstance();
      res.json({ success: true, state });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر فحص حالة الاتصال' });
    }
  }

  /**
   * إعادة تشغيل النسخة في Green-API
   */
  static async rebootWhatsApp(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await whatsAppService.rebootInstance();
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر إعادة التشغيل' });
    }
  }

  /**
   * تسجيل خروج الرقم لربط هاتف جديد
   */
  static async logoutWhatsApp(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await whatsAppService.logoutInstance();
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'تعذر تسجيل الخروج' });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 🎧 خدمة العملاء والدعم الفني (LIVE CUSTOMER SUPPORT DESK)
  // ═════════════════════════════════════════════════════════════════

  // ═════════════════════════════════════════════════════════════════
  // 🎧 خدمة العملاء والدعم الفني (LIVE CUSTOMER SUPPORT DESK)
  // ═════════════════════════════════════════════════════════════════

  /**
   * جلب كافة محادثات وتذاكر الدعم الفني (النشطة والمغلقة)
   */
  static async getSupportThreads(req: AuthRequest, res: Response): Promise<void> {
    try {
      // ربط أي رسائل قديمة لا ترتبط بتذكرة
      const orphanMessages = await prisma.supportMessage.findMany({
        where: { ticketId: null },
      });

      if (orphanMessages.length > 0) {
        const userIds = [...new Set(orphanMessages.map((m) => m.userId))];
        for (const uid of userIds) {
          let ticket = await prisma.supportTicket.findFirst({
            where: { userId: uid, status: 'OPEN' },
          });
          if (!ticket) {
            ticket = await prisma.supportTicket.create({
              data: { userId: uid, status: 'OPEN' },
            });
          }
          await prisma.supportMessage.updateMany({
            where: { userId: uid, ticketId: null },
            data: { ticketId: ticket.id },
          });
        }
      }

      // جلب جميع تذاكر الدعم الفني
      const tickets = await prisma.supportTicket.findMany({
        include: {
          user: {
            include: { cars: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const threads = await Promise.all(
        tickets.map(async (t) => {
          const unreadCount = await prisma.supportMessage.count({
            where: {
              ticketId: t.id,
              senderType: 'USER',
              isRead: false,
            },
          });
          const lastMsg = t.messages[0];

          return {
            ticketId: t.id,
            ticketStatus: t.status, // OPEN or CLOSED
            closedAt: t.closedAt,
            closedBy: t.closedBy,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            userId: t.user.id,
            userName: t.user.name,
            phone: t.user.phone,
            isBlocked: t.user.isBlocked,
            carsCount: t.user.cars.length,
            carsDisplay: t.user.cars.map((c) => `${c.brand} ${c.model}`).join('، ') || 'بدون سيارات',
            lastMessage: lastMsg?.content || 'صورة مرفقة',
            lastMessageTime: lastMsg?.createdAt || t.updatedAt || t.createdAt,
            unreadCount,
          };
        })
      );

      // فرز المحادثات: الأحدث تفاعلاً أولاً
      threads.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

      res.json({ success: true, threads });
    } catch (error) {
      console.error('getSupportThreads error:', error);
      res.status(500).json({ success: false, message: 'تعذر جلب محادثات الدعم الفني' });
    }
  }

  /**
   * جلب كافة رسائل محادثة دعم فني لمستخدم أو تذكرة محددة
   */
  static async getSupportThreadMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const threadId = (req.params.threadId || req.params.userId) as string;

      // محاولة البحث بالمعرف كتذكرة أولاً
      let ticket = await prisma.supportTicket.findUnique({
        where: { id: threadId },
        include: {
          user: { include: { cars: true } },
        },
      });

      // إذا لم تكن تذكرة، البحث بالمعرف كمعرف مستخدم
      if (!ticket) {
        const user = await prisma.user.findUnique({
          where: { id: threadId },
          include: { cars: true },
        });

        if (!user) {
          res.status(404).json({ success: false, message: 'المحادثة أو المستخدم غير موجود' });
          return;
        }

        // البحث عن أحدث تذكرة للمستخدم (مفتوحة أو مغلقة)
        ticket = await prisma.supportTicket.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { include: { cars: true } },
          },
        });

        // إذا لم تكن هناك أي تذكرة للمستخدم، إنشاء تذكرة مفتوحة
        if (!ticket) {
          ticket = await prisma.supportTicket.create({
            data: { userId: user.id, status: 'OPEN' },
            include: {
              user: { include: { cars: true } },
            },
          });
        }
      }

      // جلب جميع رسائل التذكرة
      const messages = await prisma.supportMessage.findMany({
        where: { ticketId: ticket.id },
        orderBy: { createdAt: 'asc' },
      });

      // تحديد رسائل العميل في هذه التذكرة كمقروءة للدعم الفني
      await prisma.supportMessage.updateMany({
        where: {
          ticketId: ticket.id,
          senderType: 'USER',
          isRead: false,
        },
        data: { isRead: true },
      });

      res.json({
        success: true,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          closedAt: ticket.closedAt,
          closedBy: ticket.closedBy,
          createdAt: ticket.createdAt,
        },
        user: {
          id: ticket.user.id,
          name: ticket.user.name,
          phone: ticket.user.phone,
          isBlocked: ticket.user.isBlocked,
          cars: ticket.user.cars,
        },
        messages,
      });
    } catch (error) {
      console.error('getSupportThreadMessages error:', error);
      res.status(500).json({ success: false, message: 'تعذر جلب رسائل المحادثة' });
    }
  }

  /**
   * إرسال رد من فريق الدعم الفني إلى العميل
   * يتم منع الإرسال إذا كانت المحادثة مغلقة
   */
  static async replySupportThread(req: AuthRequest, res: Response): Promise<void> {
    try {
      const threadId = (req.params.threadId || req.params.userId) as string;
      const { content, imageUrl } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ success: false, message: 'نص الرد مطلوب' });
        return;
      }

      // البحث عن التذكرة بالمعرف
      let ticket = await prisma.supportTicket.findUnique({
        where: { id: threadId },
      });

      // إذا لم يكن معرف تذكرة، البحث عن تذكرة المستخدم المفتوحة
      if (!ticket) {
        ticket = await prisma.supportTicket.findFirst({
          where: { userId: threadId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        });

        // إذا لم توجد تذكرة مفتوحة، ابحث عن أحدث تذكرة مغلقة للتأكد
        if (!ticket) {
          ticket = await prisma.supportTicket.findFirst({
            where: { userId: threadId },
            orderBy: { createdAt: 'desc' },
          });
        }
      }

      if (!ticket) {
        res.status(404).json({ success: false, message: 'تذكرة الدعم الفني غير موجودة' });
        return;
      }

      // التحقق من حالة المحادثة
      if (ticket.status === 'CLOSED') {
        res.status(400).json({
          success: false,
          message: 'هذه المحادثة مغلقة ومؤرشفة. لا يمكن إرسال ردود جديدة عليها 🔒',
        });
        return;
      }

      const message = await prisma.supportMessage.create({
        data: {
          userId: ticket.userId,
          ticketId: ticket.id,
          senderType: 'SUPPORT',
          content: content.trim(),
          imageUrl: imageUrl || null,
        },
      });

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { updatedAt: new Date() },
      });

      await prisma.notification.create({
        data: {
          userId: ticket.userId,
          type: 'SYSTEM',
          title: '💬 رد جديد من خدمة عملاء ركنة',
          message: content.trim().substring(0, 100),
          actionLabel: 'عرض المحادثة',
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم إرسال الرد للعميل بنجاح 🚀',
        data: message,
      });
    } catch (error) {
      console.error('replySupportThread error:', error);
      res.status(500).json({ success: false, message: 'تعذر إرسال الرد للعميل' });
    }
  }

  /**
   * إغلاق وأرشفة محادثة الدعم الفني
   * تظل المحادثة محفوظة في سجلات الإدارة ولكن لا يمكن لأحد الكتابة فيها، وتُمسح من شاشة التطبيق للعميل
   */
  static async closeSupportThread(req: AuthRequest, res: Response): Promise<void> {
    try {
      const threadId = (req.params.threadId || req.params.ticketId || req.params.userId) as string;

      let ticket = await prisma.supportTicket.findUnique({
        where: { id: threadId },
      });

      if (!ticket) {
        ticket = await prisma.supportTicket.findFirst({
          where: { userId: threadId, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!ticket) {
        res.status(404).json({ success: false, message: 'المحادثة غير موجودة أو تم إغلاقها مسبقاً' });
        return;
      }

      const updated = await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: 'ADMIN',
        },
      });

      // إشعار المستخدم بأن المحادثة أغلقت
      await prisma.notification.create({
        data: {
          userId: ticket.userId,
          type: 'SYSTEM',
          title: '🔒 تم إغلاق تذكرة الدعم الفني',
          message: 'تم إغلاق المحادثة بنجاح بواسطة فريق خدمة العملاء. يسعدنا دائماً خدمتك وفتح محادثة جديدة في أي وقت.',
          actionLabel: 'تواصل مع الدعم',
        },
      });

      res.json({
        success: true,
        message: 'تم إغلاق المحادثة وأرشفتها بنجاح 🔒',
        ticket: updated,
      });
    } catch (error) {
      console.error('closeSupportThread error:', error);
      res.status(500).json({ success: false, message: 'تعذر إغلاق محادثة الدعم الفني' });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // 🛡️ رقابة المحادثات والبلاغات (ABUSE REPORTS & CHAT MODERATION)
  // ═════════════════════════════════════════════════════════════════

  /**
   * جلب كافة بلاغات المحادثات بين العملاء
   */
  static async getAbuseReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const statusFilter = (req.query.status as string) || 'ALL';

      const whereClause: any = {};
      if (statusFilter !== 'ALL') {
        whereClause.status = statusFilter;
      }

      const reports = await prisma.chatReport.findMany({
        where: whereClause,
        include: {
          chat: {
            include: {
              car: {
                include: {
                  user: {
                    select: { id: true, name: true, phone: true, isBlocked: true },
                  },
                  tag: { select: { tagCode: true } },
                },
              },
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              _count: { select: { messages: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = reports.map((r) => ({
        id: r.id,
        chatId: r.chatId,
        reporterType: r.reporterType,
        reason: r.reason,
        details: r.details,
        status: r.status,
        adminNotes: r.adminNotes,
        createdAt: r.createdAt,
        totalMessages: r.chat._count.messages,
        lastMessage: r.chat.messages[0]?.content || 'صورة أو بدون نص',
        carInfo: {
          brand: r.chat.car.brand,
          model: r.chat.car.model,
          plateNumber: r.chat.car.plateNumber,
          tagCode: r.chat.car.tag?.tagCode || 'بدون ملصق',
          colorName: r.chat.car.colorName,
        },
        ownerInfo: {
          id: r.chat.car.user.id,
          name: r.chat.car.user.name,
          phone: r.chat.car.user.phone,
          isBlocked: r.chat.car.user.isBlocked,
        },
      }));

      res.json({ success: true, reports: formatted });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب بلاغات المحادثات' });
    }
  }

  /**
   * جلب سجل المحادثة الكامل والصور لبلاغ معين
   */
  static async getReportMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = req.params.reportId as string;

      const report = await prisma.chatReport.findUnique({
        where: { id: reportId },
        include: {
          chat: {
            include: {
              car: {
                include: {
                  user: true,
                  tag: true,
                },
              },
              messages: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });

      if (!report) {
        res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
        return;
      }

      res.json({
        success: true,
        report: {
          id: report.id,
          reason: report.reason,
          details: report.details,
          reporterType: report.reporterType,
          status: report.status,
          createdAt: report.createdAt,
          adminNotes: report.adminNotes,
          chatStatus: report.chat.status,
        },
        car: report.chat.car,
        owner: {
          id: report.chat.car.user.id,
          name: report.chat.car.user.name,
          phone: report.chat.car.user.phone,
          isBlocked: report.chat.car.user.isBlocked,
        },
        messages: report.chat.messages,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب تفاصيل ورسائل المحادثة' });
    }
  }

  /**
   * اتخاذ إجراء رقابي على المحادثة المبلغ عنها
   */
  static async takeReportAction(req: AuthRequest, res: Response): Promise<void> {
    try {
      const reportId = req.params.reportId as string;
      const { action, notes } = req.body;

      const report = await prisma.chatReport.findUnique({
        where: { id: reportId },
        include: {
          chat: {
            include: { car: true },
          },
        },
      });

      if (!report) {
        res.status(404).json({ success: false, message: 'البلاغ غير موجود' });
        return;
      }

      if (action === 'BLOCK_USER') {
        await prisma.user.update({
          where: { id: report.chat.car.userId },
          data: { isBlocked: true },
        });
        await prisma.chat.update({
          where: { id: report.chatId },
          data: { status: 'BLOCKED' },
        });
        await prisma.chatReport.update({
          where: { id: reportId },
          data: { status: 'RESOLVED', adminNotes: notes || 'تم حظر حساب المستخدم وإغلاق المحادثة' },
        });

        res.json({ success: true, message: 'تم حظر المستخدم وإغلاق المحادثة بنجاح 🚫' });
      } else if (action === 'TERMINATE_CHAT') {
        await prisma.chat.update({
          where: { id: report.chatId },
          data: { status: 'BLOCKED' },
        });
        await prisma.chatReport.update({
          where: { id: reportId },
          data: { status: 'RESOLVED', adminNotes: notes || 'تم إنهاء وإغلاق المحادثة' },
        });

        res.json({ success: true, message: 'تم إغلاق المحادثة المسيئة بنجاح 🔒' });
      } else if (action === 'DISMISS') {
        await prisma.chatReport.update({
          where: { id: reportId },
          data: { status: 'DISMISSED', adminNotes: notes || 'تم مراجعة المحادثة ولم يتم رصد مخالفة' },
        });

        res.json({ success: true, message: 'تم تجاهل البلاغ بعد المراجعة ✓' });
      } else {
        res.status(400).json({ success: false, message: 'إجراء غير معروف' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر اتخاذ الإجراء' });
    }
  }

  // ──────────────── إدارة الرسائل السريعة (Quick Canned Messages) ────────────────

  /**
   * جلب كافة الرسائل السريعة للوحة التحكم
   */
  static async listQuickMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const messages = await prisma.quickMessage.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({ success: true, messages, data: messages });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب الرسائل السريعة' });
    }
  }

  /**
   * إنشاء رسالة سريعة جديدة من لوحة التحكم
   */
  static async createQuickMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, text, icon, category, isActive, displayOrder } = req.body;
      if (!title || !text) {
        res.status(400).json({ success: false, message: 'عنوان ونص الرسالة مطلوبان' });
        return;
      }

      const message = await prisma.quickMessage.create({
        data: {
          title: title.trim(),
          text: text.trim(),
          icon: icon || 'car',
          category: category || 'GENERAL',
          isActive: isActive !== false,
          displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        },
      });

      res.status(201).json({
        success: true,
        message: 'تم إضافة الرسالة السريعة بنجاح ✨',
        quickMessage: message,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إنشاء الرسالة السريعة' });
    }
  }

  /**
   * تعديل رسالة سريعة
   */
  static async updateQuickMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { title, text, icon, category, isActive, displayOrder } = req.body;

      const message = await prisma.quickMessage.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: title.trim() }),
          ...(text !== undefined && { text: text.trim() }),
          ...(icon !== undefined && { icon }),
          ...(category !== undefined && { category }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          ...(displayOrder !== undefined && { displayOrder: Number(displayOrder) }),
        },
      });

      res.json({
        success: true,
        message: 'تم تحديث الرسالة السريعة بنجاح 👍',
        quickMessage: message,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تعديل الرسالة السريعة' });
    }
  }

  /**
   * حذف رسالة سريعة
   */
  static async deleteQuickMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      await prisma.quickMessage.delete({ where: { id } });
      res.json({ success: true, message: 'تم حذف الرسالة السريعة بنجاح 🗑️' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر حذف الرسالة السريعة' });
    }
  }

  /**
   * تفعيل/تعطيل رسالة سريعة بضغطة زر
   */
  static async toggleQuickMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const current = await prisma.quickMessage.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        return;
      }

      const updated = await prisma.quickMessage.update({
        where: { id },
        data: { isActive: !current.isActive },
      });

      res.json({
        success: true,
        message: updated.isActive ? 'تم تفعيل الرسالة السريعة بنجاح' : 'تم تعطيل الرسالة السريعة بنجاح',
        isActive: updated.isActive,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تغيير حالة الرسالة السريعة' });
    }
  }
  /**
   * جلب جميع المنتجات في المتجر للوحة التحكم
   */
  static async listProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const products = await prisma.product.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({ success: true, products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب قائمة المنتجات' });
    }
  }

  /**
   * إضافة منتج جديد في المتجر
   */
  static async createProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        subtitle,
        price,
        originalPrice,
        discountPercent,
        imageAsset,
        badgeText,
        description,
        features,
        inStock,
        sortOrder,
      } = req.body;

      if (!name || !price) {
        res.status(400).json({ success: false, message: 'اسم المنتج والسعر مطلوبان' });
        return;
      }

      const baseSlug = (name as string)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-|-$/g, '') || 'product';
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

      let featuresJson = null;
      if (typeof features === 'string') {
        featuresJson = features;
      } else if (Array.isArray(features)) {
        featuresJson = JSON.stringify(features);
      }

      const product = await prisma.product.create({
        data: {
          name: (name as string).trim(),
          slug: uniqueSlug,
          subtitle: (subtitle as string || '').trim(),
          price: parseFloat(price) || 0,
          originalPrice: originalPrice ? parseFloat(originalPrice) : null,
          discountPercent: discountPercent ? parseInt(discountPercent, 10) : null,
          imageAsset: (imageAsset as string || 'assets/images/store/tag_trunk.jpg').trim(),
          badgeText: badgeText ? (badgeText as string).trim() : null,
          description: description ? (description as string).trim() : null,
          features: featuresJson,
          inStock: inStock !== undefined ? Boolean(inStock) : true,
          sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
        },
      });

      res.status(201).json({ success: true, message: 'تمت إضافة المنتج بنجاح 🛍️', product });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ success: false, message: 'تعذر إضافة المنتج' });
    }
  }

  /**
   * تعديل بيانات المنتج والأسعار والخصومات والصورة
   */
  static async updateProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const {
        name,
        subtitle,
        price,
        originalPrice,
        discountPercent,
        imageAsset,
        badgeText,
        description,
        features,
        inStock,
        sortOrder,
      } = req.body;

      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        return;
      }

      let featuresJson = existing.features;
      if (typeof features === 'string') {
        featuresJson = features;
      } else if (Array.isArray(features)) {
        featuresJson = JSON.stringify(features);
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: name !== undefined ? (name as string).trim() : existing.name,
          subtitle: subtitle !== undefined ? (subtitle as string).trim() : existing.subtitle,
          price: price !== undefined ? parseFloat(price) : existing.price,
          originalPrice: originalPrice !== undefined ? (originalPrice ? parseFloat(originalPrice) : null) : existing.originalPrice,
          discountPercent: discountPercent !== undefined ? (discountPercent ? parseInt(discountPercent, 10) : null) : existing.discountPercent,
          imageAsset: imageAsset !== undefined ? (imageAsset as string).trim() : existing.imageAsset,
          badgeText: badgeText !== undefined ? (badgeText ? (badgeText as string).trim() : null) : existing.badgeText,
          description: description !== undefined ? (description ? (description as string).trim() : null) : existing.description,
          features: featuresJson,
          inStock: inStock !== undefined ? Boolean(inStock) : existing.inStock,
          sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : existing.sortOrder,
        },
      });

      res.json({ success: true, message: 'تم تحديث بيانات المنتج بنجاح ✨', product: updated });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ success: false, message: 'تعذر تعديل المنتج' });
    }
  }

  /**
   * تغيير حالة توفر المنتج (متوفر / غير متوفر)
   */
  static async toggleProductStock(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const current = await prisma.product.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        return;
      }

      const updated = await prisma.product.update({
        where: { id },
        data: { inStock: !current.inStock },
      });

      res.json({
        success: true,
        message: updated.inStock ? 'تم تعيين المنتج كـ (متوفر حالياً) في المتجر ✅' : 'تم تعيين المنتج كـ (غير متوفر) في المتجر ⛔',
        inStock: updated.inStock,
        product: updated,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تغيير حالة توفر المنتج' });
    }
  }

  /**
   * إزالة/حذف منتج من المتجر
   */
  static async deleteProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const current = await prisma.product.findUnique({ where: { id } });
      if (!current) {
        res.status(404).json({ success: false, message: 'المنتج غير موجود' });
        return;
      }

      await prisma.orderItem.updateMany({
        where: { productId: id },
        data: { productId: null },
      });

      await prisma.product.delete({ where: { id } });

      res.json({ success: true, message: 'تم حذف المنتج من المتجر بنجاح 🗑️' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ success: false, message: 'تعذر حذف المنتج' });
    }
  }

  /**
   * رفع صورة منتج للمتجر
   */
  static async uploadProductImage(req: Request, res: Response): Promise<void> {
    try {
      const file = (req as any).file;
      if (!file) {
        res.status(400).json({ success: false, message: 'لم يتم إرسال أي ملف صورة' });
        return;
      }
      const fileUrl = `/uploads/${file.filename}`;
      res.json({
        success: true,
        message: 'تم رفع صورة المنتج بنجاح 🖼️',
        url: fileUrl,
        filename: file.filename,
      });
    } catch (error) {
      console.error('Error uploading product image:', error);
      res.status(500).json({ success: false, message: 'فشل رفع الصورة' });
    }
  }

  /**
   * جلب جميع شرائح السلايدر للمشرف
   */
  static async listBanners(req: AuthRequest, res: Response): Promise<void> {
    try {
      const banners = await prisma.storeBanner.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      });
      res.json({ success: true, banners });
    } catch (error) {
      console.error('Error listing store banners:', error);
      res.status(500).json({ success: false, message: 'تعذر جلب شرائح السلايدر' });
    }
  }

  /**
   * إضافة شريحة جديدة للسلايدر
   */
  static async createBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { image, title, location, subtitle, badge, sortOrder, isActive } = req.body;
      if (!image) {
        res.status(400).json({ success: false, message: 'الصورة مطلوبة لإضافة الشريحة' });
        return;
      }
      const banner = await prisma.storeBanner.create({
        data: {
          image: (image as string).trim(),
          title: title ? (title as string).trim() : null,
          location: location ? (location as string).trim() : null,
          subtitle: subtitle ? (subtitle as string).trim() : null,
          badge: badge ? (badge as string).trim() : null,
          sortOrder: sortOrder ? parseInt(sortOrder, 10) : 0,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        },
      });
      res.status(201).json({ success: true, message: 'تمت إضافة شريحة السلايدر بنجاح 🖼️✨', banner });
    } catch (error) {
      console.error('Error creating banner:', error);
      res.status(500).json({ success: false, message: 'تعذر إضافة شريحة السلايدر' });
    }
  }

  /**
   * تعديل شريحة سلايدر
   */
  static async updateBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const { image, title, location, subtitle, badge, sortOrder, isActive } = req.body;
      const existing = await prisma.storeBanner.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'شريحة السلايدر غير موجودة' });
        return;
      }
      const updated = await prisma.storeBanner.update({
        where: { id },
        data: {
          image: image !== undefined ? (image as string).trim() : existing.image,
          title: title !== undefined ? (title ? (title as string).trim() : null) : existing.title,
          location: location !== undefined ? (location ? (location as string).trim() : null) : existing.location,
          subtitle: subtitle !== undefined ? (subtitle ? (subtitle as string).trim() : null) : existing.subtitle,
          badge: badge !== undefined ? (badge ? (badge as string).trim() : null) : existing.badge,
          sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : existing.sortOrder,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        },
      });
      res.json({ success: true, message: 'تم تحديث شريحة السلايدر بنجاح ✨', banner: updated });
    } catch (error) {
      console.error('Error updating banner:', error);
      res.status(500).json({ success: false, message: 'تعذر تعديل شريحة السلايدر' });
    }
  }

  /**
   * تفعيل / تعطيل شريحة سلايدر
   */
  static async toggleBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const existing = await prisma.storeBanner.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'شريحة السلايدر غير موجودة' });
        return;
      }
      const updated = await prisma.storeBanner.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });
      res.json({
        success: true,
        message: updated.isActive ? 'تم تفعيل ظهور الشريحة في السلايدر ✅' : 'تم إخفاء الشريحة من السلايدر ⏸️',
        isActive: updated.isActive,
        banner: updated,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر تغيير حالة الشريحة' });
    }
  }

  /**
   * حذف / إزالة شريحة من السلايدر
   */
  static async deleteBanner(req: AuthRequest, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;
      const existing = await prisma.storeBanner.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'شريحة السلايدر غير موجودة' });
        return;
      }
      await prisma.storeBanner.delete({ where: { id } });
      res.json({ success: true, message: 'تم إزالة الشريحة من السلايدر بنجاح 🗑️' });
    } catch (error) {
      console.error('Error deleting banner:', error);
      res.status(500).json({ success: false, message: 'تعذر حذف شريحة السلايدر' });
    }
  }
}

