import { Link } from 'react-router-dom'

const BASE = import.meta.env.BASE_URL

export default function Header() {
  return (
    <header className="border-b-4 border-orange-500 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="الصفحة الرئيسية">
          <img src={`${BASE}emblem.png`} alt="" width={41} height={48} className="h-12 w-auto shrink-0" />
          <div className="min-w-0 leading-tight">
            <p dir="ltr" className="text-right text-lg font-bold tracking-wide text-navy-700">
              LARUS <span className="text-orange-500">SCHOOL</span>
            </p>
            <p className="truncate text-sm text-slate-600">حجز أنشطة التصوير</p>
          </div>
        </Link>
      </div>
    </header>
  )
}
