import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from '../config/prisma';

export function setupChatGateway(httpServer: HttpServer, corsOrigin: string) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // 1. الانضمام لغرفة المحادثة الخاصة
    socket.on('join_chat', (data: { chatId: string }) => {
      if (data?.chatId) {
        socket.join(`chat_${data.chatId}`);
      }
    });

    // 2. إرسال واستقبال الرسائل الفورية
    socket.on('send_message', async (data: {
      chatId: string;
      senderType: 'REPORTER' | 'OWNER';
      content: string;
      imageUrl?: string;
      isViewOnce?: boolean;
    }) => {
      try {
        if (!data.chatId || !data.content?.trim()) return;

        const chat = await prisma.chat.findUnique({
          where: { id: data.chatId },
          include: { car: true },
        });

        if (!chat || chat.status === 'BLOCKED') return;

        const message = await prisma.message.create({
          data: {
            chatId: chat.id,
            senderType: data.senderType,
            content: data.content.trim(),
            imageUrl: data.imageUrl || null,
            isViewOnce: Boolean(data.isViewOnce),
          },
        });

        await prisma.chat.update({
          where: { id: chat.id },
          data: { lastMessageAt: new Date() },
        });

        // بث الرسالة فورياً لكافة المشتركين في غرفة المحادثة
        io.to(`chat_${chat.id}`).emit('new_message', message);

        // إرسال إشعار للمالك إذا كان المرسل هو المُبلّغ
        if (data.senderType === 'REPORTER') {
          io.emit(`owner_alert_${chat.car.userId}`, {
            title: 'رسالة جديدة من المُبلّغ',
            message: data.content.trim().substring(0, 100),
            carId: chat.carId,
          });
        }
      } catch (err) {
        console.error('Socket send_message error:', err);
      }
    });

    // 3. مؤشر جاري الكتابة (Typing indicator)
    socket.on('typing', (data: { chatId: string; isTyping: boolean; senderType: string }) => {
      if (data?.chatId) {
        socket.to(`chat_${data.chatId}`).emit('typing', data);
      }
    });

    // 4. إشعار فتح صورة العرض لمرة واحدة
    socket.on('mark_viewed', async (data: { messageId: string; chatId: string }) => {
      try {
        if (!data?.messageId) return;

        await prisma.message.update({
          where: { id: data.messageId },
          data: { isViewed: true },
        });

        io.to(`chat_${data.chatId}`).emit('message_viewed', { messageId: data.messageId });
      } catch (err) {
        console.error('Socket mark_viewed error:', err);
      }
    });
  });

  return io;
}
