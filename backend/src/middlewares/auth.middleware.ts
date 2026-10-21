import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'rakna_secret_default_key';

export interface AuthenticatedUser {
  id: string;
  phone?: string;
  role?: string;
  email?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateOwner = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'مطلوب تسجيل الدخول للوصول إلى هذا القسم' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'رمز الجلسة غير صالح أو منتهي الصلاحية' });
  }
};

export const authenticateAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'مطلوب مصادقة المسؤول للوصول إلى لوحة التحكم' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    if (!decoded.role || !['SUPER_ADMIN', 'ADMIN', 'LOGISTICS', 'SUPPORT'].includes(decoded.role)) {
      res.status(403).json({ success: false, message: 'ليس لديك صلاحية الوصول إلى هذه الوظيفة' });
      return;
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'جلسة المسؤول غير صالحة أو منتهية' });
  }
};
