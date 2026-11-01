import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const errorHandler = async (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.error('🔥 Server Error:', err);
  const status = err.statusCode || 500;
  const message = err.message || 'حدث خطأ غير متوقع في الخادم، يرجى المحاولة لاحقاً';

  // Automatically record server errors (500+) into ErrorLog table for dashboard tracking
  if (status >= 500 || !err.statusCode) {
    try {
      await prisma.errorLog.create({
        data: {
          level: status >= 500 ? 'ERROR' : 'WARN',
          message: String(err?.message || err || 'Unknown Error'),
          stack: err?.stack ? String(err.stack) : undefined,
          path: req.originalUrl || req.path,
          method: req.method,
          statusCode: status,
          ip: req.ip || req.socket?.remoteAddress || undefined,
          userAgent: req.get('user-agent') || undefined,
        },
      });
    } catch (logErr) {
      console.error('Failed to persist error to ErrorLog table:', logErr);
    }
  }

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
