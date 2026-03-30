import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortable<T extends string>(defaultKey: T, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<T>(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function handleSort(key: T) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  function sorted<R>(items: R[], getValue: (key: T, item: R) => string | number | null): R[] {
    return [...items].sort((a, b) => {
      const va = getValue(sortKey, a) ?? ''
      const vb = getValue(sortKey, b) ?? ''
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  return { sortKey, sortDir, handleSort, sorted }
}
