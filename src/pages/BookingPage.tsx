import { Link } from 'react-router-dom'
import BookingForm from '../components/booking/BookingForm.tsx'
import MyBookings from '../components/booking/MyBookings.tsx'
import { useAuth } from '../lib/authContext.ts'
import Loading from '../components/Loading.tsx'

export default function BookingPage() {
  const { user, loading, error } = useAuth()

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-700">حجز نشاط تصوير</h1>
        <Link to="/" className="text-sm font-semibold text-navy-700 hover:underline">
          العودة إلى جدول الأسبوع
        </Link>
      </div>
      {loading ? (
        <Loading />
      ) : error || !user ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error ?? 'تعذر تسجيل الدخول. أعد تحميل الصفحة.'}
        </p>
      ) : (
        <>
          <BookingForm uid={user.uid} />
          <MyBookings uid={user.uid} />
        </>
      )}
    </main>
  )
}
