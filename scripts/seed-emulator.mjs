// يملأ Firebase Emulator ببيانات تجريبية (للتجربة المحلية فقط، لا علاقة له بالمشروع الحقيقي).
// يتطلب أن يكون المحاكي شغالاً: npm run emulators -- --only auth,firestore
// الاستعمال: node scripts/seed-emulator.mjs [YYYY-MM-DD]
//
// حسابات تجريبية (موجودة فقط داخل المحاكي):
//   المهدي (مسؤول):      mehdi@test.local   / test-password-123
//   حساب غير مسموح له:   other@test.local   / test-password-123

const PROJECT = 'demo-photo-booking'
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const PASSWORD = 'test-password-123'

async function ensureUser(email) {
  const body = JSON.stringify({ email, password: PASSWORD, returnSecureToken: true })
  const headers = { 'Content-Type': 'application/json' }
  let res = await fetch(`${AUTH}/accounts:signUp?key=demo-api-key`, { method: 'POST', headers, body })
  if (!res.ok) res = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`Auth: ${await res.text()}`)
  return (await res.json()).localId
}

async function writeDoc(path, fields) {
  const res = await fetch(`${FIRESTORE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Firestore ${path}: ${await res.text()}`)
}

function nextSchoolDay() {
  const d = new Date()
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

const date = process.argv[2] ?? nextSchoolDay()
const int = (n) => ({ integerValue: String(n) })
const str = (s) => ({ stringValue: s })

const mehdiUid = await ensureUser('mehdi@test.local')
await ensureUser('other@test.local')

await writeDoc('settings/admins', { uids: { arrayValue: { values: [str(mehdiUid)] } } })
await writeDoc(`availability/${date}`, {
  slots: {
    arrayValue: {
      values: [{ mapValue: { fields: { start: int(510), end: int(630) } } }],
    },
  },
})
await writeDoc(`days/${date}`, {
  bookings: {
    mapValue: {
      fields: {
        seed1: {
          mapValue: {
            fields: {
              teacherName: str('الأستاذة فاطمة'),
              activityName: str('تصوير حفل القراءة'),
              start: int(540),
              end: int(600),
              durationMinutes: int(60),
              ownerUid: str('another-teacher-uid'),
              createdAt: { timestampValue: new Date().toISOString() },
            },
          },
        },
      },
    },
  },
})

console.log(`تم: حسابا mehdi@test.local و other@test.local، وفترة 08:30–10:30 وحجز 09:00–10:00 يوم ${date}.`)
