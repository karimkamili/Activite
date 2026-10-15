import { initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const env = import.meta.env

// إعدادات Firebase للويب عامة بطبيعتها؛ الحماية تتم عبر Firestore Security Rules.
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

// بدون الإعدادات، getAuth يرمي خطأ فوراً ويتوقف الموقع كله؛ نستعمل قيماً مؤقتة
// ويعرض الموقع رسالة واضحة بدل ذلك (انظر AuthProvider).
export const app = initializeApp(
  firebaseConfigured ? firebaseConfig : { apiKey: 'not-configured', projectId: 'not-configured' },
)
export const auth = getAuth(app)
export const db = getFirestore(app)

// للتطوير والاختبار المحلي: VITE_USE_EMULATOR=true يربط الموقع بـ Firebase Emulator
if (env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

let anonymousSignIn: Promise<User> | null = null

/**
 * دخول مجهول للأستاذ. إذا استُدعيت الدالة مرتين قبل انتهاء الأولى، تعيد نفس العملية
 * حتى لا يُنشأ أكثر من مستخدم مجهول.
 */
export function signInAnonymouslyOnce(): Promise<User> {
  anonymousSignIn ??= signInAnonymously(auth)
    .then((cred) => cred.user)
    .finally(() => {
      anonymousSignIn = null
    })
  return anonymousSignIn
}
