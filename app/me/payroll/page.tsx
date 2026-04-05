'use client'
import { useState, useEffect } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatThaiMonthYear, formatCurrency } from '@/lib/formatters'
import { PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '@/lib/types'

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
  extra_bonus: number
  extra_bonus_note: string | null
  extra_deduction: number
  extra_deduction_note: string | null
  total_pay: number
  payment_status: 'pending' | 'paid'
  payment_method: PaymentMethod | null
  paid_at: string | null
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && selected) setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  useEffect(() => {
    if (!user || userLoading) return
    fetch('/api/payroll')
      .then(r => r.ok ? r.json() : [])
      .then((data: PayrollRec[]) => {
        const sorted = [...data].sort((a, b) =>
          b.year !== a.year ? b.year - a.year :
          b.month !== a.month ? b.month - a.month :
          a.period - b.period
        )
        setHistory(sorted)
        // Auto-expand latest month
        if (sorted.length > 0) {
          setExpandedKey(`${sorted[0].year}-${sorted[0].month}`)
        }
      })
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

  // Filter out future months
  const nowDate = new Date()
  const nowYear = nowDate.getFullYear()
  const nowMonth = nowDate.getMonth() + 1
  const visibleGroups = grouped.filter(g =>
    g.year < nowYear || (g.year === nowYear && g.month <= nowMonth)
  )

  if (userLoading || loading) {
    return (
      <div className="page-container">
        <div className="space-y-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="flex justify-between items-center">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-28" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-xl">💰</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">ประวัติเงินเดือน</h2>
          <p className="text-xs text-gray-400">กดที่รอบเพื่อดูรายละเอียด</p>
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-5xl mb-3">📭</p>
          <p className="text-gray-500 font-medium">ยังไม่มีข้อมูลเงินเดือน</p>
          <p className="text-gray-400 text-sm mt-1">ข้อมูลจะแสดงหลังจากที่ผู้ดูแลระบบคำนวณเงินเดือน</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((g) => {
            const key = `${g.year}-${g.month}`
            const isOpen = expandedKey === key
            const monthTotal = g.records.reduce((s, r) => s + r.total_pay, 0)
            const hasBothPeriods = g.records.length === 2

            return (
              <div key={key} className="card !p-0 overflow-hidden">
                {/* Month header — click to expand/collapse */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedKey(isOpen ? null : key)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-800">
                        {formatThaiMonthYear(g.year, g.month)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {hasBothPeriods ? '2 รอบ' : `${g.records.length} รอบ`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-green-600">
                      {formatCurrency(monthTotal)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Period cards — shown when expanded */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-2">
                    {g.records.map(p => {
                      const attendRate = p.working_days > 0
                        ? Math.round((p.days_present / p.working_days) * 100)
                        : 100
                      return (
                        <button
                          key={`${p.year}-${p.month}-${p.period}`}
                          className="w-full bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-left"
                          onClick={() => setSelected(p)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            {/* Left: period badge + attendance */}
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-xl ${
                                p.period === 1
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-purple-50 text-purple-600'
                              }`}>
                                รอบ {p.period}
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-medium">
                                  {p.period === 1 ? 'วันที่ 1 – 15' : 'วันที่ 16 – สิ้นเดือน'}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-600">
                                    มา {p.days_present}/{p.working_days} วัน
                                  </span>
                                  {p.days_absent > 0 && (
                                    <span className="text-xs text-red-500 font-medium bg-red-50 px-1.5 py-0.5 rounded-lg">
                                      ขาด {p.days_absent} วัน
                                    </span>
                                  )}
                                </div>
                                {/* Attendance bar */}
                                <div className="mt-1.5 w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      attendRate >= 100 ? 'bg-green-400' :
                                      attendRate >= 80 ? 'bg-yellow-400' : 'bg-red-400'
                                    }`}
                                    style={{ width: `${attendRate}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            {/* Right: pay */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-green-600">{formatCurrency(p.total_pay)}</p>
                              {p.diligence_bonus > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  +{formatCurrency(p.diligence_bonus)} เบี้ย
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Payment status badge */}
                          <div className="mt-2 flex justify-end">
                            {p.payment_status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                                {p.payment_method ? PAYMENT_METHOD_ICONS[p.payment_method] : '✅'} จ่ายแล้ว
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                                ⏳ รอรับเงิน
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}

                    {/* Monthly total row */}
                    {g.records.length > 1 && (
                      <div className="flex items-center justify-between px-2 pt-1">
                        <span className="text-xs text-gray-400">รวมเดือนนี้</span>
                        <span className="text-sm font-bold text-gray-700">{formatCurrency(monthTotal)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl mb-2 ${
                    selected.period === 1 ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    รอบ {selected.period} · {selected.period === 1 ? '1–15' : '16–สิ้นเดือน'}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{formatThaiMonthYear(selected.year, selected.month)}</h3>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Big total */}
              <div className="mt-3 p-4 bg-green-50 rounded-2xl text-center">
                <p className="text-xs text-green-600 mb-1">รับเงินสุทธิ</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(selected.total_pay)}</p>
              </div>
            </div>

            {/* Details */}
            <div className="px-6 py-4 space-y-3">
              <DetailRow label="มาทำงาน" value={`${selected.days_present}/${selected.working_days} วัน`} />
              {selected.days_absent > 0 && (
                <DetailRow label="ขาด/ลา" value={`${selected.days_absent} วัน`} valueClass="text-red-500" />
              )}
              {selected.days_sick_with_cert > 0 && (
                <DetailRow label="ลาป่วย (มีใบรับรอง)" value={`${selected.days_sick_with_cert} วัน`} />
              )}
              {selected.days_sick_no_cert > 0 && (
                <DetailRow label="ลาป่วย (ไม่มีใบรับรอง)" value={`${selected.days_sick_no_cert} วัน`} valueClass="text-orange-500" />
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2.5">
                <DetailRow label="เงินเดือนพื้นฐาน" value={formatCurrency(selected.base_pay)} />
                {selected.diligence_bonus > 0 && (
                  <DetailRow label="เบี้ยขยัน" value={`+${formatCurrency(selected.diligence_bonus)}`} valueClass="text-green-600" />
                )}
                {(selected.extra_bonus ?? 0) > 0 && (
                  <DetailRow
                    label={`เงินเพิ่มพิเศษ${selected.extra_bonus_note ? ` (${selected.extra_bonus_note})` : ''}`}
                    value={`+${formatCurrency(selected.extra_bonus)}`}
                    valueClass="text-green-600"
                  />
                )}
                {(selected.extra_deduction ?? 0) > 0 && (
                  <DetailRow
                    label={`หัก${selected.extra_deduction_note ? ` (${selected.extra_deduction_note})` : ''}`}
                    value={`-${formatCurrency(selected.extra_deduction)}`}
                    valueClass="text-red-600"
                  />
                )}
                {selected.deductions > 0 && (
                  <DetailRow label="หักออก" value={`-${formatCurrency(selected.deductions)}`} valueClass="text-red-600" />
                )}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-sm font-bold text-gray-700">รวมสุทธิ</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(selected.total_pay)}</span>
              </div>
              {/* Payment status section */}
              <div className="border-t border-gray-100 pt-3 mt-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">สถานะการรับเงิน</p>
                {selected.payment_status === 'paid' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
                      {selected.payment_method ? PAYMENT_METHOD_ICONS[selected.payment_method] : '✅'} จ่ายแล้ว
                      {selected.payment_method && ` · ${PAYMENT_METHOD_LABELS[selected.payment_method]}`}
                    </span>
                    {selected.paid_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(selected.paid_at).toLocaleDateString('th-TH', {
                          day: 'numeric', month: 'short', year: '2-digit',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-sm font-semibold">
                    ⏳ รอรับเงิน
                  </span>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <button onClick={() => setSelected(null)} className="btn-secondary w-full">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  valueClass = 'text-gray-700',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}
