import { useState } from 'react'
import type { BookingWithId } from '../../types/index.ts'
import { arabicError } from '../../lib/errors.ts'
import { deleteBooking } from '../../lib/firestoreApi.ts'
import { formatTime } from '../../lib/schedule.ts'

interface Props {
  date: string
  title: string
  bookings: BookingWithId[]
}

export default function BookingsSection({ date, title, bookings }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setBusy(true)
    setError(null)
    try {
      await deleteBooking(date, id)
      setConfirmId(null)
    } catch (err) {
      setError(arabicError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {bookings.length === 0 ? (
        <p className="text-slate-600">لا توجد حجوزات في هذا اليوم.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p dir="ltr" className="text-right font-semibold text-slate-800">
                    {formatTime(b.start)} – {formatTime(b.end)}
                  </p>
                  <p className="break-words text-slate-800">{b.activityName}</p>
                  <p className="break-words text-sm text-slate-600">{b.teacherName}</p>
                </div>
                {confirmId !== b.id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmId(b.id)}
                    className="shrink-0 rounded-lg px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    حذف
                  </button>
                )}
              </div>
              {confirmId === b.id && (
                <div role="alert" className="mt-2 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">هل تريد حذف هذا الحجز نهائياً؟</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(b.id)}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                    >
                      {busy ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
