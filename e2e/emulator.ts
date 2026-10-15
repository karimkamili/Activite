// أدوات للاختبار الشامل: تهيئة Firebase Emulator ببيانات معروفة قبل كل اختبار.
// كل هذا داخل المحاكي فقط (مشروع demo-photo-booking)، ولا علاقة له بالمشروع الحقيقي.

const PROJECT = 'demo-photo-booking'
const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'
const DOCS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`
const OWNER = { Authorization: 'Bearer owner' }

/** حساب تجريبي للمهدي (موجود فقط داخل المحاكي). */
export const MEHDI = { email: 'mehdi@test.local', password: 'test-password-123' }

async function check(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`)
  return res
}

/** يمسح كل الحسابات وكل البيانات من المحاكي. */
export async function resetEmulators() {
  await check(await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' }), 'reset auth')
  await check(
    await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' }),
    'reset firestore',
  )
}

export async function createUser(email: string, password: string): Promise<string> {
  const res = await check(
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }),
    'create user',
  )
  return ((await res.json()) as { localId: string }).localId
}

export async function writeDoc(path: string, fields: Record<string, unknown>) {
  await check(
    await fetch(`${DOCS}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...OWNER },
      body: JSON.stringify({ fields }),
    }),
    `write ${path}`,
  )
}

/** حساب المهدي + إدراجه في settings/admins + يوم الهدف بلا أي ساعة فراغ (كل الساعات «غير متاح»). */
export async function seedScenario(targetDate: string) {
  await resetEmulators()
  const mehdiUid = await createUser(MEHDI.email, MEHDI.password)
  await writeDoc('settings/admins', { uids: { arrayValue: { values: [{ stringValue: mehdiUid }] } } })
  await writeDoc(`availability/${targetDate}`, { slots: { arrayValue: {} } })
}
