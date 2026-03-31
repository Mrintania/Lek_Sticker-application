'use client'
import { useState, useEffect, useRef } from 'react'
import { formatThaiMonthYear, formatCurrency, formatTime, formatHours, formatMinutes, formatThaiDateShort } from '@/lib/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { exportMonthlyReport } from '@/lib/exporter'
import { MonthlySummary, AttendanceRecord, AttendanceStatus } from '@/lib/types'
import { SortIcon } from '@/components/shared/SortIcon'
import StatusBadge from '@/components/shared/StatusBadge'

interface PayrollRecord {
  id: number
  employee_id: string
  name: string
  employment_type: string
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
  is_finalized: number
}

interface DailyRateModal {
  employeeId: string
  name: string
}

interface PayrollSettings {
  diligenceBonusEnabled: boolean
  sickWithCertExempt: boolean
  monthlyMaxAbsent: number
  diligenceBaseAmount: number
  diligenceStepAmount: number
  diligenceMaxDays: number
}

type SortKey = 'name' | 'employmentType' | 'workingDays' | 'daysPresent' | 'daysAbsent' | 'daysSickCert' | 'daysSickNoCert' | 'daysHalfDay' | 'production' | 'basePay' | 'diligenceBonus' | 'totalPay'

export default function PayrollPage() {
  const { user } = useCurrentUser()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [period, setPeriod] = useState<1 | 2>(new Date().getDate() <= 15 ? 1 : 2)
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [paySettings, setPaySettings] = useState<PayrollSettings>({
    diligenceBonusEnabled: true,
    sickWithCertExempt: true,
    monthlyMaxAbsent: 3.5,
    diligenceBaseAmount: 1000,
    diligenceStepAmount: 150,
    diligenceMaxDays: 3,
  })
  const [productionByEmployee, setProductionByEmployee] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [noDataWarning, setNoDataWarning] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // ตรวจว่าเดือน/ปีที่เลือกเป็นเดือนปัจจุบัน
  const today = new Date()
  const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [dailyRateModal, setDailyRateModal] = useState<DailyRateModal | null>(null)
  const [newDailyRate, setNewDailyRate] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)

  // Employee detail modal
  const [detailRecord, setDetailRecord] = useState<PayrollRecord | null>(null)
  const [detailAttendance, setDetailAttendance] = useState<AttendanceRecord[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function openDetail(r: PayrollRecord) {
    setDetailRecord(r)
    setDetailAttendance([])
    setLoadingDetail(true)
    try {
      const startDate = `${r.year}-${String(r.month).padStart(2, '0')}-01`
      const endDate = `${r.year}-${String(r.month).padStart(2, '0')}-31`
      const res = await fetch(`/api/attendance?start=${startDate}&end=${endDate}&employeeId=${r.employee_id}`)
      if (res.ok) {
        const data = await res.json()
        setDetailAttendance(data.map((rec: AttendanceRecord & { checkIn: string | null; checkOut: string | null }) => ({
          ...rec,
          checkIn: rec.checkIn ? new Date(rec.checkIn) : null,
          checkOut: rec.checkOut ? new Date(rec.checkOut) : null,
        })))
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const canManage = user?.role === 'admin' || user?.role === 'manager'

  // Keep stable reference to loadPayroll for event listener
  const loadPayrollRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    fetch('/api/payroll/settings').then(r => r.json()).then(setPaySettings).catch(() => {})
    loadPayroll()

    // Auto-reload when user returns to this tab (e.g., after editing leaves in another tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPayrollRef.current()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [year, month, period])

  async function loadPayroll() {
    const [payrollRes, prodRes] = await Promise.all([
      fetch(`/api/payroll?year=${year}&month=${month}&period=${period}`),
      fetch(`/api/production/summary?year=${year}&month=${month}`),
    ])
    if (payrollRes.ok) {
      setRecords(await payrollRes.json())
      setRefreshedAt(new Date())
    }
    if (prodRes.ok) {
      const prodData = await prodRes.json()
      const map: Record<string, number> = {}
      for (const e of prodData.byEmployee ?? []) map[e.employee_id] = e.total_quantity
      setProductionByEmployee(map)
    }
  }

  // Keep ref in sync so visibilitychange handler always calls current version
  loadPayrollRef.current = loadPayroll

  async function handleCalculate() {
    setLoading(true)
    setNoDataWarning('')
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, period }),
      })
      const data = await res.json()
      if (data.warning === 'no_data') {
        setNoDataWarning(data.message)
        return
      }
      if (res.ok) await loadPayroll()
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveSettings() {
    await fetch('/api/payroll/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paySettings),
    })
    setSaveMsg('บันทึกแล้ว')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function handleSaveDailyRate() {
    if (!dailyRateModal) return
    const rate = Number(newDailyRate)
    if (!rate || rate <= 0) return
    setSavingRate(true)
    try {
      await fetch(`/api/employees/${dailyRateModal.employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyRate: rate }),
      })
      setDailyRateModal(null)
      setNewDailyRate('')
      // Recalculate payroll with new rate
      await handleCalculate()
    } finally {
      setSavingRate(false)
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedRecords = [...records].sort((a, b) => {
    let aVal: string | number = 0
    let bVal: string | number = 0
    switch (sortKey) {
      case 'name': aVal = a.name; bVal = b.name; break
      case 'employmentType': aVal = a.employment_type; bVal = b.employment_type; break
      case 'workingDays': aVal = a.working_days; bVal = b.working_days; break
      case 'daysPresent': aVal = a.days_present; bVal = b.days_present; break
      case 'daysAbsent': aVal = a.days_absent; bVal = b.days_absent; break
      case 'daysSickCert': aVal = a.days_sick_with_cert; bVal = b.days_sick_with_cert; break
      case 'daysSickNoCert': aVal = a.days_sick_no_cert; bVal = b.days_sick_no_cert; break
      case 'daysHalfDay': aVal = a.days_half_day; bVal = b.days_half_day; break
      case 'production': aVal = productionByEmployee[a.employee_id] ?? 0; bVal = productionByEmployee[b.employee_id] ?? 0; break
      case 'basePay': aVal = a.base_pay; bVal = b.base_pay; break
      case 'diligenceBonus': aVal = a.diligence_bonus; bVal = b.diligence_bonus; break
      case 'totalPay': aVal = a.total_pay; bVal = b.total_pay; break
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const totals = records.reduce((s, r) => ({
    basePay: s.basePay + r.base_pay,
    bonus: s.bonus + r.diligence_bonus,
    totalPay: s.totalPay + r.total_pay,
  }), { basePay: 0, bonus: 0, totalPay: 0 })

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years = [2024, 2025, 2026, 2027]

  // Map for export (convert to MonthlySummary shape)
  const summaryForExport: MonthlySummary[] = records.map((r) => ({
    employeeId: r.employee_id,
    name: r.name,
    department: '',
    employmentType: r.employment_type as 'daily' | 'monthly',
    workingDaysInMonth: r.working_days,
    daysPresent: r.days_present,
    daysLate: 0,
    daysAbsent: r.days_absent,
    daysNoCheckout: 0,
    daysHalfDay: 0,
    totalWorkHours: 0,
    avgWorkHours: 0,
    attendanceRate: r.working_days > 0 ? (r.days_present / r.working_days) * 100 : 0,
    punctualityRate: 100,
    totalLateMinutes: r.total_late_minutes,
    estimatedPay: r.total_pay,
  }))

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">เงินเดือน</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">{formatThaiMonthYear(year, month)}</p>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {period === 1 ? 'รอบ 1 (1–15)' : `รอบ 2 (16–สิ้นเดือน)`}
            </span>
            {isCurrentMonth && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                ⏳ ยังไม่ครบรอบ (ถึง {today.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
              </span>
            )}
            {refreshedAt && (
              <span className="text-xs text-gray-400">
                อัปเดต {refreshedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="!w-auto">
            {months.map((m) => <option key={m} value={m}>{formatThaiMonthYear(year, m).split(' ')[0]}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-auto">
            {years.map((y) => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          {/* Period selector */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              onClick={() => setPeriod(1)}
              className={`px-3 py-1.5 font-medium transition-colors ${period === 1 ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              รอบ 1
            </button>
            <button
              onClick={() => setPeriod(2)}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-gray-200 ${period === 2 ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              รอบ 2
            </button>
          </div>
          {canManage && (
            <>
              <button className="btn-secondary whitespace-nowrap" onClick={() => setShowSettings(!showSettings)}>⚙️ เบี้ยขยัน</button>
              <button className="btn-primary whitespace-nowrap" onClick={handleCalculate} disabled={loading}>
                {loading ? '⏳ คำนวณ...' : '🔄 คำนวณเงินเดือน'}
              </button>
            </>
          )}
          {records.length > 0 && (
            <button className="btn-secondary whitespace-nowrap" onClick={() => exportMonthlyReport(summaryForExport, year, month)}>⬇️ Export</button>
          )}
        </div>
      </div>

      {/* Payroll Settings Modal */}
      {showSettings && canManage && (
        <div className="modal-backdrop">
          <div className="modal-panel sm:max-w-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">⚙️ ตั้งค่าเบี้ยขยัน</h3>
                <p className="text-sm text-gray-400 mt-0.5">กำหนดเกณฑ์การจ่ายเบี้ยขยันพนักงาน</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={paySettings.diligenceBonusEnabled}
                    onChange={(e) => setPaySettings({ ...paySettings, diligenceBonusEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">เปิดใช้งานเบี้ยขยัน</p>
                    <p className="text-xs text-gray-400">แสดงคอลัมน์เบี้ยขยันในตารางเงินเดือน</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={paySettings.sickWithCertExempt}
                    onChange={(e) => setPaySettings({ ...paySettings, sickWithCertExempt: e.target.checked })}
                    className="w-4 h-4 text-blue-600 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">ลาป่วยมีใบแพทย์ = ยังได้เบี้ยขยัน</p>
                    <p className="text-xs text-gray-400">ไม่นับวันลาป่วยมีใบแพทย์เป็นวันขาดงาน</p>
                  </div>
                </label>
              </div>

              {/* Step-based bonus config */}
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">เกณฑ์เบี้ยขยัน <span className="font-normal text-gray-400">(รายเดือนเท่านั้น)</span></p>

                {/* 3 config fields */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { label: 'บาทเมื่อไม่หยุด', key: 'diligenceBaseAmount' as const, step: 50 },
                    { label: 'ลดต่อ 0.5 วัน', key: 'diligenceStepAmount' as const, step: 50 },
                    { label: 'หยุดได้สูงสุด (วัน)', key: 'diligenceMaxDays' as const, step: 0.5 },
                  ]).map(({ label, key, step }) => (
                    <div key={key} className="min-w-0 p-2 rounded-xl border border-gray-100 bg-gray-50 text-center">
                      <p className="text-xs text-gray-500 mb-1.5 leading-tight truncate">{label}</p>
                      <input
                        type="text" inputMode="decimal"
                        className="w-full min-w-0 block text-center font-semibold text-sm"
                        value={paySettings[key]}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (!isNaN(v)) setPaySettings({ ...paySettings, [key]: v })
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Preview table — computed from inputs */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-blue-50 text-blue-700">
                        <th className="px-3 py-2 text-left font-medium">หยุด (วัน)</th>
                        <th className="px-3 py-2 text-right font-medium">เบี้ยขยัน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const rows = []
                        const base = paySettings.diligenceBaseAmount
                        const step = paySettings.diligenceStepAmount
                        const max = paySettings.diligenceMaxDays
                        for (let d = 0; d <= max; d += 0.5) {
                          const steps = Math.floor(d / 0.5)
                          const bonus = Math.max(0, base - steps * step)
                          rows.push(
                            <tr key={d} className={d === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                              <td className="px-3 py-2 text-gray-600">{d === 0 ? 'ไม่หยุด' : d % 1 === 0 ? `${d} วัน` : `${d} วัน`}</td>
                              <td className="px-3 py-2 text-right font-semibold text-green-700">฿{bonus.toLocaleString()}</td>
                            </tr>
                          )
                        }
                        rows.push(
                          <tr key="over" className="bg-red-50">
                            <td className="px-3 py-2 text-red-400 italic">หยุดเกิน {max} วัน</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-400">฿0</td>
                          </tr>
                        )
                        return rows
                      })()}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">* พนักงานรายวันไม่ได้รับเบี้ยขยัน</p>
              </div>

              {/* Monthly max absent */}
              <div className="p-3 rounded-xl border border-orange-100 bg-orange-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">หยุด/ลา เกินนี้ → คิดรายวัน</p>
                    <p className="text-xs text-gray-400 mt-0.5">สำหรับพนักงานรายเดือน — หากหยุดเกินจะเปลี่ยนเป็นคิดรายวันทันที</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="text" inputMode="decimal"
                      className="w-14 text-center"
                      value={paySettings.monthlyMaxAbsent}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (!isNaN(v)) setPaySettings({ ...paySettings, monthlyMaxAbsent: v })
                      }}
                    />
                    <span className="text-sm text-gray-500">วัน</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-between shrink-0">
              {saveMsg
                ? <span className="text-green-600 text-sm font-medium">✅ {saveMsg}</span>
                : <span />
              }
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setShowSettings(false)}>ยกเลิก</button>
                <button className="btn-primary" onClick={async () => { await handleSaveSettings(); setTimeout(() => setShowSettings(false), 1200) }}>
                  💾 บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No-data warning banner */}
      {noDataWarning && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm">ไม่สามารถคำนวณเงินเดือนได้</p>
            <p className="text-yellow-700 text-sm mt-0.5">{noDataWarning}</p>
          </div>
          <button
            className="ml-auto shrink-0 text-yellow-500 hover:text-yellow-700 transition-colors"
            onClick={() => setNoDataWarning('')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card text-center !py-3 sm:!py-4">
            <p className="text-lg sm:text-2xl font-bold text-blue-700">{formatCurrency(totals.basePay)}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">เงินเดือน</p>
          </div>
          <div className="card text-center !py-3 sm:!py-4">
            <p className="text-lg sm:text-2xl font-bold text-green-700">{formatCurrency(totals.bonus)}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">เบี้ยขยัน</p>
          </div>
          <div className="card text-center !py-3 sm:!py-4">
            <p className="text-lg sm:text-2xl font-bold text-purple-700">{formatCurrency(totals.totalPay)}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">รวมทั้งหมด</p>
          </div>
          <div className="card text-center !py-3 sm:!py-4">
            <p className="text-lg sm:text-2xl font-bold text-teal-700">
              {Object.values(productionByEmployee).reduce((s, v) => s + v, 0).toLocaleString()}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">ผลงานรวม (ชิ้น)</p>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="card !p-0 overflow-hidden">
        {records.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4 text-sm">ยังไม่มีข้อมูลเงินเดือนสำหรับเดือนนี้</p>
            {canManage && <button className="btn-primary" onClick={handleCalculate}>คำนวณเงินเดือน</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'name', label: 'ชื่อ', cls: '' },
                  { key: 'employmentType', label: 'ประเภท', cls: 'text-center' },
                  { key: 'workingDays', label: 'วันทำงาน', cls: 'text-center' },
                  { key: 'daysPresent', label: 'มา', cls: 'text-center' },
                  { key: 'daysAbsent', label: 'ขาด', cls: 'text-center' },
                  { key: 'daysSickCert', label: 'ลาป่วย(ใบ)', cls: 'text-center' },
                  { key: 'daysSickNoCert', label: 'ลาทั้งวัน', cls: 'text-center' },
                  { key: 'daysHalfDay', label: 'ครึ่งวัน', cls: 'text-center' },
                  { key: 'production', label: 'ผลงาน (ชิ้น)', cls: 'text-right' },
                  { key: 'basePay', label: 'เงินเดือน', cls: 'text-right' },
                  { key: 'diligenceBonus', label: 'เบี้ยขยัน', cls: 'text-right' },
                  { key: 'totalPay', label: 'รวม', cls: 'text-right' },
                ] as { key: SortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header cursor-pointer select-none hover:bg-gray-100 ${col.cls}`} onClick={() => handleSort(col.key)}>
                    <span className="inline-flex items-center gap-0.5 font-semibold">
                      {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                    </span>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {sortedRecords.map((r) => {
                  const switchedToDaily = r.employment_type === 'monthly' && r.days_absent > paySettings.monthlyMaxAbsent
                  return (
                    <tr key={r.employee_id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <button
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors"
                          onClick={() => openDetail(r)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="table-cell text-center">
                        {r.employment_type === 'daily'
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">รายวัน</span>
                          : <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">รายเดือน</span>}
                      </td>
                      <td className="table-cell text-center text-gray-500">{r.working_days}</td>
                      <td className="table-cell text-center">{r.days_present}</td>
                      <td className="table-cell text-center">
                        <span className={r.days_absent > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{r.days_absent}</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={r.days_sick_with_cert > 0 ? 'text-blue-600' : 'text-gray-400'}>{r.days_sick_with_cert || '—'}</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={r.days_sick_no_cert > 0 ? 'text-orange-500 font-medium' : 'text-gray-400'}>{r.days_sick_no_cert || '—'}</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={r.days_half_day > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>{r.days_half_day || '—'}</span>
                      </td>
                      <td className="table-cell text-right">
                        {productionByEmployee[r.employee_id]
                          ? <span className="text-teal-700 font-medium">{productionByEmployee[r.employee_id].toLocaleString()}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatCurrency(r.base_pay)}</span>
                          {switchedToDaily && canManage && (
                            <button
                              className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded hover:bg-yellow-200 transition-colors cursor-pointer"
                              title={`คิดรายวัน: ${formatCurrency(r.base_pay / (r.days_present || 1))}/วัน — คลิกเพื่อตั้งค่าอัตราเอง`}
                              onClick={() => { setDailyRateModal({ employeeId: r.employee_id, name: r.name }); setNewDailyRate('') }}
                            >
                              ⚠️ คิดรายวัน
                            </button>
                          )}
                          {switchedToDaily && !canManage && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded" title={`คิดรายวัน: ${formatCurrency(r.base_pay / (r.days_present || 1))}/วัน`}>⚠️ คิดรายวัน</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-right">
                        {r.diligence_bonus > 0
                          ? <span className="text-green-600 font-medium">+{formatCurrency(r.diligence_bonus)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell text-right font-bold text-purple-700">{formatCurrency(r.total_pay)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="table-cell" colSpan={9}>รวมทั้งหมด</td>
                  <td className="table-cell text-right text-blue-700">{formatCurrency(totals.basePay)}</td>
                  <td className="table-cell text-right text-green-700">{formatCurrency(totals.bonus)}</td>
                  <td className="table-cell text-right text-purple-700">{formatCurrency(totals.totalPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Employee Detail Modal */}
      {detailRecord && (
        <div className="modal-backdrop">
          <div className="modal-panel sm:max-w-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900">{detailRecord.name}</h3>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${detailRecord.employment_type === 'daily' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {detailRecord.employment_type === 'daily' ? 'รายวัน' : 'รายเดือน'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{formatThaiMonthYear(detailRecord.year, detailRecord.month)}</p>
              </div>
              <button onClick={() => setDetailRecord(null)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto">
              {/* Summary grid */}
              <div className="p-6 grid grid-cols-2 gap-4">
                {/* Left: Attendance stats */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📅 สถิติการมางาน</p>
                  {[
                    { label: 'วันทำงานในเดือน', value: detailRecord.working_days, color: 'text-gray-700' },
                    { label: 'มาทำงาน', value: detailRecord.days_present, color: 'text-green-600 font-semibold' },
                    { label: 'ขาดงาน', value: detailRecord.days_absent, color: detailRecord.days_absent > 0 ? 'text-red-600 font-semibold' : 'text-gray-400' },
                    { label: 'ลาป่วย (มีใบแพทย์)', value: detailRecord.days_sick_with_cert, color: detailRecord.days_sick_with_cert > 0 ? 'text-blue-600' : 'text-gray-400' },
                    { label: 'ลาทั้งวัน', value: detailRecord.days_sick_no_cert, color: detailRecord.days_sick_no_cert > 0 ? 'text-orange-500' : 'text-gray-400' },
                    { label: 'ครึ่งวัน', value: detailRecord.days_half_day, color: detailRecord.days_half_day > 0 ? 'text-yellow-600' : 'text-gray-400' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{row.label}</span>
                      <span className={row.color}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                    <span className="text-gray-500">⏰ รวมเวลาสาย</span>
                    <span className={detailRecord.total_late_minutes > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>
                      {detailRecord.total_late_minutes > 0 ? formatMinutes(detailRecord.total_late_minutes) : '—'}
                    </span>
                  </div>
                </div>

                {/* Right: Pay breakdown */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">💰 การคำนวณเงิน</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">เงินเดือนพื้นฐาน</span>
                    <span className="text-gray-700 font-medium">{formatCurrency(detailRecord.base_pay)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">เบี้ยขยัน</span>
                    <span className={detailRecord.diligence_bonus > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {detailRecord.diligence_bonus > 0 ? `+${formatCurrency(detailRecord.diligence_bonus)}` : '—'}
                    </span>
                  </div>
                  {detailRecord.deductions > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">หัก</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(detailRecord.deductions)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-700">รวมสุทธิ</span>
                    <span className="text-xl font-bold text-purple-700">{formatCurrency(detailRecord.total_pay)}</span>
                  </div>
                  {/* Attendance rate */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">อัตราการมา</span>
                      <span className={`font-medium ${
                        detailRecord.working_days > 0 && (detailRecord.days_present / detailRecord.working_days) >= 0.9
                          ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {detailRecord.working_days > 0
                          ? `${((detailRecord.days_present / detailRecord.working_days) * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Production section */}
              {detailRecord && productionByEmployee[detailRecord.employee_id] != null && (
                <div className="px-6 pb-4">
                  <div className="bg-teal-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">📦 ผลงานเดือนนี้</p>
                      <p className="text-2xl font-bold text-teal-700 mt-1">
                        {(productionByEmployee[detailRecord.employee_id] ?? 0).toLocaleString()} ชิ้น
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily attendance table */}
              <div className="px-6 pb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📋 ประวัติการมางานรายวัน</p>
                {loadingDetail ? (
                  <div className="text-center py-6 text-gray-400 text-sm">⏳ กำลังโหลด...</div>
                ) : detailAttendance.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-sm">ไม่มีข้อมูลการสแกนในเดือนนี้</div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="table-header">วันที่</th>
                          <th className="table-header text-center">เข้า</th>
                          <th className="table-header text-center">ออก</th>
                          <th className="table-header text-center">ชั่วโมง</th>
                          <th className="table-header text-center">สาย</th>
                          <th className="table-header text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...detailAttendance].sort((a, b) => a.date.localeCompare(b.date)).map((rec) => (
                          <tr key={rec.date} className="hover:bg-gray-50 border-t border-gray-100">
                            <td className="table-cell font-medium">{formatThaiDateShort(rec.date)}</td>
                            <td className="table-cell text-center font-mono">
                              {rec.checkIn
                                ? <span className={rec.isLate ? 'text-yellow-600 font-semibold' : 'text-green-600'}>{formatTime(rec.checkIn)}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="table-cell text-center font-mono">
                              {rec.checkOut
                                ? <span className={rec.isEarlyLeave ? 'text-orange-600' : ''}>{formatTime(rec.checkOut)}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="table-cell text-center">{rec.workHours != null ? formatHours(rec.workHours) : '—'}</td>
                            <td className="table-cell text-center">
                              {rec.lateMinutes > 0
                                ? <span className="text-yellow-600 font-medium">{formatMinutes(rec.lateMinutes)}</span>
                                : <span className="text-green-500 text-xs">ตรงเวลา</span>}
                            </td>
                            <td className="table-cell text-center">
                              <StatusBadge status={rec.status as AttendanceStatus} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Rate Modal */}
      {dailyRateModal && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">ตั้งค่าค่าจ้างรายวัน</h3>
              <p className="text-sm text-gray-500 mt-1">{dailyRateModal.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                พนักงานคนนี้ขาดเกินกำหนด ระบบจะคิดเงินแบบรายวันแทน
                กรุณาระบุอัตราค่าจ้างต่อวัน
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ค่าจ้างต่อวัน (บาท)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full"
                  placeholder="เช่น 350"
                  value={newDailyRate}
                  onChange={(e) => setNewDailyRate(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDailyRate() }}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDailyRateModal(null)}>ยกเลิก</button>
              <button
                className="btn-primary"
                onClick={handleSaveDailyRate}
                disabled={savingRate || !newDailyRate || Number(newDailyRate) <= 0}
              >
                {savingRate ? 'กำลังบันทึก...' : 'บันทึกและคำนวณใหม่'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
