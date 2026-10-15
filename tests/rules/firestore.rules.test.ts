import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const DATE = '2026-10-19'
const ADMIN = 'mehdi-uid'
const TEACHER_A = 'teacher-a'
const TEACHER_B = 'teacher-b'

let testEnv: RulesTestEnvironment

function booking(ownerUid: string, overrides: Record<string, unknown> = {}) {
  return {
    teacherName: 'أستاذ',
    activityName: 'نشاط',
    start: 510,
    end: 570,
    durationMinutes: 60,
    ownerUid,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

function dbAs(uid: string | null) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore()
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-photo-booking',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'settings/admins'), { uids: [ADMIN] })
    await setDoc(doc(db, `availability/${DATE}`), { slots: [{ start: 510, end: 750 }] })
    await setDoc(doc(db, `days/${DATE}`), {
      bookings: { b1: { ...booking(TEACHER_B), start: 600, end: 630, durationMinutes: 30, createdAt: new Date() } },
    })
  })
})

describe('days: الأستاذ', () => {
  it('يضيف حجزه في يوم موجود (مقبول)', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), { 'bookings.b2': booking(TEACHER_A) }))
  })

  it('ينشئ أول حجز في يوم جديد (مقبول)', async () => {
    await assertSucceeds(setDoc(doc(dbAs(TEACHER_A), 'days/2026-10-20'), { bookings: { b1: booking(TEACHER_A) } }))
  })

  it('يحذف حجزه (مقبول)', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(TEACHER_B), `days/${DATE}`), { 'bookings.b1': deleteField() }))
  })

  it('يحذف حجز غيره (مرفوض)', async () => {
    await assertFails(updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), { 'bookings.b1': deleteField() }))
  })

  it('يعدل حجز غيره (مرفوض)', async () => {
    await assertFails(updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), { 'bookings.b1.start': 510 }))
  })

  it('يعدل حجزه الموجود (مرفوض)', async () => {
    await assertFails(updateDoc(doc(dbAs(TEACHER_B), `days/${DATE}`), { 'bookings.b1.activityName': 'آخر' }))
  })

  it('يضيف حجزين دفعة واحدة في يوم موجود (مرفوض)', async () => {
    await assertFails(
      updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), {
        'bookings.b2': booking(TEACHER_A),
        'bookings.b3': booking(TEACHER_A, { start: 660, end: 690, durationMinutes: 30 }),
      }),
    )
  })

  it('ينشئ يوماً جديداً بحجزين دفعة واحدة (مرفوض)', async () => {
    await assertFails(
      setDoc(doc(dbAs(TEACHER_A), 'days/2026-10-20'), {
        bookings: { b1: booking(TEACHER_A), b2: booking(TEACHER_A, { start: 600, end: 660 }) },
      }),
    )
  })

  it('يضيف حجزاً ويحذف حجز غيره في نفس العملية (مرفوض)', async () => {
    await assertFails(
      updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), {
        'bookings.b2': booking(TEACHER_A),
        'bookings.b1': deleteField(),
      }),
    )
  })

  it('يضيف حجزاً باسم uid آخر (مرفوض)', async () => {
    await assertFails(updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), { 'bookings.b2': booking(TEACHER_B) }))
  })

  it('يحذف وثيقة اليوم كاملة (مرفوض)', async () => {
    await assertFails(deleteDoc(doc(dbAs(TEACHER_B), `days/${DATE}`)))
  })
})

describe('days: التحقق من بيانات الحجز', () => {
  const add = (overrides: Record<string, unknown>) =>
    updateDoc(doc(dbAs(TEACHER_A), `days/${DATE}`), { 'bookings.b2': booking(TEACHER_A, overrides) })

  it('start يساوي end (مرفوض)', async () => {
    await assertFails(add({ start: 570, end: 570, durationMinutes: 0 }))
  })

  it('start أكبر من end (مرفوض)', async () => {
    await assertFails(add({ start: 600, end: 570, durationMinutes: -30 }))
  })

  it('وقت غير صحيح (عدد عشري) (مرفوض)', async () => {
    await assertFails(add({ start: 510.5, end: 570, durationMinutes: 59.5 }))
  })

  it('وقت نصي (مرفوض)', async () => {
    await assertFails(add({ start: '510' }))
  })

  it('durationMinutes لا يطابق end - start (مرفوض)', async () => {
    await assertFails(add({ durationMinutes: 30 }))
  })

  it('اسم أستاذ فارغ أو مسافات فقط (مرفوض)', async () => {
    await assertFails(add({ teacherName: '   ' }))
  })

  it('اسم نشاط بطول 80 حرفاً (مرفوض)', async () => {
    await assertFails(add({ activityName: 'ا'.repeat(80) }))
  })

  it('اسم نشاط بطول 79 حرفاً (مقبول)', async () => {
    await assertSucceeds(add({ activityName: 'ا'.repeat(79) }))
  })

  it('حقل إضافي غير معروف (مرفوض)', async () => {
    await assertFails(add({ extra: true }))
  })

  it('createdAt ليس وقت الخادم (مرفوض)', async () => {
    await assertFails(add({ createdAt: new Date('2020-01-01') }))
  })
})

describe('days: المهدي', () => {
  it('يحذف حجز أي أستاذ (مقبول)', async () => {
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), `days/${DATE}`), { 'bookings.b1': deleteField() }))
  })

  it('لا يعدل حجز أستاذ (مرفوض)', async () => {
    await assertFails(updateDoc(doc(dbAs(ADMIN), `days/${DATE}`), { 'bookings.b1.start': 510 }))
  })
})

describe('availability', () => {
  it('أستاذ يعدل availability (مرفوض)', async () => {
    await assertFails(setDoc(doc(dbAs(TEACHER_A), `availability/${DATE}`), { slots: [{ start: 510, end: 750 }] }))
  })

  it('المهدي يعدل availability (مقبول)', async () => {
    await assertSucceeds(setDoc(doc(dbAs(ADMIN), `availability/${DATE}`), { slots: [{ start: 510, end: 600 }] }))
  })

  it('المهدي يكتب في وثيقة اسمها ليس تاريخاً (مرفوض)', async () => {
    await assertFails(setDoc(doc(dbAs(ADMIN), 'availability/hello'), { slots: [] }))
  })

  it('أستاذ مسجل يقرأ availability (مقبول)', async () => {
    await assertSucceeds(getDoc(doc(dbAs(TEACHER_A), `availability/${DATE}`)))
  })
})

describe('القراءة و settings', () => {
  it('أستاذ مسجل يقرأ days (مقبول)', async () => {
    await assertSucceeds(getDoc(doc(dbAs(TEACHER_A), `days/${DATE}`)))
  })

  it('زائر غير مسجل يقرأ days (مرفوض)', async () => {
    await assertFails(getDoc(doc(dbAs(null), `days/${DATE}`)))
  })

  it('أستاذ يقرأ settings/admins (مقبول)', async () => {
    await assertSucceeds(getDoc(doc(dbAs(TEACHER_A), 'settings/admins')))
  })

  it('أستاذ يضيف نفسه إلى settings/admins (مرفوض)', async () => {
    await assertFails(setDoc(doc(dbAs(TEACHER_A), 'settings/admins'), { uids: [ADMIN, TEACHER_A] }))
  })

  it('المهدي يكتب في settings (مرفوض)', async () => {
    await assertFails(setDoc(doc(dbAs(ADMIN), 'settings/admins'), { uids: [ADMIN] }))
  })
})
