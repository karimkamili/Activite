import { useEffect, useState } from 'react'
import type { BookingWithId } from '../../types/index.ts'
import { casablancaNow, formatDateAr, isBeforeDay } from '../../lib/dates.ts'
import { arabicError } from '../../lib/errors.ts'
import { cancelMyBooking, subscribeMyBookings } from '../../lib/firestoreApi.ts'
import { formatTime } from '../../lib/schedule.ts'
import Loading from '../Loading.tsx'

type MyBooking = BookingWithId & { date: string }

export default function MyBookings({ uid }: { uid: string }) {
  const today = casablancaNow().date
  const [bookings, setBookings] = useState<MyBooking[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeMyBookings(
        uid,
        today,
        (list) => {
          setBookings(list)
          setLoadError(null)
        },
        (err) => setLoadError(arabicError(err)),
      ),
    [uid, today],
  )

  async function cancel(b: MyBooking) {
    setBusy(true)
    setError(null)
    try {
      await cancelMyBooking(b.date, b.id)
      setConfirmId(null)
    } catch (err) {
      setError(arabicError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold text-navy-700">حجوزاتي</h2>
        <p className="text-sm text-slate-500">الحجوزات التي تمت من هذا الجهاز. يمكن إلغاء الحجز حتى اليوم السابق للنشاط.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {loadError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {loadError}
        </p>
      ) : bookings === null ? (
        <Loading />
      ) : bookings.length === 0 ? (
        <p className="text-slate-600">لا توجد حجوزات من هذا الجهاز.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{formatDateAr(b.date)}</p>
                  <p dir="ltr" className="whitespace-nowrap text-right font-semibold text-slate-800">
                    {formatTime(b.start)} – {formatTime(b.end)}
                  </p>
                  <p className="break-words text-slate-800">{b.activityName}</p>
                </div>
                {!isBeforeDay(b.date, today) ? (
                  <span className="shrink-0 text-xs text-slate-500">لا يمكن الإلغاء يوم النشاط</span>
                ) : confirmId !== b.id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmId(b.id)}
                    className="shrink-0 rounded-lg px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    إلغاء الحجز
                  </button>
                )}
              </div>
              {confirmId === b.id && (
                <div role="alert" className="mt-2 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">هل تريد إلغاء هذا الحجز؟</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cancel(b)}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                    >
                      {busy ? 'جارٍ الإلغاء…' : 'نعم، ألغِ الحجز'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      تراجع
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
