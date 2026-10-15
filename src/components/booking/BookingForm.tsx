import { useEffect, useState, type FormEvent } from 'react'
import { casablancaNow, firstBookableDate, formatDateAr, isBeforeDay, isSchoolDay } from '../../lib/dates.ts'
import { arabicError } from '../../lib/errors.ts'
import { bookSlot, findNextAvailableDay, subscribeDayAvailability } from '../../lib/firestoreApi.ts'
import { availableStarts, formatTime, weekdayOf, type TimeRange } from '../../lib/schedule.ts'
import Loading from '../Loading.tsx'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const NAME_KEY = 'teacherName'
const MAX_TEXT = 79
const LUNCH_START = 750 // 12:30

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // التخزين غير متاح (مثلاً نافذة خاصة): الاسم فقط لن يُحفظ للمرة القادمة
  }
}

function durationLabel(minutes: number): string {
  if (minutes === 60) return 'ساعة'
  if (minutes === 90) return 'ساعة ونصف'
  if (minutes === 120) return 'ساعتان'
  return `${minutes} دقيقة`
}

interface DayState {
  date: string
  slots: TimeRange[]
  bookings: TimeRange[]
}

type Suggestion = { key: string; value: { date: string; slot: TimeRange } | null }

export default function BookingForm({ uid }: { uid: string }) {
  const today = casablancaNow().date
  const minDate = firstBookableDate(today)
  const [teacherName, setTeacherName] = useState(loadName)
  const [activityName, setActivityName] = useState('')
  const [date, setDate] = useState(minDate)
  const [duration, setDuration] = useState(60)
  const [selected, setSelected] = useState<number | null>(null)
  const [day, setDay] = useState<DayState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ date: string; slot: TimeRange } | null>(null)

  const validDate = weekdayOf(date) !== null
  const dateProblem = !validDate
    ? null
    : !isBeforeDay(date, today)
      ? date === today
        ? 'لا يمكن الحجز في نفس اليوم. الحجز يكون قبل يوم على الأقل.'
        : 'لا يمكن الحجز في يوم مضى.'
      : !isSchoolDay(date)
        ? 'لا دراسة يوم السبت والأحد. اختر يوماً من الإثنين إلى الجمعة.'
        : null
  const canShowTimes = validDate && dateProblem === null

  // متابعة مباشرة لأوقات اليوم المختار: إن حجز أستاذ آخر، تختفي الأوقات المحجوزة فوراً
  useEffect(() => {
    if (!canShowTimes) return
    return subscribeDayAvailability(
      date,
      (d) => {
        setDay({ date, ...d })
        setLoadError(null)
      },
      (err) => setLoadError(arabicError(err)),
    )
  }, [date, canShowTimes])

  const options = canShowTimes && day?.date === date ? availableStarts(date, duration, day.slots, day.bookings) : null
  const chosen = options?.find((o) => o.start === selected) ?? null
  const suggestionKey = `${date}|${duration}`

  // لا يوجد وقت كافٍ: نبحث عن أقرب يوم فيه وقت
  const noTime = options !== null && options.length === 0
  useEffect(() => {
    if (!noTime) return
    let cancelled = false
    findNextAvailableDay(date, duration)
      .then((value) => !cancelled && setSuggestion({ key: suggestionKey, value }))
      .catch(() => !cancelled && setSuggestion({ key: suggestionKey, value: null }))
    return () => {
      cancelled = true
    }
  }, [noTime, date, duration, suggestionKey])

  function validate(): string | null {
    if (!teacherName.trim()) return 'أدخل اسمك.'
    if (!activityName.trim()) return 'أدخل اسم النشاط.'
    if (!validDate) return 'اختر يوماً صحيحاً.'
    if (dateProblem) return dateProblem
    if (!chosen) return 'اختر وقت النشاط من الأوقات المتاحة.'
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSuccess(null)
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setBusy(true)
    const name = teacherName.trim()
    saveName(name)
    try {
      const slot = await bookSlot({
        teacherName: name,
        activityName: activityName.trim(),
        date,
        start: chosen!.start,
        durationMinutes: duration,
        ownerUid: uid,
      })
      setSuccess({ date, slot })
      setActivityName('')
      setSelected(null)
    } catch (err) {
      setError(arabicError(err))
      setSelected(null)
    } finally {
      setBusy(false)
    }
  }

  const morning = options?.filter((o) => o.start < LUNCH_START) ?? []
  const afternoon = options?.filter((o) => o.start >= LUNCH_START) ?? []
  const currentSuggestion = suggestion?.key === suggestionKey ? suggestion : null

  const timeButton = (o: TimeRange) => {
    const active = o.start === selected
    return (
      <button
        key={o.start}
        type="button"
        aria-pressed={active}
        onClick={() => {
          setSelected(o.start)
          setError(null)
          setSuccess(null)
        }}
        className={`rounded-lg px-2 py-2 text-sm font-semibold ring-1 transition ${
          active ? 'bg-navy-700 text-white ring-navy-700' : 'bg-white text-navy-700 ring-slate-300 hover:bg-navy-50'
        }`}
      >
        <span dir="ltr" className="whitespace-nowrap">
          {formatTime(o.start)} – {formatTime(o.end)}
        </span>
      </button>
    )
  }

  return (
    // noValidate: رسائل التحقق من الموقع بالعربية بدل رسائل المتصفح
    <form noValidate onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <label className="block">
        <span className="mb-1 block text-sm text-slate-700">اسمك</span>
        <input
          required
          maxLength={MAX_TEXT}
          autoComplete="name"
          value={teacherName}
          onChange={(e) => setTeacherName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-slate-700">اسم النشاط</span>
        <input
          required
          maxLength={MAX_TEXT}
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm text-slate-700">اليوم</span>
          <input
            type="date"
            required
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setSelected(null)
              setSuccess(null)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
          />
          {validDate && (
            <span className={`mt-1 block text-sm ${dateProblem ? 'text-amber-700' : 'text-slate-600'}`}>
              {dateProblem ?? formatDateAr(date)}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-slate-700">مدة النشاط</span>
          <select
            value={duration}
            onChange={(e) => {
              setDuration(Number(e.target.value))
              setSelected(null)
              setSuccess(null)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-navy-600 focus:ring-2 focus:ring-navy-200 focus:outline-none"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {durationLabel(d)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canShowTimes && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm text-slate-700">اختر وقت النشاط</legend>
          {loadError ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
              {loadError}
            </p>
          ) : options === null ? (
            <Loading label="جارٍ تحميل الأوقات المتاحة…" />
          ) : options.length === 0 ? (
            <div role="alert" className="space-y-3 rounded-lg bg-amber-50 p-4 text-amber-900">
              <p className="font-semibold">
                لا يوجد وقت متاح يوم {formatDateAr(date)} لنشاط مدته {durationLabel(duration)}.
              </p>
              {currentSuggestion === null ? (
                <Loading label="جارٍ البحث عن أقرب يوم متاح…" />
              ) : currentSuggestion.value ? (
                <>
                  <p>
                    أقرب يوم فيه وقت متاح: <strong>{formatDateAr(currentSuggestion.value.date)}</strong> (ابتداءً من
                    الساعة{' '}
                    <span dir="ltr" className="whitespace-nowrap">
                      {formatTime(currentSuggestion.value.slot.start)}
                    </span>
                    ).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(currentSuggestion.value!.date)
                      setSelected(null)
                    }}
                    className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    عرض أوقات هذا اليوم
                  </button>
                </>
              ) : (
                <p>ولا يوجد وقت متاح خلال الأسبوعين التاليين. جرّب مدة أقصر أو تواصل مع الأستاذ المهدي.</p>
              )}
            </div>
          ) : (
            <>
              {morning.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500">الصباح</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{morning.map(timeButton)}</div>
                </div>
              )}
              {afternoon.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500">بعد الزوال</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{afternoon.map(timeButton)}</div>
                </div>
              )}
            </>
          )}
        </fieldset>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <div role="status" className="space-y-1 rounded-lg bg-emerald-50 p-4 text-emerald-800">
          <p className="font-semibold">
            تم الحجز. نشاطك يوم {formatDateAr(success.date)} من الساعة{' '}
            <span dir="ltr" className="whitespace-nowrap">
              {formatTime(success.slot.start)}
            </span>{' '}
            إلى{' '}
            <span dir="ltr" className="whitespace-nowrap">
              {formatTime(success.slot.end)}
            </span>
            .
          </p>
          <p className="text-sm">إن أخطأت، يمكنك إلغاء الحجز من «حجوزاتي» أسفله حتى اليوم السابق للنشاط.</p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-60"
      >
        {busy
          ? 'جارٍ الحجز…'
          : chosen
            ? `احجز من ${formatTime(chosen.start)} إلى ${formatTime(chosen.end)}`
            : 'احجز'}
      </button>
    </form>
  )
}
