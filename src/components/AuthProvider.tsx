import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from '../lib/authContext.ts'
import { arabicError } from '../lib/errors.ts'
import { auth, firebaseConfigured, signInAnonymouslyOnce } from '../lib/firebase.ts'

const NOT_CONFIGURED: AuthState = {
  user: null,
  loading: false,
  error: 'إعدادات Firebase غير موجودة. انسخ ملف .env.example إلى .env.local واملأ القيم.',
}

// يسجل دخول الأستاذ تلقائياً (دخول مجهول) عند فتح الموقع، وكذلك بعد خروج المهدي من حسابه.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(
    firebaseConfigured ? { user: null, loading: true, error: null } : NOT_CONFIGURED,
  )

  useEffect(() => {
    if (!firebaseConfigured) return
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ user, loading: false, error: null })
        return
      }
      setState({ user: null, loading: true, error: null })
      signInAnonymouslyOnce().catch((err: unknown) =>
        setState({ user: null, loading: false, error: arabicError(err) }),
      )
    })
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
