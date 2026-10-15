const MESSAGES: Record<string, string> = {
  'permission-denied': 'ليست لديك صلاحية للقيام بهذه العملية.',
  unavailable: 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
  'deadline-exceeded': 'انتهت مهلة الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
  'auth/network-request-failed': 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.',
  'auth/invalid-credential': 'البريد الإلكتروني أو كلمة السر غير صحيحة.',
  'auth/invalid-login-credentials': 'البريد الإلكتروني أو كلمة السر غير صحيحة.',
  'auth/wrong-password': 'البريد الإلكتروني أو كلمة السر غير صحيحة.',
  'auth/user-not-found': 'البريد الإلكتروني أو كلمة السر غير صحيحة.',
  'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة.',
  'auth/missing-password': 'أدخل كلمة السر.',
  'auth/user-disabled': 'هذا الحساب موقوف.',
  aborted: 'تعذر إتمام الحجز بسبب حجوزات أخرى في نفس اللحظة. أعد المحاولة.',
  'booking/past-date': 'لا يمكن الحجز في يوم مضى.',
  'booking/too-late': 'الحجز والإلغاء يكونان قبل يوم النشاط على الأقل.',
  'booking/slot-taken': 'هذا الوقت لم يعد متاحاً (ربما حجزه أستاذ آخر الآن). اختر وقتاً آخر.',
  'app/offline': 'لا يوجد اتصال بالإنترنت. تحقق من الاتصال ثم أعد المحاولة.',
  'app/write-timeout': 'لم يؤكد الخادم العملية. تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة للتأكد.',
  unauthenticated: 'انتهت الجلسة. أعد تحميل الصفحة.',
  'resource-exhausted': 'الخدمة مشغولة حالياً. أعد المحاولة بعد قليل.',
  'auth/operation-not-allowed': 'طريقة الدخول هذه غير مفعّلة في Firebase.',
  'auth/admin-restricted-operation': 'الدخول المجهول غير مفعّل في Firebase.',
  'auth/invalid-api-key': 'إعدادات Firebase غير صحيحة (مفتاح API). تحقق من قيم VITE_FIREBASE_* في إعدادات النشر.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
}

/** يحول أخطاء Firebase إلى رسالة واضحة بالعربية. */
export function arabicError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
  // مثلاً: auth/api-key-not-valid.-please-pass-a-valid-api-key.
  if (code.startsWith('auth/api-key-not-valid')) return MESSAGES['auth/invalid-api-key']
  return MESSAGES[code] ?? 'حدث خطأ غير متوقع. أعد المحاولة.'
}
