import { prisma } from '../config/prisma';

export const CHAT_EXPIRY_HOURS = 5;
export const CHAT_EXPIRY_MS = CHAT_EXPIRY_HOURS * 60 * 60 * 1000;

export class ChatExpiryService {
  /**
   * فحص ما إذا كانت المحادثة منتهية الصلاحية لمرور 5 ساعات دون رد من صاحب السيارة
   */
  static isChatExpired(chat: {
    status: string;
    createdAt?: Date;
    messages?: { senderType: string; createdAt: Date }[];
  }): boolean {
    if (chat.status === 'EXPIRED') return true;
    if (chat.status === 'BLOCKED' || chat.status === 'CLOSED') return false;

    const msgs = chat.messages || [];
    const lastReporterMsg = [...msgs].reverse().find((m) => m.senderType === 'REPORTER');
    const lastOwnerMsg = [...msgs].reverse().find((m) => m.senderType === 'OWNER');

    // إذا لم توجد أي رسالة من المُبلّغ أصلاً، نعتمد على تاريخ بدء المحادثة
    if (!lastReporterMsg) {
      if (chat.createdAt) {
        return Date.now() - new Date(chat.createdAt).getTime() >= CHAT_EXPIRY_MS;
      }
      return false;
    }

    // إذا رد صاحب السيارة بعد آخر رسالة للمُبلّغ، فصاحب السيارة قام بالرد بالفعل
    if (lastOwnerMsg && new Date(lastOwnerMsg.createdAt) > new Date(lastReporterMsg.createdAt)) {
      return false;
    }

    // صاحب السيارة لم يرد بعد على آخر رسالة، نحسب مهلة الـ 5 ساعات
    const elapsed = Date.now() - new Date(lastReporterMsg.createdAt).getTime();
    return elapsed >= CHAT_EXPIRY_MS;
  }

  /**
   * فحص وتحديث حالة المحادثة في قاعدة البيانات إلى EXPIRED إذا مر عليها 5 ساعات دون رد
   */
  static async checkAndExpireChat(chatId: string): Promise<boolean> {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!chat) return false;
      if (chat.status === 'EXPIRED') return true;

      if (this.isChatExpired(chat)) {
        await prisma.chat.update({
          where: { id: chatId },
          data: { status: 'EXPIRED' },
        });
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /**
   * فحص دوري للمحادثات القديمة وتحديث المعلق منها تلقائياً
   */
  static async sweepExpiredChats(): Promise<void> {
    try {
      const fiveHoursAgo = new Date(Date.now() - CHAT_EXPIRY_MS);
      const staleChats = await prisma.chat.findMany({
        where: {
          status: { in: ['ACTIVE', 'PENDING_ACCEPT'] },
          lastMessageAt: { lt: fiveHoursAgo },
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      for (const ch of staleChats) {
        if (this.isChatExpired(ch)) {
          await prisma.chat.update({
            where: { id: ch.id },
            data: { status: 'EXPIRED' },
          });
        }
      }
    } catch (_) {}
  }
}

