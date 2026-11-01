import { prisma } from './config/prisma';

export async function seedGovernorates() {
  const governorates = [
    { nameAr: 'القاهرة', nameEn: 'Cairo', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 1 },
    { nameAr: 'الجيزة', nameEn: 'Giza', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 2 },
    { nameAr: 'الإسكندرية', nameEn: 'Alexandria', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 3 },
    { nameAr: 'القليوبية', nameEn: 'Qalyubia', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 4 },
    { nameAr: 'الشرقية', nameEn: 'Sharqia', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 5 },
    { nameAr: 'الدقهلية', nameEn: 'Dakahlia', shippingFee: 0, deliveryTime: 'خلال 24-48 ساعة', sortOrder: 6 },
    { nameAr: 'الغربية', nameEn: 'Gharbia', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 7 },
    { nameAr: 'المنوفية', nameEn: 'Monufia', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 8 },
    { nameAr: 'البحيرة', nameEn: 'Beheira', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 9 },
    { nameAr: 'كفر الشيخ', nameEn: 'Kafr El Sheikh', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 10 },
    { nameAr: 'دمياط', nameEn: 'Damietta', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 11 },
    { nameAr: 'بورسعيد', nameEn: 'Port Said', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 12 },
    { nameAr: 'الإسماعيلية', nameEn: 'Ismailia', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 13 },
    { nameAr: 'السويس', nameEn: 'Suez', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 14 },
    { nameAr: 'الفيوم', nameEn: 'Fayoum', shippingFee: 0, deliveryTime: 'خلال 2-3 أيام', sortOrder: 15 },
    { nameAr: 'بني سويف', nameEn: 'Beni Suef', shippingFee: 0, deliveryTime: 'خلال 2-4 أيام', sortOrder: 16 },
    { nameAr: 'المنيا', nameEn: 'Minya', shippingFee: 0, deliveryTime: 'خلال 2-4 أيام', sortOrder: 17 },
    { nameAr: 'أسيوط', nameEn: 'Asyut', shippingFee: 0, deliveryTime: 'خلال 2-4 أيام', sortOrder: 18 },
    { nameAr: 'سوهاج', nameEn: 'Sohag', shippingFee: 0, deliveryTime: 'خلال 3-4 أيام', sortOrder: 19 },
    { nameAr: 'قنا', nameEn: 'Qena', shippingFee: 0, deliveryTime: 'خلال 3-4 أيام', sortOrder: 20 },
    { nameAr: 'الأقصر', nameEn: 'Luxor', shippingFee: 0, deliveryTime: 'خلال 3-5 أيام', sortOrder: 21 },
    { nameAr: 'أسوان', nameEn: 'Aswan', shippingFee: 0, deliveryTime: 'خلال 3-5 أيام', sortOrder: 22 },
    { nameAr: 'البحر الأحمر', nameEn: 'Red Sea', shippingFee: 35, deliveryTime: 'خلال 3-5 أيام', sortOrder: 23 },
    { nameAr: 'مطروح', nameEn: 'Matrouh', shippingFee: 35, deliveryTime: 'خلال 3-5 أيام', sortOrder: 24 },
    { nameAr: 'الوادي الجديد', nameEn: 'New Valley', shippingFee: 45, deliveryTime: 'خلال 4-6 أيام', sortOrder: 25 },
    { nameAr: 'شمال سيناء', nameEn: 'North Sinai', shippingFee: 45, deliveryTime: 'خلال 4-6 أيام', sortOrder: 26 },
    { nameAr: 'جنوب سيناء', nameEn: 'South Sinai', shippingFee: 45, deliveryTime: 'خلال 4-6 أيام', sortOrder: 27 },
  ];

  for (const gov of governorates) {
    await prisma.governorate.upsert({
      where: { nameAr: gov.nameAr },
      update: {},
      create: gov,
    });
  }

  console.log(`✅ Seeded ${governorates.length} governorates.`);
}

if (require.main === module) {
  seedGovernorates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
