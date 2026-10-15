import { expect, test, type Page } from '@playwright/test'
import { casablancaNow, defaultWeekMonday, firstBookableDate, formatDateAr, mondayOf } from '../src/lib/dates.ts'
import { MEHDI, seedScenario } from './emulator.ts'

const today = casablancaNow().date
// أول يوم يمكن الحجز فيه (الحجز قبل يوم على الأقل)
const target = firstBookableDate(today)

/** ينتقل في جدول الأسبوع (الرئيسية أو صفحة المهدي) إلى الأسبوع الذي فيه يوم الهدف. */
async function showTargetWeek(page: Page) {
  const shown = Date.parse(defaultWeekMonday(today))
  const wanted = Date.parse(mondayOf(target))
  const weeks = Math.round((wanted - shown) / (7 * 24 * 3600 * 1000))
  for (let i = 0; i < weeks; i++) await page.getByRole('button', { name: /التالي/ }).click()
}

test.beforeEach(async () => {
  await seedScenario(target)
})

test('المهدي يضيف فراغاً ← أستاذ يحجز ← الحجز يظهر في الجدول ← الأستاذ يلغي ← يختفي', async ({
  browser,
}, testInfo) => {
  const activity = `تصوير حفل نهاية الأسبوع (${testInfo.project.name})`
  const teacher = 'الأستاذة سعاد'

  // أستاذ ثالث يشاهد جدول الأسبوع طوال الاختبار، دون إعادة تحميل الصفحة
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/')
  await showTargetWeek(viewer)
  const viewerDay = viewer.locator(`[data-date="${target}"]`)
  await expect(viewerDay).toContainText('لا توجد أنشطة')

  // 1) المهدي يدخل ويجعل ساعة 09:30–10:30 متاحة
  const mehdi = await (await browser.newContext()).newPage()
  await mehdi.goto('/#/admin')
  await mehdi.getByLabel('البريد الإلكتروني').fill(MEHDI.email)
  await mehdi.getByLabel('كلمة السر').fill(MEHDI.password)
  await mehdi.getByRole('button', { name: 'دخول' }).click()
  await expect(mehdi.getByRole('heading', { name: 'أوقات فراغي' })).toBeVisible()
  await showTargetWeek(mehdi)
  const cell = mehdi.getByRole('button', { name: `${formatDateAr(target)} 09:30–10:30` })
  await expect(cell).toHaveAttribute('aria-pressed', 'false')
  await cell.click()
  await expect(cell).toHaveAttribute('aria-pressed', 'true')

  // 2) أستاذ يحجز: يرى الوقت الوحيد المتاح ويختاره
  const page = await (await browser.newContext()).newPage()
  await page.goto('/#/book')
  await page.getByLabel('اسمك').fill(teacher)
  await page.getByLabel('اسم النشاط').fill(activity)
  await page.getByLabel('اليوم').fill(target)
  await page.getByLabel('مدة النشاط').selectOption('60')
  const times = page.locator('fieldset button[aria-pressed]')
  await expect(times).toHaveCount(1)
  await expect(times).toHaveText('09:30 – 10:30')
  await times.click()
  await page.getByRole('button', { name: /احجز من/ }).click()
  await expect(page.getByRole('status').filter({ hasText: 'تم الحجز' })).toContainText(
    `نشاطك يوم ${formatDateAr(target)} من الساعة 09:30 إلى 10:30`,
  )
  const myBookings = page.locator('section').filter({ hasText: 'حجوزاتي' })
  await expect(myBookings).toContainText(activity)

  // 3) الحجز يظهر في جدول الأسبوع: مباشرة عند المشاهد، وعند الأستاذ في الصفحة الرئيسية
  await expect(viewerDay).toContainText(activity)
  await expect(viewerDay).toContainText(teacher)
  await expect(viewerDay).toContainText('09:30 – 10:30')
  await page.goto('/')
  await showTargetWeek(page)
  await expect(page.locator(`[data-date="${target}"]`)).toContainText(activity)
  // أوقات فراغ المهدي لا تظهر في الجدول العام
  await expect(page.locator('main')).not.toContainText('متاح')

  // 4) الأستاذ يلغي حجزه
  await page.goto('/#/book')
  await myBookings.getByRole('button', { name: 'إلغاء الحجز' }).click()
  await myBookings.getByRole('button', { name: 'نعم، ألغِ الحجز' }).click()
  await expect(myBookings).toContainText('لا توجد حجوزات من هذا الجهاز.')

  // 5) الحجز يختفي من الجدول مباشرة عند المشاهد
  await expect(viewerDay).not.toContainText(activity)
  await expect(viewerDay).toContainText('لا توجد أنشطة')
})

test('لا يمكن الحجز في نفس اليوم', async ({ page }) => {
  await page.goto('/#/book')
  await page.getByLabel('اليوم').fill(today)
  await expect(page.getByText('لا يمكن الحجز في نفس اليوم. الحجز يكون قبل يوم على الأقل.')).toBeVisible()
  await expect(page.locator('fieldset')).toHaveCount(0)
})
