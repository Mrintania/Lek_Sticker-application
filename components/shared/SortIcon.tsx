export type SortDir = 'asc' | 'desc'

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="inline-flex flex-col ml-1 opacity-60">
      <svg
        className={`w-2.5 h-2.5 -mb-0.5 ${active && dir === 'asc' ? 'opacity-100 text-blue-600' : 'opacity-30'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 0L10 6H0z" />
      </svg>
      <svg
        className={`w-2.5 h-2.5 ${active && dir === 'desc' ? 'opacity-100 text-blue-600' : 'opacity-30'}`}
        viewBox="0 0 10 6" fill="currentColor"
      >
        <path d="M5 6L0 0h10z" />
      </svg>
    </span>
  )
}
