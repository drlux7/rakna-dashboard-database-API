import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export class StoreController {
  /**
   * جلب ملصقات ركنة المعتمدة والأسعار
   */
  static async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const products = await prisma.product.findMany({
        where: { inStock: true },
        orderBy: { price: 'desc' },
      });
      res.json({ success: true, products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب المنتجات' });
    }
  }

  /**
   * إنشاء طلب شراء جديد والدفع عند الاستلام نقداً (COD)
   */
  static async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { recipientName, phone, governorate, addressDetails, items, totalPrice } = req.body;

      if (!recipientName || !phone || !governorate || !addressDetails) {
        res.status(400).json({
          success: false,
          message: 'اسم المستلم، ورقم الهاتف، والمحافظة، والعنوان التفصيلي جميعها مطلوبة',
        });
        return;
      }

      // Generate unique order number (e.g. #RK-83921)
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      const orderNumber = `#RK-${randomDigits}`;

      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: req.user ? req.user.id : null,
          recipientName: recipientName.trim(),
          phone: phone.trim(),
          governorate: governorate.trim(),
          addressDetails: addressDetails.trim(),
          totalPrice: parseFloat(totalPrice) || 149.0,
          paymentMethod: 'COD',
          status: 'PENDING',
          items: {
            create: Array.isArray(items) && items.length > 0
              ? items.map((it: any) => ({
                  productId: it.productId || null,
                  productName: it.name || 'ملصق Rakna Tag الذكي',
                  unitPrice: parseFloat(it.price) || 149.0,
                  quantity: it.quantity || 1,
                }))
              : [
                  {
                    productName: 'ملصق Rakna Tag الذكي',
                    unitPrice: 149.0,
                    quantity: 1,
                  },
                ],
          },
        },
        include: { items: true },
      });

      // If user is logged in, send an order confirmation notification
      if (req.user) {
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            type: 'SYSTEM',
            title: `تم تسجيل طلبك (${orderNumber}) بنجاح`,
            message: `سيتواصل معك مندوب التوصيل خلال 24-48 ساعة لتسليم الـ Tag (${governorate}).`,
            actionLabel: 'تفاصيل الطلب',
          },
        });
      }

      res.status(201).json({
        success: true,
        message: 'تم تسجيل طلبك بنجاح!',
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          recipientName: order.recipientName,
          phone: order.phone,
          governorate: order.governorate,
          address: order.addressDetails,
          totalPrice: order.totalPrice,
          paymentMethod: 'الدفع عند الاستلام نقداً (شحن مجاني)',
          status: order.status,
          createdAt: order.createdAt,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر إتمام طلب الشراء' });
    }
  }

  /**
   * استعراض طلبات المستخدم المسجل
   */
  static async getMyOrders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const orders = await prisma.order.findMany({
        where: { userId: req.user!.id },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, orders });
    } catch (error) {
      res.status(500).json({ success: false, message: 'تعذر جلب سجل الطلبات' });
    }
  }
}
