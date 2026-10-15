import { defineConfig, devices } from '@playwright/test'

// الاختبار الشامل يعمل على Firebase Emulator فقط (npm run test:e2e يشغّل المحاكي تلقائياً).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'ar-MA',
    timezoneId: 'Africa/Casablanca',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev:emulator',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
