# 🍗 دواجن الوطنية - نظام الطلبات

## البدء السريع

### 1️⃣ إعداد التلغرام
قبل البدء، تأكد من ربط التطبيق بتلغرام:
```
اقرأ: TELEGRAM-SETUP.md
```

انسخ ملف `.env.example` إلى `.env` وأضفها:
```
TELEGRAM_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### 2️⃣ تشغيل الخادم
```bash
npm install    # تثبيت المكتبات (مرة واحدة فقط)
npm start      # تشغيل الخادم
```

أو:
```bash
node telegram-bot.js
```

الخادم سيعمل على: `http://localhost:3000`

### 3️⃣ فتح الموقع
في المتصفح، افتح:
```
file:///C:\Users\user\OneDrive\Desktop\الكويتعبداللهTaamen-final-دجاج\index.html
```

أو اضغط مرتين على `index.html` في المجلد.

### 4️⃣ العملية
1. **صفحة المنتجات** (index.html) - اختر الكمية والسعر
2. **بيانات العنوان** (address.html) - أدخل اسمك والعنوان
3. **الفاتورة والدفع** (billing.html) - تحقق من الإجمالي واختر طريقة الدفع
4. **تأكيد الطلب** (paymen.html) - الطلب يُرسل إلى تلغرام وقاعدة البيانات

---

## 📁 هيكل المشروع

```
.
├── index.html              ← الصفحة الرئيسية
├── address.html            ← بيانات العنوان
├── billing.html            ← الفاتورة والدفع
├── paymen.html             ← تأكيد الطلب
├── cart.html               ← السلة
├── code.html               ← أكواد المنتجات
├── dashboard.html          ← لوحة التحكم
├── telegram-bot.js         ← خادم Node.js (يرسل للتلغرام)
├── orders.db               ← قاعدة البيانات (SQLite)
├── README.md               ← ملف المشروع
│
├── docs/                   ← التوثيق والأدلة
│   ├── HELP.html
│   ├── HOW-TO-RUN.txt
│   └── ... (أدلة أخرى)
│
├── tests/                  ← ملفات الاختبار
│   ├── test-full-flow.js
│   └── test-server.js
│
├── archive/                ← ملفات قديمة
│   ├── address.html.backup
│   └── ... (نسخ احتياطية)
│
├── assets/                 ← الصور والموارد
├── node_modules/           ← المكتبات المثبتة
└── package.json            ← إعدادات المشروع
```

---

## 🔧 الإعدادات

### متطلبات
- Node.js v14+
- npm

### التثبيت
```bash
npm install
```

### متغيرات البيئة
أنشئ ملف `.env` في الجذر:
```
TELEGRAM_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

> ⚠️ تأكد من عدم كشف التوكن في الكود!

---

## 🐛 استكشاف الأخطاء

### الخادم لا يعمل؟
```bash
# تحقق من المنفذ 3000
netstat -ano | findstr :3000

# أو جرّب منفذ آخر بتعديل telegram-bot.js
```

### الطلب لا يصل إلى تلغرام؟
1. تحقق من التوكن ومعرّف الدردشة في `.env`
2. اختبر الاتصال: `http://localhost:3000/api/status`
3. تحقق من السجلات في الكونسول

### مشاكل مع الأرقام العربية؟
تأكد من أن المتصفح يستخدم UTF-8. الصفحات جاهزة للعربية.

---

## 📚 أدلة إضافية
- اطّلع على `docs/README.md` للتفاصيل الكاملة
- اقرأ `docs/HOW-TO-RUN.txt` للخطوات المفصلة
- انظر `docs/HELP.html` للمساعدة التفاعلية

---

**آخر تحديث:** 2026-11-07 | **الحالة:** ✅ جاهز للاستخدام
