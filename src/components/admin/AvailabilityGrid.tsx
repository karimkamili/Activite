import { useState, type ReactNode } from 'react'
import type { BookingWithId } from '../../types/index.ts'
import { formatDateAr, formatDayMonthAr } from '../../lib/dates.ts'
import { arabicError } from '../../lib/errors.ts'
import { saveAvailability } from '../../lib/firestoreApi.ts'
import {
  effectiveAvailability,
  formatTime,
  hourBlocks,
  isBlockAvailable,
  overlaps,
  toggleBlock,
  type TimeRange,
} from '../../lib/schedule.ts'

interface Props {
  dates: string[]
  today: string
  /** أوقات الفراغ المحفوظة لكل يوم، أو null إن لم يُعدَّل اليوم بعد (= كل الساعات متاحة). */
  stored: Record<string, TimeRange[] | null>
  bookings: Record<string, BookingWithId[]>
}

interface Pending {
  date: string
  block: TimeRange
  affected: BookingWithId[]
}

const WEEKDAY_NAMES = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const LUNCH_START = 750 // 12:30

// جدول الأسبوع للمهدي: كل خانة ساعة، الضغط عليها يقلبها بين «متاح» و«غير متاح».
export default function AvailabilityGrid({ dates, today, stored, bookings }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  // صفوف الجدول: ساعات أطول يوم (الإثنين إلى الخميس)
  const rows = hourBlocks(dates[0])
  const slotsOf = (date: string) => effectiveAvailability(date, stored[date])

  async function apply(date: string, block: TimeRange) {
    const key = `${date}-${block.start}`
    setSaving(key)
    setError(null)
    try {
      await saveAvailability(date, toggleBlock(date, slotsOf(date), block))
      setPending(null)
    } catch (err) {
      setError(arabicError(err))
    } finally {
      setSaving(null)
    }
  }

  function handleClick(date: string, block: TimeRange) {
    setError(null)
    const makingUnavailable = isBlockAvailable(block, slotsOf(date))
    const affected = makingUnavailable ? (bookings[date] ?? []).filter((b) => overlaps(b, block)) : []
    // ساعة عليها حجز: تحذير وتأكيد قبل جعلها غير متاحة
    if (affected.length > 0) setPending({ date, block, affected })
    else void apply(date, block)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded bg-emerald-100 ring-1 ring-emerald-400" /> متاح للحجز
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded bg-slate-200 ring-1 ring-slate-300" /> غير متاح (حصة)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-orange-500" /> عليها حجز
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {pending && (
        <div role="alert" className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="font-semibold">
            تحذير: في ساعة{' '}
            <span dir="ltr" className="whitespace-nowrap">
              {formatTime(pending.block.start)}–{formatTime(pending.block.end)}
            </span>{' '}
            يوم {WEEKDAY_NAMES[dates.indexOf(pending.date)]} {formatDayMonthAr(pending.date)}{' '}
            {pending.affected.length === 1 ? 'حجز موجود' : `${pending.affected.length} حجوزات موجودة`}:
          </p>
          <ul className="list-inside list-disc text-sm">
            {pending.affected.map((b) => (
              <li key={b.id}>
                {b.activityName} ({b.teacherName}){' '}
                <span dir="ltr" className="whitespace-nowrap">
                  {formatTime(b.start)}–{formatTime(b.end)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm">جعل الساعة غير متاحة لا يحذف الحجز. يمكنك حذفه من قائمة الحجوزات أسفله.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => void apply(pending.date, pending.block)}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              اجعلها غير متاحة رغم ذلك
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      <table className="w-full table-fixed border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            <th className="w-14 sm:w-24" />
            {dates.map((date, i) => (
              <th
                key={date}
                className={`rounded-lg px-0.5 py-1 text-xs font-semibold sm:text-sm ${date === today ? 'bg-orange-50 text-orange-700' : 'text-navy-700'}`}
              >
                <span className="block truncate">{WEEKDAY_NAMES[i]}</span>
                <span className="block font-normal text-slate-500">{Number(date.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RowGroup key={row.start} isLunchAfter={row.end === LUNCH_START}>
              <tr>
                <th dir="ltr" className="text-xs font-semibold text-slate-600 sm:text-sm">
                  <span className="block">{formatTime(row.start)}</span>
                  <span className="block font-normal text-slate-400">{formatTime(row.end)}</span>
                </th>
                {dates.map((date) => {
                  const inSchool = hourBlocks(date).some((b) => b.start === row.start)
                  if (!inSchool) {
                    return (
                      <td key={date} className="rounded-lg bg-slate-50 text-slate-300" aria-label="لا دراسة">
                        —
                      </td>
                    )
                  }
                  const available = isBlockAvailable(row, slotsOf(date))
                  const booked = (bookings[date] ?? []).some((b) => overlaps(b, row))
                  const past = date < today
                  const key = `${date}-${row.start}`
                  return (
                    <td key={date} className="p-0">
                      <button
                        type="button"
                        aria-pressed={available}
                        aria-label={`${formatDateAr(date)} ${formatTime(row.start)}–${formatTime(row.end)}`}
                        disabled={past || saving === key}
                        onClick={() => handleClick(date, row)}
                        title={past ? 'يوم مضى' : available ? 'اضغط لجعلها غير متاحة' : 'اضغط لجعلها متاحة'}
                        className={`relative flex h-12 w-full flex-col items-center justify-center rounded-lg text-[11px] font-semibold ring-1 transition sm:h-14 sm:text-sm ${
                          available
                            ? 'bg-emerald-100 text-emerald-800 ring-emerald-400 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-500 ring-slate-300 hover:bg-slate-300'
                        } ${past ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${saving === key ? 'animate-pulse' : ''}`}
                      >
                        {available ? 'متاح' : 'غير متاح'}
                        {booked && (
                          <span className="absolute top-1 left-1 size-2 rounded-full bg-orange-500" aria-label="عليها حجز" />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            </RowGroup>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RowGroup({ children, isLunchAfter }: { children: ReactNode; isLunchAfter: boolean }) {
  return (
    <>
      {children}
      {isLunchAfter && (
        <tr>
          <td colSpan={6} className="py-1 text-xs text-slate-500">
            استراحة الغداء{' '}
            <span dir="ltr" className="whitespace-nowrap">
              12:30–13:30
            </span>
          </td>
        </tr>
      )}
    </>
  )
}
