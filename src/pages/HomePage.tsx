import { Link } from 'react-router-dom'
import WeekSchedule from '../components/WeekSchedule.tsx'
import { useAuth } from '../lib/authContext.ts'
import Loading from '../components/Loading.tsx'

export default function HomePage() {
  const { user, loading, error } = useAuth()

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-700">جدول أنشطة التصوير</h1>
        <Link
          to="/book"
          className="w-full rounded-lg bg-orange-600 px-5 py-2.5 text-center font-semibold text-white shadow-sm hover:bg-orange-700 sm:w-auto"
        >
          احجز نشاط تصوير
        </Link>
      </div>
      {loading ? (
        <Loading />
      ) : error || !user ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error ?? 'تعذر تسجيل الدخول. أعد تحميل الصفحة.'}
        </p>
      ) : (
        <WeekSchedule />
      )}
    </main>
  )
}
