# خطة التراجع السريع عند الطوارئ (Rollback Strategy) — منصة ركنة

يوفر هذا الدليل استراتيجية واضحة ومباشرة للرجوع إلى النسخة المستقرة السابقة (Rollback) فوراً في حال حدوث أي خطأ غير متوقع بعد نشر تحديث جديد (Deploy).

---

## 1. إذا كان النشر على منصات سحابية (Vercel / Railway / Render)
تتيح هذه المنصات الرجوع الفوري بدون لمس الكود عبر ميزة **Instant Rollback**:

### لوحة التحكم (Next.js / Vite على Vercel أو Netlify):
1. افتح صفحة المشروع في Vercel Dashboard.
2. اذهب إلى تبويب **Deployments**.
3. ابحث عن آخر Deploy كان يعمل بنجاح قبل التحديث.
4. اضغط على القائمة الجانبية `...` ثم اختر **Instant Rollback** أو **Promote to Production**.
5. سيعود الموقع للنسخة السابقة خلال **5 ثوانٍ**.

### خادم الباك إند (Node.js على Railway أو Render):
1. افتح مشروع السيرفر في لوحة تحكم Railway / Render.
2. توجه إلى **Deployments**.
3. اضغط على آخر نسخة ناجحة ثم اضغط **Rollback to this deployment**.

---

## 2. إذا كان النشر على سيرفرك الخاص (VPS / Ubuntu Server)

### الطريقة الأولى: عبر Git Tags (موصى بها)
عند إصدار كل نسخة جديدة ناجحة، يتم إنشاء Tag:
```bash
# إنشاء علامة للإصدار الحالي قبل التحديث
git tag -a v1.0.0 -m "Release v1.0.0 Stable"
git push origin v1.0.0
```

في حال حدوث خطأ بعد نشر إصدار جديد:
```bash
# العودة فوراً للنسخة السابقة v1.0.0
git checkout v1.0.0
npm install --production
npm run build
pm2 restart rakna-backend
```

### الطريقة الثانية: باستخدام PM2 (Rollback فوري في ثانية واحدة)
```bash
# للرجوع إلى العملية السابقة المحفوظة
pm2 reload rakna-backend --update-env
```

### الطريقة الثالثة: استخدام Docker Containers
في بيئة Docker، يتم الاحتفاظ بآخر صورتين دائمًا:
```bash
# تشغيل الحاوية السابقة فوراً
docker-compose -f docker-compose.previous.yml up -d --force-recreate
```

---

## 3. قاعدة البيانات ومزامنة Prisma (Database Rollback)
قبل تطبيق أي تعديلات هيكلية على قاعدة البيانات (Migrations)، يتم أخذ نسخة احتياطية فورية:
```bash
# أخذ Backup قبل التحديث
cp prisma/dev.db prisma/backup_$(date +%Y%m%d_%H%M%S).db

# في حال الحاجة للتراجع واستعادة البيانات:
cp prisma/backup_YYYYMMDD_HHMMSS.db prisma/dev.db
pm2 restart rakna-backend
```

