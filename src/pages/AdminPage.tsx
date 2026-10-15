import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import AdminDashboard from '../components/admin/AdminDashboard.tsx'
import LoginForm from '../components/admin/LoginForm.tsx'
import { useAuth } from '../lib/authContext.ts'
import { arabicError } from '../lib/errors.ts'
import { auth } from '../lib/firebase.ts'
import { checkIsAdmin } from '../lib/firestoreApi.ts'
import Loading from '../components/Loading.tsx'

const NOT_ALLOWED = 'هذا الحساب غير مسموح له بالدخول إلى صفحة الأستاذ المهدي.'

export default function AdminPage() {
  const { user, loading, error } = useAuth()
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const emailUser = user && !user.isAnonymous ? user : null

  // بعد الدخول بالبريد: التحقق من أن uid موجود في settings/admins، وإلا الخروج فوراً
  useEffect(() => {
    if (!emailUser) return
    let cancelled = false
    checkIsAdmin(emailUser.uid)
      .then((ok) => {
        if (cancelled) return
        if (ok) {
          setVerifiedUid(emailUser.uid)
        } else {
          setNotice(NOT_ALLOWED)
          void signOut(auth)
        }
      })
      .catch((err: unknown) => {
        // خطأ شبكة مؤقت: لا نُخرج المهدي من حسابه، بل نعرض الخطأ مع زر إعادة المحاولة
        if (!cancelled) setCheckError(arabicError(err))
      })
    return () => {
      cancelled = true
    }
  }, [emailUser, attempt])

  let content
  if (loading) {
    content = <Loading />
  } else if (error) {
    content = <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>
  } else if (emailUser && verifiedUid === emailUser.uid) {
    content = <AdminDashboard email={emailUser.email ?? ''} />
  } else if (emailUser && checkError) {
    content = (
      <div role="alert" className="space-y-3 rounded-lg bg-red-50 p-4 text-red-700">
        <p>{checkError}</p>
        <button
          type="button"
          onClick={() => {
            setCheckError(null)
            setAttempt((n) => n + 1)
          }}
          className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  } else if (emailUser) {
    content = <Loading label="جارٍ التحقق من الصلاحيات…" />
  } else {
    content = <LoginForm notice={notice} onSubmitStart={() => setNotice(null)} />
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-navy-700">صفحة الأستاذ المهدي</h1>
      {content}
    </main>
  )
}
