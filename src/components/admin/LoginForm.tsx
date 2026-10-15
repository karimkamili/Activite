import { signInWithEmailAndPassword } from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { arabicError } from '../../lib/errors.ts'
import { auth } from '../../lib/firebase.ts'

interface Props {
  notice: string | null
  onSubmitStart: () => void
}

export default function LoginForm({ notice, onSubmitStart }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmitStart()
    setError(null)
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      setError(arabicError(err))
    } finally {
      setBusy(false)
    }
  }

  const message = error ?? notice

  return (
    // noValidate: رسائل الخطأ من الموقع بالعربية بدل رسائل المتصفح
    <form noValidate onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Larus School"
        width={273}
        height={400}
        className="mx-auto h-32 w-auto"
      />
      <h2 className="text-lg font-semibold text-navy-700">تسجيل الدخول</h2>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-700">البريد الإلكتروني</span>
        <input
          type="email"
          dir="ltr"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-700">كلمة السر</span>
        <input
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-left focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
        />
      </label>
      {message && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-navy-700 px-4 py-2 font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
      >
        {busy ? 'جارٍ الدخول…' : 'دخول'}
      </button>
    </form>
  )
}
