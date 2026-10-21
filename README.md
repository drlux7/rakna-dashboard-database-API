# منظومة ركنة المتكاملة: النظام الخلفي، قاعدة البيانات، ولوحة التحكم الإدارية
# Rakna Backend API, Database & Admin Dashboard 🚗⚡

المجلد المركزي لنظام **ركنة (Rakna)** الذي يضم النظام الخلفي (Backend API)، قاعدة البيانات (Database)، ولوحة التحكم الإدارية (Admin Dashboard)، متوافقاً بنسبة 100% مع تطبيق فلاتر للهواتف الذكية.

---

## 🌟 المعمارية المنجزة ونقاط التشغيل الحية

| الخدمة | التقنية | الرابط / المنفذ | الحالة الحالية |
| :--- | :--- | :--- | :--- |
| **Backend REST API** | Express + TypeScript + Prisma | `http://localhost:5000/api/v1` | 🟢 متصل وقيد التشغيل |
| **WebSocket Gateway** | Socket.io | `ws://localhost:5000` | 🟢 جاهز للرسائل الفورية |
| **Database Engine** | SQLite (محلي) / PostgreSQL (إنتاج) | `file:./dev.db` / `docker-compose.yml` | 🟢 تم البناء والتغذية (Seeded) |
| **Admin Dashboard UI** | React + Vite + VeriTag Aesthetics | `http://localhost:3000` | 🟢 متصل وقيد التشغيل |

---

## 🔐 بيانات الدخول الافتراضية للوحة التحكم (Admin Credentials)

- **البريد الإلكتروني:** `admin@rakna.app`
- **كلمة المرور:** `Admin@123456`
- **الصلاحية:** `SUPER_ADMIN` (مدير النظام المركزي)

---

## 📁 هيكلية المجلد (Directory Architecture)

```text
rakna dashboard&database&API/
├── PLAN.md                     # وثيقة الخطة الهندسية والمعمارية الشاملة
├── README.md                   # دليل التشغيل والتوثيق المكتمل (هذا الملف)
├── docker-compose.yml          # بيئة الإنتاج لـ PostgreSQL 16 و Redis 7
├── backend/                    # تطبيق النظام الخلفي (Node.js + Express + Prisma)
│   ├── .env                    # إعدادات البيئة والمنافذ ومفاتيح الـ JWT
│   ├── prisma/
│   │   ├── schema.prisma       # مخطط قاعدة البيانات (User, Car, Tag, Chat, Order, ...)
│   │   ├── seed.ts             # سكريبت التغذية الأولية بالبيانات والمنتجات
│   │   └── dev.db              # ملف قاعدة البيانات المحلي
│   └── src/
│       ├── config/             # تهيئة Prisma ومحركات الاتصال
│       ├── controllers/        # وحدات التحكم (Auth, Cars, Tags, Reporter, Chats, Store, Admin)
│       ├── middlewares/        # التحقق من صلاحيات الملاك والمشرفين
│       ├── sockets/            # بوابة Socket.io للبث والتراسل اللحظي
│       └── server.ts           # نقطة الانطلاق الأساسية للـ API
└── dashboard/                  # لوحة التحكم الإدارية (React + Vite + Modern RTL)
    ├── index.html              # خطوط Cairo و Outfit وتصميم عربي أصيل
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx             # تطبيق لوحة التحكم، المؤشرات، ومولد الـ Tags
        ├── index.css           # نظام التصميم وهوية ركنة الذهبية والداكنة
        └── services/
            └── api.js          # عميل الاتصال المباشر بالـ Backend API
```

---

## 🚀 كيفية تشغيل المنظومة (Getting Started)

### 1. تشغيل النظام الخلفي وقاعدة البيانات (Backend API)
```bash
cd "d:\flutter work\rakna\rakna dashboard&database&API\backend"

# تثبيت الحزم (إن لم تكن مثبتة)
npm install

# مزامنة قاعدة البيانات وتوليد Prisma Client
npm run prisma:push

# تغذية قاعدة البيانات بالبيانات الأولية (Admin + المنتجات + مستخدم تجريبي)
npm run prisma:seed

# تشغيل الخادم
npm run dev
# أو تشغيل النسخة المترجمة:
npm run build && npm start
```
*سيعمل الخادم على المنفذ `http://localhost:5000` ويمكن فحص الحالة عبر `http://localhost:5000/api/v1/health`.*

### 2. تشغيل لوحة التحكم الإدارية (Admin Dashboard)
```bash
cd "d:\flutter work\rakna\rakna dashboard&database&API\dashboard"

# تثبيت الحزم
npm install

# تشغيل سيرفر التطوير
npm run dev
```
*ستفتح لوحة التحكم على `http://localhost:3000`.*

---

## 🛠️ أبرز الميزات المطبقة بنجاح

### 1. قاعدة 1 Car = 1 Tag الصارمة:
- قيد فريد في قاعدة البيانات يمنع ربط الملصق بأكثر من سيارة في آن واحد.
- عند حذف سيارة، يتحرر الملصق تلقائياً ويبقى في محفظة المستخدم.

### 2. الخصوصية الصفرية للمُبلّغ (Zero-Knowledge Broker):
- مسار `/api/v1/reporter/resolve-tag/:tagCode` يعيد ماركة وموديل ولون السيارة فقط دون كشف اسم أو هاتف المالك نهائياً.
- بدء جلسة مجهولة للمُبلّغ بدون الحاجة لتسجيل حساب.

### 3. مولّد دفعات الـ Tags والطباعة للمطابع (Batch Tag Generator):
- في لوحة التحكم الإدارية: تحديد نوع الملصق (شنطة السيارة المدرع أو الزجاج الشفاف)، الكمية (5 حتى 100)، ورقم الدفعة.
- توليد فوري لرموز الـ QR المتجهة العالية الدقة (SVG) ومفاتيح NFC المشفرة.
- إمكانية طباعة شيت كامل بضغطة زر (`window.print`) مخصص للمطابع.

### 4. إدارة متجر ملصقات ركنة وشحن المحافظات (Orders & COD):
- إدارة طلبات الدفع عند الاستلام لمحافظات مصر الـ 27.
- فلترة وتحديث فوري لحالة الشحن (`PENDING` -> `PROCESSING` -> `SHIPPED` -> `DELIVERED`).

### 5. محادثات لحظية وإشعارات (WebSockets & Notifications):
- إشعارات فورية لمالك السيارة عند مسح الـ Tag عبر كاميرا الهاتف أو NFC.
- فتح غرفة شات مؤقتة مع المُبلّغ مع ميزة حظر المحادثة ومسح الرسائل.
