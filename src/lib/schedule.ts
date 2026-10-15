// منطق حساب وقت النشاط. دوال خالصة: لا تعتمد على الواجهة ولا على Firebase.
// الأوقات بالدقائق منذ منتصف الليل (08:30 = 510)، والتواريخ بصيغة YYYY-MM-DD (توقيت Africa/Casablanca).

export interface TimeRange {
  start: number
  end: number
}

/** أوقات الدراسة حسب رقم اليوم في الأسبوع (0 = الأحد ... 6 = السبت). */
export type SchoolHours = Record<number, TimeRange[]>

export const SLOT_STEP_MINUTES = 15

export const SCHOOL_HOURS: SchoolHours = {
  0: [],
  1: [{ start: 510, end: 750 }, { start: 810, end: 990 }], // الإثنين: 08:30–12:30 و 13:30–16:30
  2: [{ start: 510, end: 750 }, { start: 810, end: 990 }],
  3: [{ start: 510, end: 750 }, { start: 810, end: 990 }],
  4: [{ start: 510, end: 750 }, { start: 810, end: 990 }],
  5: [{ start: 510, end: 750 }], // الجمعة: 08:30–12:30
  6: [],
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** رقم اليوم في الأسبوع لتاريخ تقويمي (0 = الأحد)، أو null إن كان التاريخ غير صحيح. */
export function weekdayOf(date: string): number | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = new Date(Date.UTC(y, mo - 1, d))
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return null
  return utc.getUTCDay()
}

function sortAndMerge(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges.filter((r) => r.start < r.end).sort((a, b) => a.start - b.start)
  const merged: TimeRange[] = []
  for (const r of sorted) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ start: r.start, end: r.end })
  }
  return merged
}

/** الفترات الحرة داخل فترة واحدة من أوقات المدرسة: (فراغ المهدي ∩ الفترة) − الحجوزات. */
function freeRangesWithin(school: TimeRange, availability: TimeRange[], bookings: TimeRange[]): TimeRange[] {
  const available = sortAndMerge(
    availability.map((a) => ({ start: Math.max(a.start, school.start), end: Math.min(a.end, school.end) })),
  )
  const busy = sortAndMerge(bookings)
  const free: TimeRange[] = []
  for (const range of available) {
    let cursor = range.start
    for (const b of busy) {
      if (b.end <= cursor || b.start >= range.end) continue
      if (b.start > cursor) free.push({ start: cursor, end: b.start })
      cursor = Math.max(cursor, b.end)
    }
    if (cursor < range.end) free.push({ start: cursor, end: range.end })
  }
  return free
}

/**
 * يعيد أول وقت متاح يتسع للمدة كاملة في اليوم المطلوب، أو null إن لم يوجد.
 * - الوقت داخل (فراغ المهدي ∩ أوقات المدرسة) ولا يتداخل مع أي حجز.
 * - البداية على خطوات 15 دقيقة.
 * - النشاط لا يعبر الفاصل بين فترتين من أوقات المدرسة (استراحة الغداء).
 * - earliestStart: لا يبدأ النشاط قبل هذه الدقيقة (لحجز اليوم نفسه: الوقت الحالي، حتى لا يُقترح وقت مضى).
 */
export function findSlot(
  date: string,
  durationMinutes: number,
  availabilitySlots: TimeRange[],
  bookings: TimeRange[],
  schoolHours: SchoolHours = SCHOOL_HOURS,
  earliestStart = 0,
): TimeRange | null {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return null
  const weekday = weekdayOf(date)
  if (weekday === null) return null

  const schoolRanges = [...(schoolHours[weekday] ?? [])].sort((a, b) => a.start - b.start)
  for (const school of schoolRanges) {
    for (const free of freeRangesWithin(school, availabilitySlots, bookings)) {
      const start = Math.ceil(Math.max(free.start, earliestStart) / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES
      if (start + durationMinutes <= free.end) return { start, end: start + durationMinutes }
    }
  }
  return null
}

/** 510 → "08:30" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "08:30" → 510 */
export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end
}

export const HOUR_BLOCK_MINUTES = 60

/** ساعات الدراسة لهذا اليوم مقسمة إلى خانات من ساعة (08:30–09:30، 09:30–10:30، ...). */
export function hourBlocks(date: string, schoolHours: SchoolHours = SCHOOL_HOURS): TimeRange[] {
  const ranges = schoolHours[weekdayOf(date) ?? 0] ?? []
  const blocks: TimeRange[] = []
  for (const r of ranges) {
    for (let t = r.start; t + HOUR_BLOCK_MINUTES <= r.end; t += HOUR_BLOCK_MINUTES) {
      blocks.push({ start: t, end: t + HOUR_BLOCK_MINUTES })
    }
  }
  return blocks
}

/**
 * أوقات فراغ المهدي الفعلية ليوم معين.
 * إن لم يعدّل المهدي هذا اليوم بعد (لا توجد وثيقة availability)، فكل ساعات الدراسة متاحة.
 */
export function effectiveAvailability(
  date: string,
  storedSlots: TimeRange[] | null,
  schoolHours: SchoolHours = SCHOOL_HOURS,
): TimeRange[] {
  if (storedSlots !== null) return storedSlots
  return (schoolHours[weekdayOf(date) ?? 0] ?? []).map(({ start, end }) => ({ start, end }))
}

/** هل الخانة متاحة بالكامل ضمن أوقات الفراغ؟ */
export function isBlockAvailable(block: TimeRange, slots: TimeRange[]): boolean {
  return sortAndMerge(slots).some((r) => r.start <= block.start && block.end <= r.end)
}

/** يقلب حالة خانة (متاح ⇄ غير متاح) ويعيد قائمة الخانات المتاحة الجديدة لهذا اليوم. */
export function toggleBlock(
  date: string,
  slots: TimeRange[],
  block: TimeRange,
  schoolHours: SchoolHours = SCHOOL_HOURS,
): TimeRange[] {
  return hourBlocks(date, schoolHours).filter((b) => {
    const available = isBlockAvailable(b, slots)
    return b.start === block.start && b.end === block.end ? !available : available
  })
}

export const START_STEP_MINUTES = 30

/** الفترات الحرة في اليوم: (فراغ المهدي ∩ أوقات المدرسة) − الحجوزات، كل فترة داخل فترة دراسة واحدة. */
function freeRanges(date: string, availability: TimeRange[], bookings: TimeRange[], schoolHours: SchoolHours): TimeRange[] {
  const weekday = weekdayOf(date)
  if (weekday === null) return []
  return (schoolHours[weekday] ?? []).flatMap((school) => freeRangesWithin(school, availability, bookings))
}

/**
 * كل الأوقات المتاحة التي يختار منها الأستاذ: بدايات كل 30 دقيقة (08:30، 09:00، ...)
 * يتسع بعدها النشاط كاملاً دون تداخل مع حجز ودون عبور استراحة الغداء.
 */
export function availableStarts(
  date: string,
  durationMinutes: number,
  availability: TimeRange[],
  bookings: TimeRange[],
  schoolHours: SchoolHours = SCHOOL_HOURS,
): TimeRange[] {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) return []
  const out: TimeRange[] = []
  for (const free of freeRanges(date, availability, bookings, schoolHours)) {
    let t = Math.ceil(free.start / START_STEP_MINUTES) * START_STEP_MINUTES
    for (; t + durationMinutes <= free.end; t += START_STEP_MINUTES) out.push({ start: t, end: t + durationMinutes })
  }
  return out
}

/** هل هذا الوقت ما زال حراً بالكامل؟ (للتحقق داخل transaction الحجز) */
export function isRangeFree(
  date: string,
  range: TimeRange,
  availability: TimeRange[],
  bookings: TimeRange[],
  schoolHours: SchoolHours = SCHOOL_HOURS,
): boolean {
  return freeRanges(date, availability, bookings, schoolHours).some((f) => f.start <= range.start && range.end <= f.end)
}
