import { SCHOOL_HOURS, weekdayOf, type SchoolHours } from './schedule.ts'

export const TIME_ZONE = 'Africa/Casablanca'

/** التاريخ والدقيقة الحالية بتوقيت المغرب، مهما كانت المنطقة الزمنية للجهاز. */
export function casablancaNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** يضيف أياماً إلى تاريخ تقويمي YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function isSchoolDay(date: string, schoolHours: SchoolHours = SCHOOL_HOURS): boolean {
  const weekday = weekdayOf(date)
  return weekday !== null && (schoolHours[weekday] ?? []).length > 0
}

/** أول يوم دراسة ابتداءً من التاريخ المعطى (بما فيه). */
export function nextSchoolDay(date: string, schoolHours: SchoolHours = SCHOOL_HOURS): string {
  let d = date
  for (let i = 0; i < 7 && !isSchoolDay(d, schoolHours); i++) d = addDays(d, 1)
  return d
}

/** "2026-10-19" → "الإثنين 19 أكتوبر" */
export function formatDateAr(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('ar-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/** الإثنين من أسبوع التاريخ المعطى. */
export function mondayOf(date: string): string {
  const weekday = weekdayOf(date) ?? 1
  return addDays(date, -((weekday + 6) % 7))
}

/** أيام الدراسة الخمسة (الإثنين إلى الجمعة) للأسبوع الذي يبدأ بهذا الإثنين. */
export function weekDays(monday: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i))
}

/** الأسبوع المعروض افتراضياً: الأسبوع الحالي، أو الأسبوع القادم إن كان اليوم سبتاً أو أحداً. */
export function defaultWeekMonday(today: string): string {
  const weekday = weekdayOf(today)
  return weekday === 6 || weekday === 0 ? mondayOf(addDays(today, 2)) : mondayOf(today)
}

/** "2026-10-19" → "19 أكتوبر" */
export function formatDayMonthAr(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('ar-MA', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  )
}

/** أول يوم يمكن الحجز فيه: الحجز يكون قبل يوم على الأقل، فأقرب يوم دراسة بعد اليوم. */
export function firstBookableDate(today: string): string {
  return nextSchoolDay(addDays(today, 1))
}

/** الحجز والإلغاء ممكنان فقط لأيام بعد اليوم (لا شيء في يوم النشاط نفسه). */
export function isBeforeDay(date: string, today: string): boolean {
  return date > today
}
