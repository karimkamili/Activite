import { useEffect, useState } from 'react'

// تنبيه دائم أعلى الصفحة عند انقطاع الإنترنت
export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (online) return null
  return (
    <div role="alert" className="sticky top-0 z-10 bg-orange-600 px-4 py-2 text-center text-sm font-semibold text-white">
      لا يوجد اتصال بالإنترنت. الحجز والتعديل غير ممكنين حتى يعود الاتصال.
    </div>
  )
}
