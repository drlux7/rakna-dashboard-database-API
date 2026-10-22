import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding sample support messages and chat abuse reports...');

  // 1. Get or create users
  let user1 = await prisma.user.findFirst({ where: { phone: '+20102345678' } });
  if (!user1) {
    user1 = await prisma.user.create({
      data: {
        phone: '+20102345678',
        name: 'عمر الهواري (Omar Elhawary)',
        isVerified: true,
      },
    });
  }

  let user2 = await prisma.user.findFirst({ where: { phone: '+20109876543' } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        phone: '+20109876543',
        name: 'أحمد محمود الكردي',
        isVerified: true,
      },
    });
  }

  // 2. Seed Customer Support Messages for User 1
  const existingSupport1 = await prisma.supportMessage.count({ where: { userId: user1.id } });
  if (existingSupport1 === 0) {
    await prisma.supportMessage.createMany({
      data: [
        {
          userId: user1.id,
          senderType: 'USER',
          content: 'السلام عليكم، عندي استفسار بخصوص مدة توصيل ملصق شنطة السيارة لمحافظة الإسكندرية؟',
          createdAt: new Date(Date.now() - 3600000 * 2),
        },
        {
          userId: user1.id,
          senderType: 'SUPPORT',
          content: 'أهلاً بك يا فندم في ركنة 👋 مدة الشحن للإسكندرية من 24 إلى 48 ساعة عمل كحد أقصى مع مندوب الشحن.',
          createdAt: new Date(Date.now() - 3600000 * 1.5),
        },
        {
          userId: user1.id,
          senderType: 'USER',
          content: 'تمام ممتاز جداً، هل بيتم إرسال رقم تتبع الشحنة على الواتساب؟',
          createdAt: new Date(Date.now() - 3600000 * 0.5),
        },
      ],
    });
    console.log('✅ Seeded support messages for User 1');
  }

  // 3. Seed Support Message for User 2
  const existingSupport2 = await prisma.supportMessage.count({ where: { userId: user2.id } });
  if (existingSupport2 === 0) {
    await prisma.supportMessage.create({
      data: {
        userId: user2.id,
        senderType: 'USER',
        content: 'مرحباً، هل ملصق النانو جلاس بيتحمل غسيل الكيماوي والبخار في المغسلة بدون ما يتلف؟',
        createdAt: new Date(Date.now() - 1800000),
      },
    });
    console.log('✅ Seeded support message for User 2');
  }

  // 4. Ensure a car exists for User 1 with an active tag
  let car = await prisma.car.findFirst({ where: { userId: user1.id } });
  if (!car) {
    car = await prisma.car.create({
      data: {
        userId: user1.id,
        brand: 'Mercedes-Benz',
        model: 'C180',
        year: '2023',
        plateNumber: 'س ع ط 942',
        colorName: 'أسود ميتاليك',
        nickname: 'المرسيدس الخاصة',
        isActivated: true,
        isTagActive: true,
      },
    });
  }

  // 5. Create a sample reported chat with abusive content
  const existingReports = await prisma.chatReport.count();
  if (existingReports === 0) {
    const chat = await prisma.chat.create({
      data: {
        carId: car.id,
        reporterSessionToken: 'rep_abuse_sample_token_889',
        contactReason: 'CAR_BLOCKING',
        status: 'ACTIVE',
        messages: {
          create: [
            {
              senderType: 'REPORTER',
              content: 'لو سمحت عربيتك قافلة عليا في الجراج ومحتاج أتحرك ضروري.',
              createdAt: new Date(Date.now() - 7200000),
            },
            {
              senderType: 'OWNER',
              content: 'أنا نازل حالاً خلال 5 دقائق بعتذر جداً لحضرتك.',
              createdAt: new Date(Date.now() - 6900000),
            },
            {
              senderType: 'REPORTER',
              content: 'انت قليل الذوق وما بتفهمش وموقفك مش محترم وهكسرلك العربية دي لو ما نزلتش حالا!! 🤬',
              createdAt: new Date(Date.now() - 6600000),
            },
            {
              senderType: 'REPORTER',
              content: 'نزلت ولا لسه يا ...؟ مش هسيبك تمشي سليم.',
              createdAt: new Date(Date.now() - 6300000),
            },
          ],
        },
      },
    });

    // Create Report
    await prisma.chatReport.create({
      data: {
        chatId: chat.id,
        reporterType: 'OWNER',
        reason: 'PROFANITY',
        details: 'قام الشخص المجهول بتوجيه شتائم وتهديد بتكسير سيارتي وألفاظ بذيئة خارجة عن حدود الأدب.',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 6000000),
      },
    });
    console.log('✅ Seeded sample abuse report');
  }

  console.log('Done seeding test data!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
