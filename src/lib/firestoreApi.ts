import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore'
import type { Booking, BookingWithId } from '../types/index.ts'
import { addDays, casablancaNow, isBeforeDay, isSchoolDay, weekDays } from './dates.ts'
import { db } from './firebase.ts'
import { availableStarts, effectiveAvailability, isRangeFree, type TimeRange } from './schedule.ts'

type Unsubscribe = () => void

/** خطأ برمز خاص يُترجم في arabicError. */
export class BookingError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const WRITE_TIMEOUT_MS = 15_000

/** بدون إنترنت، عمليات الكتابة في Firestore تنتظر بلا نهاية؛ نرفضها فوراً برسالة واضحة. */
function requireOnline() {
  if (!navigator.onLine) throw new BookingError('app/offline')
}

/** كتابة مع مهلة: إن لم يؤكدها الخادم خلال 15 ثانية نعرض رسالة بدل انتظار بلا نهاية. */
async function confirmedWrite(write: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BookingError('app/write-timeout')), WRITE_TIMEOUT_MS)
  })
  try {
    await Promise.race([write, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** أوقات الفراغ المحفوظة لليوم، أو null إن لم يعدّل المهدي هذا اليوم بعد (= كل الساعات متاحة). */
function storedSlots(data: { slots?: TimeRange[] } | undefined): TimeRange[] | null {
  if (!data) return null
  return [...(data.slots ?? [])].sort((a, b) => a.start - b.start)
}

/** يتابع أوقات فراغ المهدي ليوم معين. null = اليوم لم يُعدَّل بعد. */
export function subscribeAvailability(
  date: string,
  onData: (slots: TimeRange[] | null) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'availability', date), (snap) => onData(storedSlots(snap.data())), onError)
}

/** ينسخ أوقات فراغ أسبوع إلى أسبوع آخر (الأيام الخمسة دفعة واحدة). */
export async function copyWeekAvailability(fromMonday: string, toMonday: string): Promise<void> {
  requireOnline()
  const fromDays = weekDays(fromMonday)
  const snaps = await Promise.all(fromDays.map((d) => getDoc(doc(db, 'availability', d))))
  const batch = writeBatch(db)
  weekDays(toMonday).forEach((date, i) => {
    const slots = effectiveAvailability(fromDays[i], storedSlots(snaps[i].data()))
    batch.set(doc(db, 'availability', date), { slots: slots.map(({ start, end }) => ({ start, end })) })
  })
  await confirmedWrite(batch.commit())
}

export async function saveAvailability(date: string, slots: TimeRange[]): Promise<void> {
  requireOnline()
  const clean = [...slots].sort((a, b) => a.start - b.start).map(({ start, end }) => ({ start, end }))
  await confirmedWrite(setDoc(doc(db, 'availability', date), { slots: clean }))
}

/** يتابع حجوزات يوم معين (مرتبة حسب البداية). */
export function subscribeDay(
  date: string,
  onData: (bookings: BookingWithId[]) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'days', date),
    (snap) => {
      const map = (snap.data()?.bookings ?? {}) as Record<string, Booking>
      const list = Object.entries(map).map(([id, b]) => ({ ...b, id }))
      onData(list.sort((a, b) => a.start - b.start))
    },
    onError,
  )
}

export async function deleteBooking(date: string, bookingId: string): Promise<void> {
  requireOnline()
  await confirmedWrite(updateDoc(doc(db, 'days', date), { [`bookings.${bookingId}`]: deleteField() }))
}

/** هل هذا الحساب موجود في settings/admins؟ */
export async function checkIsAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'settings', 'admins'))
  const uids = snap.data()?.uids
  return Array.isArray(uids) && uids.includes(uid)
}

/** يتابع حجوزات مستخدم معين من اليوم فصاعداً (مرتبة حسب التاريخ ثم الوقت). */
export function subscribeMyBookings(
  uid: string,
  fromDate: string,
  onData: (bookings: (BookingWithId & { date: string })[]) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  const q = query(collection(db, 'days'), where(documentId(), '>=', fromDate))
  return onSnapshot(
    q,
    (snap) => {
      const mine: (BookingWithId & { date: string })[] = []
      for (const d of snap.docs) {
        const map = (d.data().bookings ?? {}) as Record<string, Booking>
        for (const [id, b] of Object.entries(map)) {
          if (b.ownerUid === uid) mine.push({ ...b, id, date: d.id })
        }
      }
      onData(mine.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start))
    },
    onError,
  )
}

export interface BookingRequest {
  teacherName: string
  activityName: string
  date: string
  /** وقت البداية الذي اختاره الأستاذ (بالدقائق) */
  start: number
  durationMinutes: number
  ownerUid: string
}

/** الحجز والإلغاء ممكنان فقط قبل يوم النشاط. */
function requireBeforeDay(date: string) {
  if (!isBeforeDay(date, casablancaNow().date)) throw new BookingError('booking/too-late')
}

/** يتابع ما يلزم لعرض الأوقات المتاحة ليوم: أوقات فراغ المهدي الفعلية + الحجوزات. */
export function subscribeDayAvailability(
  date: string,
  onData: (day: { slots: TimeRange[]; bookings: TimeRange[] }) => void,
  onError: (err: FirestoreError) => void,
): Unsubscribe {
  let slots: TimeRange[] | undefined
  let bookings: TimeRange[] | undefined
  const emit = () => {
    if (slots !== undefined && bookings !== undefined) onData({ slots, bookings })
  }
  const unsubA = subscribeAvailability(
    date,
    (stored) => {
      slots = effectiveAvailability(date, stored)
      emit()
    },
    onError,
  )
  const unsubD = subscribeDay(
    date,
    (list) => {
      bookings = list
      emit()
    },
    onError,
  )
  return () => {
    unsubA()
    unsubD()
  }
}

/**
 * يحجز الوقت الذي اختاره الأستاذ داخل transaction واحدة:
 * قراءة availability/{date} و days/{date} ← التأكد أن الوقت ما زال حراً ← كتابة الحجز.
 * إن حجز أستاذ آخر نفس الوقت في نفس اللحظة، تعيد Firestore تنفيذ الدالة بالبيانات الجديدة
 * فيُرفض الحجز الثاني برسالة واضحة، ولا يحدث تداخل.
 */
export async function bookSlot(req: BookingRequest): Promise<TimeRange> {
  requireOnline()
  requireBeforeDay(req.date)
  const availabilityRef = doc(db, 'availability', req.date)
  const dayRef = doc(db, 'days', req.date)
  const bookingId = doc(collection(db, 'days')).id
  const slot = { start: req.start, end: req.start + req.durationMinutes }

  return runTransaction(db, async (tx) => {
    const [availabilitySnap, daySnap] = [await tx.get(availabilityRef), await tx.get(dayRef)]
    const slots = effectiveAvailability(req.date, storedSlots(availabilitySnap.data()))
    const bookings = Object.values((daySnap.data()?.bookings ?? {}) as Record<string, Booking>)
    if (!isRangeFree(req.date, slot, slots, bookings)) throw new BookingError('booking/slot-taken')

    const booking = {
      teacherName: req.teacherName,
      activityName: req.activityName,
      start: slot.start,
      end: slot.end,
      durationMinutes: req.durationMinutes,
      ownerUid: req.ownerUid,
      createdAt: serverTimestamp(),
    }
    if (daySnap.exists()) tx.update(dayRef, { [`bookings.${bookingId}`]: booking })
    else tx.set(dayRef, { bookings: { [bookingId]: booking } })
    return slot
  })
}

/** إلغاء الأستاذ لحجزه: ممكن فقط قبل يوم النشاط. */
export async function cancelMyBooking(date: string, bookingId: string): Promise<void> {
  requireBeforeDay(date)
  await deleteBooking(date, bookingId)
}

/** أقرب يوم دراسة بعد التاريخ المعطى (خلال 14 يوماً) فيه وقت كافٍ للمدة، مع أول وقت متاح فيه، أو null. */
export async function findNextAvailableDay(
  afterDate: string,
  durationMinutes: number,
): Promise<{ date: string; slot: TimeRange } | null> {
  requireOnline()
  const dates: string[] = []
  for (let i = 1; i <= 14; i++) {
    const d = addDays(afterDate, i)
    if (isSchoolDay(d)) dates.push(d)
  }
  const days = await Promise.all(
    dates.map(async (date) => {
      const [a, d] = await Promise.all([getDoc(doc(db, 'availability', date)), getDoc(doc(db, 'days', date))])
      const slots = effectiveAvailability(date, storedSlots(a.data()))
      const bookings = Object.values((d.data()?.bookings ?? {}) as Record<string, Booking>)
      return { date, slots, bookings }
    }),
  )
  for (const day of days) {
    const [first] = availableStarts(day.date, durationMinutes, day.slots, day.bookings)
    if (first) return { date: day.date, slot: first }
  }
  return null
}
