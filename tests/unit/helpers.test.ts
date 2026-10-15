import { describe, expect, it } from 'vitest'
import {
  addDays,
  casablancaNow,
  defaultWeekMonday,
  firstBookableDate,
  formatDateAr,
  isBeforeDay,
  isSchoolDay,
  mondayOf,
  nextSchoolDay,
  weekDays,
} from '../../src/lib/dates.ts'
import { arabicError } from '../../src/lib/errors.ts'
import {
  availableStarts,
  effectiveAvailability,
  findSlot,
  formatTime,
  hourBlocks,
  isBlockAvailable,
  isRangeFree,
  parseTime,
  toggleBlock,
} from '../../src/lib/schedule.ts'

const MONDAY = '2026-10-19'
const FRIDAY = '2026-10-23'
const SATURDAY = '2026-10-24'
const r = (from: string, to: string) => ({ start: parseTime(from), end: parseTime(to) })

describe('خانات الساعات في جدول المهدي', () => {
  const MON_BLOCKS = ['08:30', '09:30', '10:30', '11:30', '13:30', '14:30', '15:30']

  it('hourBlocks: 7 خانات من الإثنين إلى الخميس، 4 يوم الجمعة، ولا شيء في السبت', () => {
    expect(hourBlocks(MONDAY).map((b) => formatTime(b.start))).toEqual(MON_BLOCKS)
    expect(hourBlocks(MONDAY).every((b) => b.end - b.start === 60)).toBe(true)
    expect(hourBlocks(FRIDAY).map((b) => formatTime(b.start))).toEqual(['08:30', '09:30', '10:30', '11:30'])
    expect(hourBlocks(SATURDAY)).toEqual([])
  })

  it('effectiveAvailability: يوم لم يُعدَّل = كل ساعات الدراسة متاحة', () => {
    expect(effectiveAvailability(MONDAY, null)).toEqual([r('08:30', '12:30'), r('13:30', '16:30')])
    expect(effectiveAvailability(FRIDAY, null)).toEqual([r('08:30', '12:30')])
    expect(effectiveAvailability(MONDAY, [])).toEqual([])
    expect(effectiveAvailability(MONDAY, [r('08:30', '09:30')])).toEqual([r('08:30', '09:30')])
  })

  it('isBlockAvailable: الخانة متاحة فقط إن كانت مغطاة بالكامل', () => {
    expect(isBlockAvailable(r('09:30', '10:30'), [r('08:30', '12:30')])).toBe(true)
    expect(isBlockAvailable(r('09:30', '10:30'), [r('08:30', '09:30'), r('09:30', '10:30')])).toBe(true)
    expect(isBlockAvailable(r('09:30', '10:30'), [r('08:30', '10:00')])).toBe(false)
    expect(isBlockAvailable(r('09:30', '10:30'), [])).toBe(false)
  })

  it('toggleBlock: الضغط على خانة متاحة يجعلها غير متاحة، والضغط مرة أخرى يعيدها', () => {
    const all = effectiveAvailability(MONDAY, null)
    const once = toggleBlock(MONDAY, all, r('09:30', '10:30'))
    expect(once.map((b) => formatTime(b.start))).toEqual(MON_BLOCKS.filter((t) => t !== '09:30'))
    const twice = toggleBlock(MONDAY, once, r('09:30', '10:30'))
    expect(twice.map((b) => formatTime(b.start))).toEqual(MON_BLOCKS)
  })

  it('toggleBlock + findSlot: نشاط ساعتين يحتاج خانتين متتاليتين متاحتين', () => {
    const slots = toggleBlock(MONDAY, effectiveAvailability(MONDAY, null), r('09:30', '10:30'))
    expect(findSlot(MONDAY, 120, slots, [])).toEqual(r('10:30', '12:30'))
  })
})

describe('availableStarts: الأوقات التي يختار منها الأستاذ', () => {
  const FULL = [r('08:30', '12:30'), r('13:30', '16:30')]
  const starts = (list: { start: number }[]) => list.map((x) => formatTime(x.start))

  it('يوم فارغ، ساعة: بدايات كل 30 دقيقة ولا شيء يعبر الغداء', () => {
    expect(starts(availableStarts(MONDAY, 60, FULL, []))).toEqual([
      '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '13:30', '14:00', '14:30', '15:00', '15:30',
    ])
  })

  it('كل خيار يتسع للمدة كاملة', () => {
    expect(availableStarts(MONDAY, 90, FULL, []).every((x) => x.end - x.start === 90)).toBe(true)
    expect(starts(availableStarts(MONDAY, 120, FULL, []))).toEqual(['08:30', '09:00', '09:30', '10:00', '10:30', '13:30', '14:00', '14:30'])
  })

  it('يتجنب الحجوزات وساعات المهدي غير المتاحة', () => {
    const slots = [r('08:30', '09:30'), r('10:30', '12:30')] // 09:30–10:30 غير متاحة
    const bookings = [r('11:00', '11:30')]
    expect(starts(availableStarts(MONDAY, 30, slots, bookings))).toEqual(['08:30', '09:00', '10:30', '11:30', '12:00'])
  })

  it('حجز ينتهي في ربع ساعة: البداية التالية على نصف الساعة الموالي', () => {
    expect(starts(availableStarts(MONDAY, 30, [r('08:30', '10:30')], [r('08:30', '08:45')]))).toEqual([
      '09:00', '09:30', '10:00',
    ])
  })

  it('الجمعة صباحاً فقط، والسبت لا شيء، ويوم بلا فراغ لا شيء', () => {
    expect(starts(availableStarts(FRIDAY, 60, FULL, []))).toEqual(['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'])
    expect(availableStarts(SATURDAY, 30, FULL, [])).toEqual([])
    expect(availableStarts(MONDAY, 30, [], [])).toEqual([])
  })

  it('isRangeFree: يرفض وقتاً حُجز أو يعبر الغداء', () => {
    expect(isRangeFree(MONDAY, r('09:00', '10:00'), FULL, [])).toBe(true)
    expect(isRangeFree(MONDAY, r('09:00', '10:00'), FULL, [r('09:30', '10:00')])).toBe(false)
    expect(isRangeFree(MONDAY, r('12:00', '13:00'), FULL, [])).toBe(false)
    expect(isRangeFree(MONDAY, r('09:00', '10:00'), [r('08:30', '09:30')], [])).toBe(false)
  })
})

describe('dates', () => {
  it('firstBookableDate: الحجز قبل يوم على الأقل', () => {
    expect(firstBookableDate('2026-10-15')).toBe('2026-10-16') // الخميس ← الجمعة
    expect(firstBookableDate(FRIDAY)).toBe('2026-10-26') // الجمعة ← الإثنين
    expect(firstBookableDate(SATURDAY)).toBe('2026-10-26')
  })

  it('isBeforeDay: لا حجز ولا إلغاء في يوم النشاط نفسه', () => {
    expect(isBeforeDay('2026-10-16', '2026-10-15')).toBe(true)
    expect(isBeforeDay('2026-10-15', '2026-10-15')).toBe(false)
    expect(isBeforeDay('2026-10-14', '2026-10-15')).toBe(false)
  })

  it('casablancaNow يعيد التاريخ والدقيقة بتوقيت المغرب', () => {
    // فرق توقيت المغرب عن UTC هو 0 أو +1 ساعة حسب الفترة
    const noon = casablancaNow(new Date('2026-10-19T12:00:00Z'))
    expect(noon.date).toBe('2026-10-19')
    expect([720, 780]).toContain(noon.minutes)
    // التاريخ يُحسب بتوقيت المغرب وليس بتوقيت الجهاز (مثلاً أستراليا +11 ساعة)
    expect(casablancaNow(new Date('2026-10-19T20:00:00Z')).date).toBe('2026-10-19')
  })

  it('addDays يعبر الشهر والسنة', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-19', -1)).toBe('2026-10-18')
  })

  it('isSchoolDay و nextSchoolDay', () => {
    expect(isSchoolDay(MONDAY)).toBe(true)
    expect(isSchoolDay(SATURDAY)).toBe(false)
    expect(nextSchoolDay(SATURDAY)).toBe('2026-10-26')
    expect(nextSchoolDay(FRIDAY)).toBe(FRIDAY)
  })

  it('mondayOf و weekDays و defaultWeekMonday', () => {
    expect(mondayOf(MONDAY)).toBe(MONDAY)
    expect(mondayOf(FRIDAY)).toBe(MONDAY)
    expect(mondayOf('2026-10-25')).toBe(MONDAY) // الأحد ينتمي لأسبوع الإثنين قبله
    expect(mondayOf('2026-11-04')).toBe('2026-11-02')
    expect(weekDays(MONDAY)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'])
    expect(defaultWeekMonday('2026-10-22')).toBe(MONDAY)
    expect(defaultWeekMonday(SATURDAY)).toBe('2026-10-26')
    expect(defaultWeekMonday('2026-10-25')).toBe('2026-10-26')
  })

  it('formatDateAr', () => {
    expect(formatDateAr(MONDAY)).toContain('الاثنين')
  })

  it('formatTime و parseTime', () => {
    expect(formatTime(510)).toBe('08:30')
    expect(parseTime('16:30')).toBe(990)
  })
})

describe('arabicError', () => {
  it('يترجم الأخطاء المعروفة ويعطي رسالة عامة لغيرها', () => {
    expect(arabicError({ code: 'auth/network-request-failed' })).toContain('الإنترنت')
    expect(arabicError({ code: 'permission-denied' })).toContain('صلاحية')
    expect(arabicError(new Error('x'))).toBe('حدث خطأ غير متوقع. أعد المحاولة.')
    expect(arabicError({ code: 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' })).toContain('مفتاح API')
  })
})
