'use client'
import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatThaiMonthYear, formatCurrency } from '@/lib/formatters'

interface PayrollRec {
  employee_id: string
  year: number
  month: number
  period: number
  working_days: number
  days_present: number
  days_absent: number
  days_sick_with_cert: number
  days_sick_no_cert: number
  days_half_day: number
  total_late_minutes: number
  base_pay: number
  diligence_bonus: number
  deductions: number
  total_pay: number
}

interface MonthGroup {
  year: number
  month: number
  records: PayrollRec[]
}

export default function MyPayrollPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const [history, setHistory] = useState<PayrollRec[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PayrollRec | null>(null)

  useEffect(() => {
    if (!user || userLoading) return
    fetch('/api/payroll')
      .then(r => r.ok ? r.json() : [])
      .then((data: PayrollRec[]) =>
        setHistory([...data].sort((a, b) =>
          b.year !== a.year ? b.year - a.year :
          b.month !== a.month ? b.month - a.month :
          a.period - b.period
        ))
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, userLoading])

  // Group records by year+month
  const grouped: MonthGroup[] = []
  const seen = new Map<string, MonthGroup>()
  for (const rec of history) {
    const key = `${rec.year}-${rec.month}`
    if (!seen.has(key)) {
      const g: MonthGroup = { year: rec.year, month: rec.month, records: [] }
      seen.set(key, g)
      grouped.push(g)
    }
    seen.get(key)!.records.push(rec)
  }

  if (userLoading || loading) {
    return (
      <div className="page-container">
        <div className="space-y-3">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="card animate-pulse flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <h2 className="text-xl font-bold text-gray-900">ประวัติเงินเดือน</h2>

      {grouped.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลเงินเดือน</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          {grouped.map((g, gi) => (
            <div key={`${g.year}-${g.month}`} className={gi > 0 ? 'border-t border-gray-100' : ''}>
              {/* Month header */}
              <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {formatThaiMonthYear(g.year, g.month)}
                </span>
                {g.records.length > 1 && (
                  <span className="text-xs text-gray-400">
                    รวม {formatCurrency(g.records.reduce((s, r) => s + r.total_pay, 0))}
                  </span>
                )}
              </div>
              {/* Period rows */}
              <div className="divide-y divide-gray-50">
                {g.records.map(p => (
                  <button
                    key={`${p.year}-${p.month}-${p.period}`}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setSelected(p)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        รอบ {p.period}
                        <span className="ml-1.5 text-xs font-normal text-gray-400">
                          {p.period === 1 ? '(1–15)' : '(16–สิ้นเดือน)'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        มา {p.days_present}/{p.working_days} วัน
                        {p.days_absent > 0 && <span className="text-red-500 ml-2">ขาด {p.days_absent} วัน</span>}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(p.total_pay)}</p>
                      {p.diligence_bonus > 0 && (
                        <p className="text-xs text-gray-400">+{formatCurrency(p.diligence_bonus)} เบี้ยขยัน</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl">
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-xs text-gray-400">เงินเดือน — รอบ {selected.period} {selected.period === 1 ? '(1–15)' : '(16–สิ้นเดือน)'}</p>
                  <h3 className="text-lg font-bold text-gray-900">{formatThaiMonthYear(selected.year, selected.month)}</h3>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-4xl font-bold text-green-600 mt-4 mb-2">{formatCurrency(selected.total_pay)}</p>
            </div>

            <div className="px-6 pb-2 border-t border-gray-100 pt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">มาทำงาน</span>
                <span className="font-medium text-gray-700">{selected.days_present}/{selected.working_days} วัน</span>
              </div>
              {selected.days_absent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ขาด/ลา</span>
                  <span className="font-medium text-red-500">{selected.days_absent} วัน</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">เงินเดือนพื้นฐาน</span>
                <span className="font-medium text-gray-700">{formatCurrency(selected.base_pay)}</span>
              </div>
              {selected.diligence_bonus > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">เบี้ยขยัน</span>
                  <span className="font-medium text-green-600">+{formatCurrency(selected.diligence_bonus)}</span>
                </div>
              )}
              {selected.deductions > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">หักออก</span>
                  <span className="font-medium text-red-600">-{formatCurrency(selected.deductions)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">รวมสุทธิ</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(selected.total_pay)}</span>
              </div>
            </div>

            <div className="px-6 py-5">
              <button onClick={() => setSelected(null)} className="btn-secondary w-full">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
