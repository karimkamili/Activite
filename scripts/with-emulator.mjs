// يشغل Firebase Emulator، ينفذ أمراً (مثل الاختبارات)، ثم يوقف المحاكي بالكامل.
// بديل لـ `firebase emulators:exec` الذي يترك عملية Java عالقة على Windows فيُشغَل المنفذ 8080.
// الاستعمال: node scripts/with-emulator.mjs <services> "<command>"
//   مثال:   node scripts/with-emulator.mjs firestore "vitest run tests/rules"
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'

const [services, command] = process.argv.slice(2)
if (!services || !command) {
  console.error('Usage: node scripts/with-emulator.mjs <services> "<command>"')
  process.exit(2)
}

const PORTS = { firestore: 8080, auth: 9099 }
const ports = services.split(',').map((s) => PORTS[s]).filter(Boolean)
const isWindows = process.platform === 'win32'

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
}

async function waitForPorts(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await Promise.all(ports.map(portOpen))).every(Boolean)) return true
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function killTree(child) {
  if (child.exitCode !== null) return
  if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else process.kill(-child.pid, 'SIGTERM')
}

for (const port of ports) {
  if (await portOpen(port)) {
    console.error(`المنفذ ${port} مشغول. أوقف أي محاكي Firebase يعمل حالياً ثم أعد المحاولة.`)
    process.exit(1)
  }
}

const emulator = spawn(`firebase emulators:start --only ${services} --project demo-photo-booking`, {
  shell: true,
  detached: !isWindows,
  stdio: ['ignore', 'inherit', 'inherit'],
})

let exitCode = 1
try {
  if (!(await waitForPorts(120_000))) throw new Error('لم يبدأ المحاكي خلال دقيقتين.')
  const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }
  const result = spawnSync(command, { shell: true, stdio: 'inherit', env })
  exitCode = result.status ?? 1
} catch (err) {
  console.error(err.message)
} finally {
  killTree(emulator)
}
process.exit(exitCode)
