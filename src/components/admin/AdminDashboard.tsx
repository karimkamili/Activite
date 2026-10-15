import { signOut } from 'firebase/auth'
import { useEffect, useState } from 'react'
import type { BookingWithId } from '../../types/index.ts'
import { addDays, casablancaNow, defaultWeekMonday, formatDateAr, formatDayMonthAr, weekDays } from '../../lib/dates.ts'
import { arabicError } from '../../lib/errors.ts'
import { auth } from '../../lib/firebase.ts'
import { copyWeekAvailability, subscribeAvailability, subscribeDay } from '../../lib/firestoreApi.ts'
import type { TimeRange } from '../../lib/schedule.ts'
import Loading from '../Loading.tsx'
import AvailabilityGrid from './AvailabilityGrid.tsx'
import BookingsSection from './BookingsSection.tsx'

interface WeekData {
  monday: string
  stored: Record<string, TimeRange[] | null>
  bookings: Record<string, BookingWithId[]>
  error: string | null
}

export default function AdminDashboard({ email }: { email: string }) {
  const today = casablancaNow().date
  const [monday, setMonday] = useState(() => defaultWeekMonday(today))
  const [data, setData] = useState<WeekData>({ monday, stored: {}, bookings: {}, error: null })
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyMessage, setCopyMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const dates = weekDays(monday)

  useEffect(() => {
    const fresh = (d: WeekData) => (d.monday === monday ? d : { monday, stored: {}, bookings: {}, error: null })
    const onError = (err: unknown) => setData((d) => ({ ...fresh(d), error: arabicError(err) }))
    const unsubs = weekDays(monday).flatMap((date) => [
      subscribeAvailability(
        date,
        (slots) => setData((d) => ({ ...fresh(d), stored: { ...fresh(d).stored, [date]: slots } })),
        onError,
      ),
      subscribeDay(
        date,
        (list) => setData((d) => ({ ...fresh(d), bookings: { ...fresh(d).bookings, [date]: list } })),
        onError,
      ),
    ])
    return () => unsubs.forEach((u) => u())
  }, [monday])

  function changeWeek(delta: number) {
    setMonday(addDays(monday, delta))
    setConfirmCopy(false)
    setCopyMessage(null)
  }

  async function copyPreviousWeek() {
    setCopying(true)
    setCopyMessage(null)
    try {
      await copyWeekAvailability(addDays(monday, -7), monday)
      setCopyMessage({ ok: true, text: 'تم نسخ أوقات الأسبوع السابق.' })
      setConfirmCopy(false)
    } catch (err) {
      setCopyMessage({ ok: false, text: arabicError(err) })
    } finally {
      setCopying(false)
    }
  }

  const current = data.monday === monday ? data : { monday, stored: {}, bookings: {}, error: null }
  const ready = dates.every((d) => d in current.stored && d in current.bookings)
  const daysWithBookings = dates.filter((d) => (current.bookings[d] ?? []).length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-600">
          متصل باسم <span dir="ltr" className="font-medium text-slate-800">{email}</span>
        </p>
        <button
          type="button"
          onClick={() => void signOut(auth)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          تسجيل الخروج
        </button>
      </div>

      <section className="space-y-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-700">أوقات فراغي</h2>
          <p className="text-sm text-slate-600">
            اضغط على أي ساعة لتصبح غير متاحة (عندك حصة)، واضغط مرة أخرى لتصبح متاحة. كل الساعات متاحة ما لم تغيرها.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => changeWeek(-7)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            → <span className="hidden sm:inline">الأسبوع </span>السابق
          </button>
          <h3 className="text-center font-semibold text-slate-800">
            {formatDayMonthAr(dates[0])} – {formatDayMonthAr(dates[4])}
          </h3>
          <button
            type="button"
            onClick={() => changeWeek(7)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="hidden sm:inline">الأسبوع </span>التالي ←
          </button>
        </div>

        {current.error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            {current.error}
          </p>
        ) : !ready ? (
          <Loading label="جارٍ تحميل الأسبوع…" />
        ) : (
          <>
            <AvailabilityGrid
              key={monday}
              dates={dates}
              today={today}
              stored={current.stored}
              bookings={current.bookings}
            />

            <div className="space-y-2 border-t border-slate-200 pt-3">
              {!confirmCopy ? (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmCopy(true)
                    setCopyMessage(null)
                  }}
                  className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-100"
                >
                  نسخ أوقات الأسبوع السابق
                </button>
              ) : (
                <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <p className="text-sm">
                    سيتم استبدال أوقات هذا الأسبوع كلها بأوقات أسبوع {formatDayMonthAr(addDays(monday, -7))}. هل
                    تريد المتابعة؟
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={copying}
                      onClick={() => void copyPreviousWeek()}
                      className="rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                    >
                      {copying ? 'جارٍ النسخ…' : 'نعم، انسخ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCopy(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
              {copyMessage && (
                <p
                  role={copyMessage.ok ? 'status' : 'alert'}
                  className={`rounded-lg p-3 text-sm ${copyMessage.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
                >
                  {copyMessage.text}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {ready && !current.error && (
        <section className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-navy-700">حجوزات هذا الأسبوع</h2>
          {daysWithBookings.length === 0 ? (
            <p className="text-slate-600">لا توجد حجوزات في هذا الأسبوع.</p>
          ) : (
            daysWithBookings.map((date) => (
              <BookingsSection
                key={date}
                date={date}
                title={formatDateAr(date)}
                bookings={current.bookings[date] ?? []}
              />
            ))
          )}
        </section>
      )}
    </div>
  )
}
