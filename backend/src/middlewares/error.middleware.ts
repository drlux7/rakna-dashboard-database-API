import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('🔥 Server Error:', err);
  const status = err.statusCode || 500;
  const message = err.message || 'حدث خطأ غير متوقع في الخادم، يرجى المحاولة لاحقاً';

  res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
