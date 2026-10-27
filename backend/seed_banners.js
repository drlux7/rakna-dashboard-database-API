const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBanners() {
  const count = await prisma.storeBanner.count();
  if (count === 0) {
    await prisma.storeBanner.createMany({
      data: [
        {
          image: 'assets/images/store/tag_trunk.jpg',
          title: 'ملصق شنطة السيارة الذكي',
          location: 'مثبت على شنطة السيارة بجوار اللوحة',
          subtitle: 'مظهر عصري فاخر مع رمز QR وشريحة NFC المدمجة',
          badge: 'أعلى مبيعاً',
          sortOrder: 1,
          isActive: true,
        },
        {
          image: 'assets/images/store/tag_glass.jpg',
          title: 'ملصق الزجاج الخلفي الشفاف',
          location: 'مثبت على الزجاج الخلفي للسيارة',
          subtitle: 'فيلم نانو شفاف يكشف عن الشريحة النحاسية الدائرية بدقة فائقة',
          badge: 'شفاف تماماً',
          sortOrder: 2,
          isActive: true,
        },
        {
          image: 'assets/images/store/tag_scan.jpg',
          title: 'مسح فوري بالهاتف الذكي',
          location: 'أعلى زاوية الزجاج الأمامي أو الخلفي',
          subtitle: 'تواصل لحظي بمجرد تقريب الهاتف (NFC) أو مسح الكود (QR)',
          badge: 'تقنية مزدوجة',
          sortOrder: 3,
          isActive: true,
        },
      ],
    });
    console.log('Seeded 3 default store banners!');
  } else {
    console.log(`Already have ${count} store banners.`);
  }
}

seedBanners()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
