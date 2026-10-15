export default function Loading({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-4 text-slate-600">
      <span
        aria-hidden="true"
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-navy-100 border-t-orange-500"
      />
      <span>{label}</span>
    </div>
  )
}
