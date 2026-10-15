# حجز أنشطة التصوير في المدرسة

موقع ثابت (React + Vite + TypeScript + Tailwind) يسمح للأساتذة بحجز أنشطة التصوير ضمن أوقات فراغ الأستاذ المهدي، مع Firebase (Firestore + Authentication) ونشر على GitHub Pages.

## المتطلبات

- Node.js 20 أو أحدث (مع npm).
- حساب Google للدخول إلى [Firebase Console](https://console.firebase.google.com/).

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم املأ القيم (انظر قسم Firebase أسفله)
npm run dev
```

ثم افتح الرابط الذي يظهر في الطرفية (عادةً `http://localhost:5173`).

أوامر أخرى:

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل خادم التطوير |
| `npm run build` | فحص TypeScript وبناء الموقع في مجلد `dist` |
| `npm run lint` | فحص الكود (oxlint) |
| `npm run preview` | معاينة نسخة البناء محلياً |
| `npm test` | اختبارات منطق الأوقات والتواريخ (Vitest) |
| `npm run test:rules` | اختبارات قواعد Firestore على المحاكي (يحتاج Java) |
| `npm run test:e2e` | الاختبار الشامل بـ Playwright على المحاكي (يحتاج Java) |

## إنشاء مشروع Firebase خطوة بخطوة

1. **إنشاء المشروع**
   - افتح [Firebase Console](https://console.firebase.google.com/) ← **Add project** (أو Create a project).
   - اختر اسماً للمشروع، ويمكنك تعطيل Google Analytics (غير ضروري).

2. **تفعيل Firestore**
   - من القائمة الجانبية: **Build ← Firestore Database ← Create database**.
   - اختر موقعاً قريباً (مثلاً `eur3 (europe-west)`).
   - اختر **Start in production mode** (القواعد الخاصة بالمشروع ستُنشر لاحقاً في المرحلة 1).

3. **تفعيل Authentication**
   - **Build ← Authentication ← Get started**.
   - في تبويب **Sign-in method**:
     - فعّل **Email/Password** (الخيار الأول فقط، بدون Email link) ← Save.
     - فعّل **Anonymous** ← Save.
   - في تبويب **Users ← Add user**: أنشئ حساب الأستاذ المهدي (بريد + كلمة سر). كلمة السر لا تُكتب أبداً في الكود.
   - انسخ **User UID** الخاص بهذا الحساب (سيُستعمل في `settings/admins` في المرحلة 1).

4. **نسخ إعدادات الويب**
   - ⚙️ **Project settings ← General ← Your apps** ← اضغط أيقونة الويب `</>`.
   - أعطِ التطبيق اسماً (لا حاجة لـ Firebase Hosting) ← Register app.
   - ستظهر كائن `firebaseConfig`. انسخ قيمه إلى `.env.local`:

     | في firebaseConfig | في .env.local |
     |---|---|
     | `apiKey` | `VITE_FIREBASE_API_KEY` |
     | `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
     | `projectId` | `VITE_FIREBASE_PROJECT_ID` |
     | `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
     | `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
     | `appId` | `VITE_FIREBASE_APP_ID` |

> إعدادات Firebase للويب عامة بطبيعتها (تظهر في المتصفح)، لذلك لا تُعتبر أسراراً. الحماية الحقيقية تكون عبر Firestore Security Rules.
> ملف `.env.local` مُستثنى من git عبر `.gitignore`.

## إضافة الأستاذ المهدي كمسؤول (settings/admins)

1. في Firebase Console: **Firestore Database ← Data ← Start collection**.
2. Collection ID: `settings` ← Document ID: `admins`.
3. أضف حقلاً: الاسم `uids`، النوع **array**، وبداخله عنصر من نوع **string** قيمته **User UID** الخاص بحساب المهدي (من Authentication ← Users).
4. Save. (لا يمكن تعديل `settings` من الموقع، فقط من Console.)

## قواعد الحماية (Firestore Security Rules)

القواعد في الملف [`firestore.rules`](firestore.rules):

| المسار | قراءة | كتابة |
|---|---|---|
| `settings/*` | كل مستخدم مسجل | ممنوعة من الموقع |
| `availability/{YYYY-MM-DD}` | كل مستخدم مسجل | المهدي فقط |
| `days/{YYYY-MM-DD}` | كل مستخدم مسجل | الأستاذ: إضافة حجز واحد لنفسه أو حذف حجزه. المهدي: حذف أي حجز. لا يُعدَّل أي حجز موجود |

يتم التحقق أيضاً من بيانات كل حجز: `start < end`، أوقات بأعداد صحيحة بين 0 و 1440، `durationMinutes = end - start`، نصوص غير فارغة وأقل من 80 حرفاً، `ownerUid` = uid المستخدم، و `createdAt` = وقت الخادم.

### اختبار القواعد

يحتاج Java (11 أو أحدث) لتشغيل Firebase Emulator:

```bash
npm run test:rules
```

### نشر القواعد على Firebase

```bash
npx firebase login
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

استبدل `YOUR_PROJECT_ID` بقيمة `VITE_FIREBASE_PROJECT_ID`. أعد تنفيذ أمر النشر كلما تغير الملف `firestore.rules`.

### التجربة المحلية بدون مشروع Firebase حقيقي

في طرفيتين منفصلتين:

```bash
npm run emulators -- --only auth,firestore
npm run dev:emulator
```

ثم افتح `http://localhost:5174`. الإعدادات في `.env.emulator` (قيم تجريبية وليست أسراراً).

لملء المحاكي ببيانات تجريبية (حساب للمهدي، حساب غير مسموح له، فترة فراغ وحجز) في طرفية ثالثة:

```bash
node scripts/seed-emulator.mjs
```

الحسابات التجريبية مكتوبة في أعلى الملف [`scripts/seed-emulator.mjs`](scripts/seed-emulator.mjs)، وهي موجودة فقط داخل المحاكي.

## صفحة الحجز للأساتذة

الرابط: `#/book`.

- الأستاذ يختار اليوم ومدة النشاط، فتظهر له الأوقات المتاحة (بدايات كل 30 دقيقة) ويختار منها.
- الحجز يكون قبل يوم على الأقل: لا حجز في نفس اليوم.
- إن لم يوجد وقت متاح، يُقترح أقرب يوم فيه وقت (خلال الأسبوعين التاليين).
- «حجوزاتي»: إلغاء الحجز ممكن حتى اليوم السابق للنشاط (المهدي يستطيع حذف أي حجز في أي وقت).

## صفحة الأستاذ المهدي

الرابط: `#/admin` (محلياً: `http://localhost:5173/#/admin`).

- الدخول بالبريد وكلمة السر. إن لم يكن الحساب في `settings/admins` يُرفض الدخول.
- جدول للأسبوع كاملاً (الإثنين إلى الجمعة × ساعات الدراسة: 08:30–09:30 ... 15:30–16:30، والجمعة صباحاً فقط).
- **كل الساعات متاحة ما لم يغيرها المهدي.** الضغط على خانة يجعلها «غير متاح» (عنده حصة)، والضغط مرة أخرى يعيدها «متاح».
- زر «نسخ أوقات الأسبوع السابق» يملأ الأسبوع بأوقات الأسبوع الذي قبله (مع خطوة تأكيد).
- جعل ساعة عليها حجز «غير متاح» يعرض تحذيراً قبل التنفيذ (الحجز نفسه لا يُحذف).
- عرض حجوزات الأسبوع وحذف أي حجز (مع خطوة تأكيد).

## الاختبار الشامل (Playwright)

```bash
npx playwright install chromium   # مرة واحدة فقط
npm run test:e2e
```

يشغّل المحاكي وخادم التطوير تلقائياً، ثم يجرب على الحاسوب والهاتف: المهدي يضيف ساعة فراغ ← أستاذ يحجز ← الحجز يظهر في جدول الأسبوع (مباشرة عند أستاذ آخر يشاهد) ← الأستاذ يلغي ← يختفي. ويتأكد أيضاً أن الحجز في نفس اليوم مرفوض.

## مشاكل وقيود معروفة

1. **منع التداخل يتم في المتصفح فقط.** الحجز داخل transaction تمنع التداخل في الاستعمال العادي، لكن قواعد Firestore لا تتحقق من التداخل بنفسها. شخص يعرف البرمجة ويتجاوز الموقع يستطيع إضافة حجز متداخل (لنفسه فقط)، ويستطيع المهدي حذفه.
2. **قواعد «الحجز والإلغاء قبل يوم»، وأوقات المدرسة، وفراغ المهدي يطبقها الموقع فقط**، وليس قواعد Firestore (نفس الملاحظة أعلاه).
3. **كل الساعات متاحة افتراضياً.** إن لم يفتح المهدي جدول أسبوع معين، يمكن الحجز في أي ساعة منه (حتى فوق حصصه أو في يوم عطلة). الحل: تحضير كل أسبوع مسبقاً (زر «نسخ أوقات الأسبوع السابق»)، وجعل كل ساعات أيام العطل «غير متاح».
4. **«حجوزاتي» مرتبطة بالجهاز والمتصفح.** إن مسح الأستاذ بيانات المتصفح أو غيّر جهازه، لا يستطيع إلغاء حجزه بنفسه، فيطلب ذلك من المهدي.
5. **دخول المهدي على جهاز** يستبدل الدخول المجهول لذلك الجهاز. الحجوزات التي تمت قبل ذلك من نفس الجهاز لن تظهر في «حجوزاتي» عليه (يستطيع المهدي حذفها من صفحته).
6. **أوقات البداية كل 30 دقيقة.** نشاط مدته 15 أو 45 دقيقة قد يترك ربع ساعة غير مستعملة.
7. **رسالة «لم يؤكد الخادم العملية»** تظهر بعد 15 ثانية بدون رد. قد تكون العملية حُفظت فعلاً بعد ذلك، لذلك تطلب الرسالة إعادة تحميل الصفحة للتأكد.
8. **خط Cairo يأتي من Google Fonts.** إن لم يُحمَّل، يظهر خط الجهاز ويعمل الموقع عادياً.
9. **الحجوزات القديمة لا تُحذف تلقائياً** من Firestore (حجم صغير جداً بالنسبة لمدرسة).
10. **على Windows:** إيقاف المحاكي الذي شُغّل يدوياً (`npm run emulators`) قد يترك عملية Java تشغل المنفذ 8080. أغلقها من مدير المهام. أوامر الاختبار (`test:rules` و `test:e2e`) لا تعاني من هذا.

## النشر على GitHub Pages

الملف [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) يبني الموقع (بعد lint والاختبارات) وينشره تلقائياً عند كل push إلى `main`.
في الخطوات أسفله: استبدل `USERNAME` باسم حسابك على GitHub و `REPO` باسم المستودع.

### 1) إنشاء المستودع ورفع الكود

أنشئ مستودعاً جديداً على GitHub (عام Public، لأن GitHub Pages المجاني يتطلب ذلك)، **بدون** README أو .gitignore، ثم من مجلد المشروع:

```bash
git init
git add .
git commit -m "موقع حجز أنشطة التصوير"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### 2) إضافة إعدادات Firebase إلى GitHub

في المستودع: **Settings ← Secrets and variables ← Actions ← تبويب Variables ← New repository variable**، وأضف المتغيرات الستة بنفس قيم `.env.local`:

| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | قيمة `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | قيمة `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | قيمة `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | قيمة `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | قيمة `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | قيمة `appId` |

> هذه القيم عامة بطبيعتها (تظهر في أي متصفح يفتح الموقع)، لذا **Variables** كافية. إن فضّلت إخفاءها في واجهة GitHub، أضفها في تبويب **Secrets** بنفس الأسماء؛ الملف يقبل الاثنين.
> إن نسيت متغيراً، يفشل البناء برسالة تذكر اسمه.

### 3) تفعيل GitHub Pages

**Settings ← Pages ← Build and deployment ← Source: GitHub Actions**.

ثم شغّل النشر: **Actions ← Deploy to GitHub Pages ← Run workflow** (أو أي push إلى `main`). إن كان أول push قد فشل لأن المتغيرات لم تكن مضافة بعد، أعد تشغيله من نفس المكان (Re-run jobs).

### 4) السماح بالنطاق في Firebase (ضروري)

في Firebase Console: **Authentication ← Settings ← Authorized domains ← Add domain** وأضف:

```
USERNAME.github.io
```

بدون هذا يفشل الدخول (للأساتذة والمهدي) على الموقع المنشور.

### 5) قواعد Firestore والمسؤول

إن لم تفعل بعد: انشر القواعد (قسم «نشر القواعد على Firebase» أعلاه)، وأضف uid المهدي في `settings/admins` (قسم «إضافة الأستاذ المهدي كمسؤول»).

### الروابط

- رابط الأساتذة: `https://USERNAME.github.io/REPO/`
- رابط الأستاذ المهدي: `https://USERNAME.github.io/REPO/#/admin`

> قيمة `base` في Vite (`/REPO/`) تُحسب تلقائياً داخل GitHub Actions من اسم المستودع، وتبقى `/` محلياً. مستودع باسم `USERNAME.github.io` يُنشر على جذر النطاق تلقائياً. لفرض قيمة أخرى: `VITE_BASE=/اسم-آخر/ npm run build`.

## بنية المجلدات

```
src/
  pages/       صفحات الموقع (الرئيسية، الحجز، المهدي)
  components/  مكونات الواجهة المشتركة
  lib/         Firebase ومنطق حساب الأوقات
tests/unit/    اختبارات منطق الأوقات والتواريخ
tests/rules/   اختبارات قواعد Firestore
e2e/           الاختبار الشامل (Playwright)
scripts/       سكريبت تشغيل المحاكي مع الاختبارات
  types/       أنواع TypeScript المشتركة
```
