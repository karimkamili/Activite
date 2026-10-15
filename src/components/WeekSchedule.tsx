import { useEffect, useState } from 'react'
import type { BookingWithId } from '../types/index.ts'
import {
  addDays,
  casablancaNow,
  defaultWeekMonday,
  formatDateAr,
  formatDayMonthAr,
  weekDays,
} from '../lib/dates.ts'
import { arabicError } from '../lib/errors.ts'
import { subscribeDay } from '../lib/firestoreApi.ts'
import { formatTime } from '../lib/schedule.ts'
import Loading from './Loading.tsx'

interface WeekData {
  monday: string
  days: Record<string, BookingWithId[]>
  error: string | null
}

// جدول الأسبوع: يعرض الأنشطة المحجوزة فقط (لا تُعرض أوقات فراغ المهدي)، ويتحدث مباشرة.
export default function WeekSchedule() {
  const today = casablancaNow().date
  const [monday, setMonday] = useState(() => defaultWeekMonday(today))
  const [data, setData] = useState<WeekData>({ monday, days: {}, error: null })
  const dates = weekDays(monday)

  useEffect(() => {
    const unsubs = weekDays(monday).map((date) =>
      subscribeDay(
        date,
        (bookings) =>
          setData((d) =>
            d.monday === monday
              ? { ...d, days: { ...d.days, [date]: bookings }, error: null }
              : { monday, days: { [date]: bookings }, error: null },
          ),
        (err) => setData((d) => ({ monday, days: d.monday === monday ? d.days : {}, error: arabicError(err) })),
      ),
    )
    return () => unsubs.forEach((u) => u())
  }, [monday])

  const current = data.monday === monday ? data : { monday, days: {}, error: null }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonday(addDays(monday, -7))}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          → <span className="hidden sm:inline">الأسبوع </span>السابق
        </button>
        <h2 className="text-center font-semibold text-slate-800">
          {formatDayMonthAr(dates[0])} – {formatDayMonthAr(dates[4])}
        </h2>
        <button
          type="button"
          onClick={() => setMonday(addDays(monday, 7))}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <span className="hidden sm:inline">الأسبوع </span>التالي ←
        </button>
      </div>

      {current.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {current.error}
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        {dates.map((date) => {
          const bookings = current.days[date]
          const isToday = date === today
          return (
            <div
              key={date}
              data-date={date}
              className={`min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ${isToday ? 'ring-2 ring-orange-500' : 'ring-slate-200'}`}
            >
              <h3 className="mb-2 font-semibold text-slate-800">
                {formatDateAr(date)}
                {isToday && <span className="ms-2 text-xs font-semibold text-orange-600">اليوم</span>}
              </h3>
              {bookings === undefined ? (
                <Loading />
              ) : bookings.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد أنشطة.</p>
              ) : (
                <ul className="space-y-2">
                  {bookings.map((b) => (
                    <li key={b.id} className="rounded-lg border-s-4 border-orange-500 bg-navy-50 p-2">
                      <p dir="ltr" className="whitespace-nowrap text-right text-sm font-semibold text-navy-700">
                        {formatTime(b.start)} – {formatTime(b.end)}
                      </p>
                      <p className="break-words text-slate-800">{b.activityName}</p>
                      <p className="break-words text-sm text-slate-600">{b.teacherName}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
