import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { errorHandler } from './middlewares/error.middleware';
import { authenticateOwner, authenticateAdmin } from './middlewares/auth.middleware';
import { AuthController } from './controllers/auth.controller';
import { CarsController } from './controllers/cars.controller';
import { TagsController } from './controllers/tags.controller';
import { ReporterController } from './controllers/reporter.controller';
import { ChatsController } from './controllers/chats.controller';
import { StoreController } from './controllers/store.controller';
import { NotificationsController } from './controllers/notifications.controller';
import { AdminController } from './controllers/admin.controller';
import { SupportController } from './controllers/support.controller';
import { setupChatGateway } from './sockets/chat.gateway';

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || '5000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// 1. Security & Core Middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // In development or local testing, allow any localhost or 127.0.0.1 on any port (Flutter Web, Vite, etc.)
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    const allowed = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
    if (allowed.includes('*') || allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 2. Setup Socket.io Gateway
setupChatGateway(server, CORS_ORIGIN);

// 3. API Routes
const apiRouter = express.Router();

// Health Check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'Rakna API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ──────────────── Auth Routes ────────────────
const authRouter = express.Router();
authRouter.post('/send-otp', AuthController.sendOtp);
authRouter.post('/phone/send-otp', AuthController.sendOtp);
authRouter.post('/verify-otp', AuthController.verifyOtp);
authRouter.post('/phone/verify-otp', AuthController.verifyOtp);
authRouter.get('/me', authenticateOwner, AuthController.getMe);
authRouter.patch('/me', authenticateOwner, AuthController.updateMe);
apiRouter.use('/auth', authRouter);

// ──────────────── Cars Routes ────────────────
const carsRouter = express.Router();
carsRouter.get('/', authenticateOwner, CarsController.getCars);
carsRouter.post('/', authenticateOwner, CarsController.addCar);
carsRouter.patch('/:id', authenticateOwner, CarsController.updateCar);
carsRouter.delete('/:id', authenticateOwner, CarsController.deleteCar);
apiRouter.use('/cars', carsRouter);

// ──────────────── Tags Routes ────────────────
const tagsRouter = express.Router();
tagsRouter.get('/my-tags', authenticateOwner, TagsController.getMyTags);
tagsRouter.post('/activate', authenticateOwner, TagsController.activateTagForCar);
tagsRouter.post('/:tagCode/toggle-pause', authenticateOwner, TagsController.togglePauseTag);
tagsRouter.post('/:tagCode/unlink', authenticateOwner, TagsController.unlinkTag);
tagsRouter.get('/:tagCode/test-signal', authenticateOwner, TagsController.testSignal);
apiRouter.use('/tags', tagsRouter);

// ──────────────── Reporter Flow Routes (Public & Anonymous) ────────────────
const reporterRouter = express.Router();
reporterRouter.get('/resolve-tag/:tagCode', ReporterController.resolveTag);
reporterRouter.post('/session/init', ReporterController.initSession);
reporterRouter.post('/chats', ReporterController.createChat);
reporterRouter.post('/chats/:chatId/messages', ReporterController.sendReporterMessage);
reporterRouter.post('/chats/:chatId/report', ReporterController.reportChat);
apiRouter.use('/reporter', reporterRouter);

// ──────────────── Owner Chats Routes ────────────────
const chatsRouter = express.Router();
chatsRouter.get('/', authenticateOwner, ChatsController.getChats);
chatsRouter.get('/:id/messages', authenticateOwner, ChatsController.getMessages);
chatsRouter.post('/:id/reply', authenticateOwner, ChatsController.reply);
chatsRouter.post('/:id/block', authenticateOwner, ChatsController.block);
chatsRouter.post('/:id/report', authenticateOwner, ChatsController.reportChat);
apiRouter.use('/chats', chatsRouter);

// ──────────────── Customer Support Routes (App User) ────────────────
const supportRouter = express.Router();
supportRouter.get('/messages', authenticateOwner, SupportController.getMyMessages);
supportRouter.post('/messages', authenticateOwner, SupportController.sendMessage);
apiRouter.use('/support', supportRouter);

// ──────────────── Store & Orders Routes ────────────────
const storeRouter = express.Router();
storeRouter.get('/products', StoreController.getProducts);
storeRouter.post('/orders', StoreController.createOrder);
storeRouter.get('/orders/my-orders', authenticateOwner, StoreController.getMyOrders);
apiRouter.use('/store', storeRouter);

// ──────────────── Notifications Routes ────────────────
const notificationsRouter = express.Router();
notificationsRouter.get('/', authenticateOwner, NotificationsController.getNotifications);
notificationsRouter.patch('/mark-all-read', authenticateOwner, NotificationsController.markAllAsRead);
notificationsRouter.delete('/clear-all', authenticateOwner, NotificationsController.clearAll);
notificationsRouter.delete('/:id', authenticateOwner, NotificationsController.deleteNotification);
apiRouter.use('/notifications', notificationsRouter);

// ──────────────── Admin Dashboard Routes ────────────────
const adminRouter = express.Router();
adminRouter.post('/login', AdminController.login);
adminRouter.get('/stats', authenticateAdmin, AdminController.getStats);
adminRouter.post('/tags/batch', authenticateAdmin, AdminController.generateTagsBatch);
adminRouter.get('/tags', authenticateAdmin, AdminController.listTags);
adminRouter.get('/orders', authenticateAdmin, AdminController.listOrders);
adminRouter.patch('/orders/:id/status', authenticateAdmin, AdminController.updateOrderStatus);
adminRouter.get('/users', authenticateAdmin, AdminController.listUsers);
adminRouter.patch('/users/:id/toggle-block', authenticateAdmin, AdminController.toggleUserBlock);
adminRouter.get('/whatsapp/outbox', authenticateAdmin, AdminController.getWhatsAppOutbox);
adminRouter.patch('/whatsapp/:id/mark-sent', authenticateAdmin, AdminController.markWhatsAppSent);
adminRouter.post('/whatsapp/send-custom', authenticateAdmin, AdminController.sendCustomWhatsApp);
adminRouter.get('/whatsapp/config', authenticateAdmin, AdminController.getWhatsAppConfig);
adminRouter.post('/whatsapp/config', authenticateAdmin, AdminController.updateWhatsAppConfig);
adminRouter.post('/whatsapp/test', authenticateAdmin, AdminController.testWhatsAppGateway);
adminRouter.post('/whatsapp/:id/resend', authenticateAdmin, AdminController.resendWhatsAppMessage);
adminRouter.get('/whatsapp/qr', authenticateAdmin, AdminController.getWhatsAppQrCode);
adminRouter.get('/whatsapp/state', authenticateAdmin, AdminController.getWhatsAppState);
adminRouter.post('/whatsapp/reboot', authenticateAdmin, AdminController.rebootWhatsApp);
adminRouter.post('/whatsapp/logout', authenticateAdmin, AdminController.logoutWhatsApp);

// Customer Support Desk
adminRouter.get('/support/threads', authenticateAdmin, AdminController.getSupportThreads);
adminRouter.get('/support/threads/:threadId/messages', authenticateAdmin, AdminController.getSupportThreadMessages);
adminRouter.post('/support/threads/:threadId/reply', authenticateAdmin, AdminController.replySupportThread);
adminRouter.post('/support/threads/:threadId/close', authenticateAdmin, AdminController.closeSupportThread);

// Abuse Reports & Chat Moderation
adminRouter.get('/abuse-reports', authenticateAdmin, AdminController.getAbuseReports);
adminRouter.get('/abuse-reports/:reportId/messages', authenticateAdmin, AdminController.getReportMessages);
adminRouter.patch('/abuse-reports/:reportId/action', authenticateAdmin, AdminController.takeReportAction);

apiRouter.use('/admin', adminRouter);

// Mount API Prefix (/api/v1)
app.use(process.env.API_PREFIX || '/api/v1', apiRouter);

// Global Error Handler
app.use(errorHandler);

// 4. Start Server
server.listen(PORT, () => {
  console.log(`
  ======================================================
  🚗⚡ Rakna Backend API Server is Running!
  ======================================================
  📡 Base URL:    http://localhost:${PORT}${process.env.API_PREFIX || '/api/v1'}
  🩺 Health:      http://localhost:${PORT}${process.env.API_PREFIX || '/api/v1'}/health
  🛡️  Environment: ${process.env.NODE_ENV || 'development'}
  ======================================================
  `);
});

export default app;
