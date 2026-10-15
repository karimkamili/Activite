import { describe, expect, it } from 'vitest'
import { findSlot, weekdayOf, type TimeRange } from '../../src/lib/schedule.ts'

const MONDAY = '2026-10-19'
const THURSDAY = '2026-10-22'
const FRIDAY = '2026-10-23'
const SATURDAY = '2026-10-24'
const SUNDAY = '2026-10-25'

/** "08:30" → 510 */
const t = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const range = (from: string, to: string): TimeRange => ({ start: t(from), end: t(to) })

const FULL_SCHOOL_DAY = [range('08:30', '16:30')]

describe('weekdayOf', () => {
  it('يحسب اليوم في الأسبوع بشكل صحيح', () => {
    expect(weekdayOf(MONDAY)).toBe(1)
    expect(weekdayOf(FRIDAY)).toBe(5)
    expect(weekdayOf(SATURDAY)).toBe(6)
    expect(weekdayOf(SUNDAY)).toBe(0)
  })

  it('يرفض تاريخاً غير صحيح', () => {
    expect(weekdayOf('2026-02-30')).toBeNull()
    expect(weekdayOf('19-10-2026')).toBeNull()
  })
})

describe('findSlot', () => {
  it('يوم فارغ: أول وقت هو 08:30', () => {
    expect(findSlot(MONDAY, 60, FULL_SCHOOL_DAY, [])).toEqual(range('08:30', '09:30'))
  })

  it('يوم ممتلئ: لا يوجد وقت', () => {
    const bookings = [range('08:30', '12:30'), range('13:30', '16:30')]
    expect(findSlot(MONDAY, 15, FULL_SCHOOL_DAY, bookings)).toBeNull()
  })

  it('مدة أطول من أي فراغ: لا يوجد وقت', () => {
    // فراغات متبقية: 30 و 45 دقيقة فقط
    const availability = [range('08:30', '10:00'), range('14:00', '15:00')]
    const bookings = [range('09:00', '10:00'), range('14:00', '14:15')]
    expect(findSlot(MONDAY, 60, availability, bookings)).toBeNull()
    expect(findSlot(MONDAY, 45, availability, bookings)).toEqual(range('14:15', '15:00'))
  })

  it('فراغ بين حجزين على المقاس بالضبط', () => {
    const bookings = [range('08:30', '10:00'), range('11:00', '12:30')]
    expect(findSlot(MONDAY, 60, FULL_SCHOOL_DAY, bookings)).toEqual(range('10:00', '11:00'))
  })

  it('مدة أطول بربع ساعة من الفراغ بين حجزين: تنتقل إلى الفترة المسائية', () => {
    const bookings = [range('08:30', '10:00'), range('11:00', '12:30')]
    expect(findSlot(MONDAY, 75, FULL_SCHOOL_DAY, bookings)).toEqual(range('13:30', '14:45'))
  })

  it('الجمعة بعد 12:30: لا يوجد وقت', () => {
    const availability = [range('08:30', '16:30')]
    const morningFull = [range('08:30', '12:30')]
    expect(findSlot(FRIDAY, 30, availability, morningFull)).toBeNull()
    expect(findSlot(FRIDAY, 30, [range('13:30', '16:30')], [])).toBeNull()
  })

  it('الجمعة صباحاً: يوجد وقت قبل 12:30', () => {
    expect(findSlot(FRIDAY, 60, FULL_SCHOOL_DAY, [range('08:30', '11:30')])).toEqual(range('11:30', '12:30'))
  })

  it('السبت والأحد: لا حجز حتى مع وجود فراغ للمهدي', () => {
    expect(findSlot(SATURDAY, 30, FULL_SCHOOL_DAY, [])).toBeNull()
    expect(findSlot(SUNDAY, 30, FULL_SCHOOL_DAY, [])).toBeNull()
  })

  it('فراغ للمهدي خارج أوقات المدرسة: يُستعمل الجزء الداخل فقط', () => {
    const availability = [range('07:00', '09:00')]
    expect(findSlot(MONDAY, 30, availability, [])).toEqual(range('08:30', '09:00'))
    expect(findSlot(MONDAY, 60, availability, [])).toBeNull()
  })

  it('فراغ للمهدي كله خارج أوقات المدرسة: لا يوجد وقت', () => {
    const availability = [range('06:00', '08:30'), range('12:30', '13:30'), range('16:30', '19:00')]
    expect(findSlot(MONDAY, 15, availability, [])).toBeNull()
  })

  it('نشاط يعبر استراحة الغداء: مرفوض', () => {
    // فراغ 11:30–14:30 = 3 ساعات، لكن الغداء يقسمه إلى ساعة + ساعة
    const availability = [range('11:30', '14:30')]
    expect(findSlot(MONDAY, 120, availability, [])).toBeNull()
    expect(findSlot(MONDAY, 60, availability, [])).toEqual(range('11:30', '12:30'))
  })

  it('لا يُقترح وقت يبدأ قبل الغداء وينتهي بعده: ينتقل إلى 13:30', () => {
    const availability = [range('11:30', '14:30')]
    const bookings = [range('11:30', '12:00')]
    expect(findSlot(MONDAY, 60, availability, bookings)).toEqual(range('13:30', '14:30'))
  })

  it('يوم بدون أي فراغ للمهدي: لا يوجد وقت', () => {
    expect(findSlot(MONDAY, 15, [], [])).toBeNull()
  })

  it('البداية على خطوات 15 دقيقة', () => {
    expect(findSlot(MONDAY, 30, [range('08:40', '10:00')], [])).toEqual(range('08:45', '09:15'))
    // حجز ينتهي في 09:10 ← أول بداية ممكنة 09:15
    expect(findSlot(MONDAY, 30, FULL_SCHOOL_DAY, [range('08:30', '09:10')])).toEqual(range('09:15', '09:45'))
  })

  it('فترتا فراغ متلاصقتان تُعاملان كفترة واحدة', () => {
    const availability = [range('08:30', '09:30'), range('09:30', '10:30')]
    expect(findSlot(MONDAY, 120, availability, [])).toEqual(range('08:30', '10:30'))
  })

  it('حجوزات غير مرتبة ومتداخلة', () => {
    const bookings = [range('10:00', '11:00'), range('08:30', '09:30'), range('09:00', '10:00')]
    expect(findSlot(THURSDAY, 60, FULL_SCHOOL_DAY, bookings)).toEqual(range('11:00', '12:00'))
  })

  it('مدة غير صالحة أو تاريخ غير صالح: null', () => {
    expect(findSlot(MONDAY, 0, FULL_SCHOOL_DAY, [])).toBeNull()
    expect(findSlot(MONDAY, -30, FULL_SCHOOL_DAY, [])).toBeNull()
    expect(findSlot('2026-13-01', 30, FULL_SCHOOL_DAY, [])).toBeNull()
  })

  it('مدة 120 دقيقة في المساء (الإثنين إلى الخميس)', () => {
    const bookings = [range('08:30', '12:30')]
    expect(findSlot(THURSDAY, 120, FULL_SCHOOL_DAY, bookings)).toEqual(range('13:30', '15:30'))
  })

  it('حجز اليوم نفسه: لا يُقترح وقت مضى', () => {
    // الساعة الآن 10:07 ← أول بداية ممكنة 10:15
    expect(findSlot(MONDAY, 60, FULL_SCHOOL_DAY, [], undefined, t('10:07'))).toEqual(range('10:15', '11:15'))
    // الساعة الآن 12:00 ← لا تتسع ساعة قبل الغداء، فينتقل إلى 13:30
    expect(findSlot(MONDAY, 60, FULL_SCHOOL_DAY, [], undefined, t('12:00'))).toEqual(range('13:30', '14:30'))
    // بعد نهاية الدراسة ← لا يوجد وقت
    expect(findSlot(MONDAY, 15, FULL_SCHOOL_DAY, [], undefined, t('16:20'))).toBeNull()
  })
})
