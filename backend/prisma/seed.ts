import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Rakna Database Seeding...');

  // 1. Seed Super Admin User
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@rakna.app' },
    update: {},
    create: {
      email: 'admin@rakna.app',
      name: 'مدير النظام (Super Admin)',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Super Admin created:', admin.email);

  // 2. Seed Certified Store Products
  const products = [
    {
      name: 'ملصق شنطة السيارة الذكي (Trunk Badge)',
      slug: 'trunk-badge',
      subtitle: 'مخصص للتثبيت الخارجي المتين على شنطة أو خلفية السيارة مع شريحة NFC معززة',
      price: 149.0,
      imageAsset: 'assets/images/store/tag_trunk.jpg',
      badgeText: 'هيكل مدرع مقاوم للعوامل الجوية',
      description: 'شريحة NFC مدمجة معززة لسرعة القراءة في ثانية واحدة، رمز QR محمي بطبقة كربونية مضادة للخدش والأتربة، مقاوم للماء وغسيل السيارات وموجات الحرارة العالية، ولاصق 3M قوي جداً لا يترك أي أثر عند الإزالة.',
      inStock: true,
    },
    {
      name: 'ملصق الزجاج الشفاف (Nano Glass Tag)',
      slug: 'nano-glass-tag',
      subtitle: 'مخصص للزجاج الخلفي أو أعلى زاوية الزجاج الأمامي بدقة نانو فائقة',
      price: 129.0,
      imageAsset: 'assets/images/store/tag_glass.jpg',
      badgeText: 'فيلم نانو شفاف فائق النقاء',
      description: 'شريحة نحاسية دائرية رقيقة فائقة الحساسية والأناقة، رمز QR ليزري عالي التباين للقراءة السريعة عبر كاميرات الهواتف، شفافية بنسبة 98% تضمن عدم حجب الرؤية نهائياً، ومقاوم للأشعة فوق البنفسجية وتظليل الزجاج.',
      inStock: true,
    },
    {
      name: 'باقة التوفير الكاملة (ملصقين معاً)',
      slug: 'bundle-pack',
      subtitle: 'ملصق شنطة السيارة + ملصق الزجاج الشفاف معاً بتوفير خاص وشحن مجاني',
      price: 249.0,
      imageAsset: 'assets/images/store/tag_trunk.jpg',
      badgeText: 'توفير 29 ج.م + شحن مجاني',
      description: 'احصل على التغطية الكاملة لسيارتك بملصق خارجي مدرع على الشنطة وملصق نانو شفاف للزجاج مع كودين مستقلين.',
      inStock: true,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {},
      create: prod,
    });
  }
  console.log('✅ Store products seeded');

  // 3. Seed Demo Owner User
  const demoOwner = await prisma.user.upsert({
    where: { phone: '+20102345678' },
    update: {},
    create: {
      phone: '+20102345678',
      name: 'Omar Elhawary',
      isVerified: true,
      notificationsEnabled: true,
      themePreference: 'system',
    },
  });
  console.log('✅ Demo Owner created:', demoOwner.name, demoOwner.phone);

  // 4. Seed Tags
  const tagA247 = await prisma.tag.upsert({
    where: { tagCode: '#A247' },
    update: {},
    create: {
      tagCode: '#A247',
      secretToken: 'sec_tok_a247_nfc_rakna_2026',
      tagType: 'TRUNK_BADGE',
      status: 'ACTIVE',
      batchNumber: 'BATCH-2026-Q1',
      userId: demoOwner.id,
      activatedAt: new Date(),
    },
  });

  const unassignedTagsData = [
    { tagCode: '#TAG-8821', type: 'NANO_GLASS' },
    { tagCode: '#TAG-9012', type: 'TRUNK_BADGE' },
    { tagCode: '#TAG-3420', type: 'TRUNK_BADGE' },
    { tagCode: '#TAG-7711', type: 'NANO_GLASS' },
  ];

  const seededUnassignedTags: { id: string; tagCode: string }[] = [];
  for (const t of unassignedTagsData) {
    const tag = await prisma.tag.upsert({
      where: { tagCode: t.tagCode },
      update: {},
      create: {
        tagCode: t.tagCode,
        secretToken: `sec_tok_${t.tagCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_nfc`,
        tagType: t.type,
        status: 'IN_STOCK',
        batchNumber: 'BATCH-2026-Q1',
      },
    });
    seededUnassignedTags.push({ id: tag.id, tagCode: tag.tagCode });
  }
  console.log('✅ Tags seeded (1 active + 4 in-stock)');

  // 4b. Seed Activation Codes (one per tag, each printed in its own package)
  // Code for the already-active #A247 tag (mark it as redeemed)
  await prisma.activationCode.upsert({
    where: { code: 'ACT-0001-A1' },
    update: {},
    create: {
      code: 'ACT-0001-A1',
      isRedeemed: true,
      redeemedAt: new Date(),
      usedOnTagId: tagA247.id,
      batchNumber: 'BATCH-2026-Q1',
    },
  });

  // Fresh (unredeemed) codes for the 4 in-stock tags — NOT linked to any tag yet
  const freshCodes = ['ACT-8492-X1', 'ACT-3310-B2', 'ACT-7741-C3', 'ACT-5529-D4'];
  for (const code of freshCodes) {
    await prisma.activationCode.upsert({
      where: { code },
      update: {},
      create: {
        code,
        isRedeemed: false,
        batchNumber: 'BATCH-2026-Q1',
      },
    });
  }
  console.log('✅ Activation codes seeded (1 redeemed + 4 fresh ready-to-use)');

  // 5. Seed Cars
  // Car 1: Activated with Tag #A247
  const car1 = await prisma.car.upsert({
    where: { id: 'car_demo_1' },
    update: {},
    create: {
      id: 'car_demo_1',
      userId: demoOwner.id,
      brand: 'Toyota',
      model: 'Corolla',
      year: '2023',
      plateNumber: 'س ي ر 1 2 3',
      colorName: 'أبيض لؤلؤي',
      nickname: 'سيارة العمل',
      isActivated: true,
      isTagActive: true,
    },
  });

  // Link Tag #A247 to car1 (Enforcing 1 Car = 1 Tag)
  await prisma.tag.update({
    where: { id: tagA247.id },
    data: { carId: car1.id },
  });

  // Car 2: Unactivated (Needs a tag to activate)
  await prisma.car.upsert({
    where: { id: 'car_demo_2' },
    update: {},
    create: {
      id: 'car_demo_2',
      userId: demoOwner.id,
      brand: 'Hyundai',
      model: 'Elantra',
      year: '2022',
      plateNumber: 'م ص ر 7 8 9',
      colorName: 'أسود داكن',
      nickname: 'سيارة العائلة',
      isActivated: false,
      isTagActive: false,
    },
  });
  console.log('✅ Cars seeded (1 activated with #A247 + 1 unactivated)');

  // 6. Seed Notifications
  const notifications = [
    {
      userId: demoOwner.id,
      carId: car1.id,
      tagCode: '#A247',
      type: 'CAR_ALERT',
      title: 'السيارة تعيق حركة المرور',
      message: 'أرسل أحد المارة إشعاراً بأن سيارتك تقف أمام مدخل جراج رئيسي وتعوق الخروج.',
      actionLabel: 'تواصل مع صاحب البلاغ',
      isRead: false,
    },
    {
      userId: demoOwner.id,
      carId: car1.id,
      tagCode: '#A247',
      type: 'TAG_SCAN',
      title: 'تم مسح ملصق السيارة (#A247)',
      message: 'قام شخص ما بمسح رمز QR أو تقريب هاتف NFC من ملصق سيارتك (Toyota Corolla).',
      actionLabel: 'تفاصيل المسح',
      isRead: false,
    },
    {
      userId: demoOwner.id,
      type: 'SYSTEM',
      title: 'تم تفعيل حسابك بنجاح',
      message: 'أهلاً بك في ركنة! تم تأكيد رقم هاتفك وتفعيل عضويتك الآمنة لحماية خصوصيتك.',
      actionLabel: 'استكشف التطبيق',
      isRead: true,
    },
  ];

  for (const n of notifications) {
    await prisma.notification.create({ data: n });
  }
  console.log('✅ Notifications seeded');

  // 7. Seed Demo Order
  await prisma.order.upsert({
    where: { orderNumber: '#RK-48921' },
    update: {},
    create: {
      orderNumber: '#RK-48921',
      userId: demoOwner.id,
      recipientName: 'Omar Elhawary',
      phone: '+20102345678',
      governorate: 'القاهرة',
      addressDetails: 'التجمع الخامس - شارع التسعين الشمالي - عمارة 14',
      totalPrice: 149.0,
      paymentMethod: 'COD',
      status: 'SHIPPED',
    },
  });
  console.log('✅ Demo order created: #RK-48921');

  console.log('🎉 Rakna Database Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
