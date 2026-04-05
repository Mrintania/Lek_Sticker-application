'use client'
import { useState, useEffect, useRef } from 'react'
import { formatThaiMonthYear, formatCurrency, formatTime, formatHours, formatMinutes, formatThaiDateShort } from '@/lib/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { exportMonthlyReport } from '@/lib/exporter'
import { MonthlySummary, AttendanceRecord, AttendanceStatus } from '@/lib/types'
import { SortIcon } from '@/components/shared/SortIcon'
import StatusBadge from '@/components/shared/StatusBadge'
import { THAI_BANKS, getBankById } from '@/lib/banks'
import { PaymentMethod, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS } from '@/lib/types'

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
  extra_bonus: number
  extra_bonus_note: string | null
  extra_deduction: number
  extra_deduction_note: string | null
  total_pay: number
  is_finalized: number
  // Payment tracking
  payment_status: 'pending' | 'paid'
  payment_method: PaymentMethod | null
  payment_note: string | null
  paid_at: string | null
  paid_by: string | null
  // Employee bank info (joined from employees)
  phone: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  prompt_pay_id: string | null
}

interface AdjustmentModal {
  id: number
  name: string
  type: 'bonus' | 'deduction'
  currentAmount: number
  currentNote: string
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

  // Adjustment modal
  const [adjustmentModal, setAdjustmentModal] = useState<AdjustmentModal | null>(null)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjNote, setAdjNote] = useState('')
  const [savingAdj, setSavingAdj] = useState(false)

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<PayrollRecord | null>(null)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payNote, setPayNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  // Bulk pay
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkPaying, setBulkPaying] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  // Payment filter
  const [payFilter, setPayFilter] = useState<'all' | 'pending' | 'paid'>('all')

  // Calculate confirm dialog
  const [showCalcConfirm, setShowCalcConfirm] = useState(false)
  const [calcScanCount, setCalcScanCount] = useState<number | null>(null)
  const [loadingCalcConfirm, setLoadingCalcConfirm] = useState(false)

  async function openCalcConfirm() {
    setShowCalcConfirm(true)
    setCalcScanCount(null)
    setLoadingCalcConfirm(true)
    try {
      const lastDay = new Date(year, month, 0).getDate()
      const mm = String(month).padStart(2, '0')
      const start = period === 1 ? `${year}-${mm}-01` : `${year}-${mm}-16`
      const end   = period === 1 ? `${year}-${mm}-15` : `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
      const res = await fetch(`/api/scans?start=${start}&end=${end}`)
      if (res.ok) {
        const data = await res.json()
        setCalcScanCount(Array.isArray(data) ? data.length : 0)
      } else {
        setCalcScanCount(0)
      }
    } catch {
      setCalcScanCount(0)
    } finally {
      setLoadingCalcConfirm(false)
    }
  }

  async function confirmAndCalculate() {
    setShowCalcConfirm(false)
    await handleCalculate()
  }

  // Employee detail modal
  const [detailRecord, setDetailRecord] = useState<PayrollRecord | null>(null)
  const [detailAttendance, setDetailAttendance] = useState<AttendanceRecord[]>([])
  const [detailAbsentDates, setDetailAbsentDates] = useState<{ date: string; type: string }[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function openDetail(r: PayrollRecord) {
    setDetailRecord(r)
    setDetailAttendance([])
    setDetailAbsentDates([])
    setLoadingDetail(true)
    try {
      const mm = String(r.month).padStart(2, '0')
      const lastDay = new Date(r.year, r.month, 0).getDate()
      const periodNum = r.period ?? 1
      const periodStart = periodNum === 1 ? `${r.year}-${mm}-01` : `${r.year}-${mm}-16`
      const periodEnd   = periodNum === 1 ? `${r.year}-${mm}-15` : `${r.year}-${mm}-${String(lastDay).padStart(2, '0')}`

      const [attRes, wsRes, holRes] = await Promise.all([
        fetch(`/api/attendance?start=${periodStart}&end=${periodEnd}&employeeId=${r.employee_id}`),
        fetch(`/api/settings`),
        fetch(`/api/holidays?year=${r.year}`),
      ])

      if (attRes.ok) {
        const data: (AttendanceRecord & { checkIn: string | null; checkOut: string | null })[] = await attRes.json()
        setDetailAttendance(data.map((rec) => ({
          ...rec,
          checkIn:  rec.checkIn  ? new Date(rec.checkIn)  : null,
          checkOut: rec.checkOut ? new Date(rec.checkOut) : null,
        })))

        // ── คำนวณวันที่ขาดงาน ─────────────────────────────────────────────
        if (wsRes.ok && holRes.ok) {
          const ws  = await wsRes.json() as { workDays: number[] }
          const hol = await holRes.json() as { date: string; is_active: number }[]
          const holidaySet = new Set(hol.filter(h => h.is_active).map(h => h.date))

          // สร้าง list วันทำงานในรอบนี้
          // หมายเหตุ: workDays ในระบบใช้ encoding 0=จันทร์…5=เสาร์ 6=อาทิตย์
          // ต่างจาก JS getDay() ที่ 0=อาทิตย์…6=เสาร์ → ต้องแปลงก่อนเทียบ
          const workingDates: string[] = []
          for (let d = 1; d <= lastDay; d++) {
            const dateStr = `${r.year}-${mm}-${String(d).padStart(2, '0')}`
            if (dateStr < periodStart || dateStr > periodEnd) continue
            const jsDay = new Date(r.year, r.month - 1, d).getDay()
            const ourDow = jsDay === 0 ? 6 : jsDay - 1  // แปลง JS→ encoding ระบบ
            if (!ws.workDays.includes(ourDow)) continue
            if (holidaySet.has(dateStr)) continue
            workingDates.push(dateStr)
          }

          // วันที่มาทำงาน = มีข้อมูลการสแกน/ลา และไม่ใช่ absent-type
          const ABSENT_STATUSES = new Set(['absent', 'leave_sick', 'leave_full_day'])
          // map date → status ของ absent-type leaves (มีบันทึกการลา)
          const leaveAbsentMap = new Map<string, string>(
            data
              .filter(rec => rec.status === 'leave_sick' || rec.status === 'leave_full_day')
              .map(rec => [rec.date, rec.status] as [string, string])
          )
          const presentDates = new Set<string>(
            data.filter(rec => !ABSENT_STATUSES.has(rec.status)).map(rec => rec.date)
          )

          // วันขาด = วันทำงานที่ไม่อยู่ใน presentDates
          const absentDates = workingDates
            .filter(d => !presentDates.has(d))
            .map(d => ({
              date: d,
              type: leaveAbsentMap.get(d) ?? 'absent', // 'absent' | 'leave_sick' | 'leave_full_day'
            }))
          setDetailAbsentDates(absentDates)
        }
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
      fetch(`/api/production/summary?year=${year}&month=${month}&period=${period}`),
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

  function openPaymentModal(r: PayrollRecord) {
    setPaymentModal(r)
    if (r.prompt_pay_id) setPayMethod('promptpay')
    else if (r.bank_account_number) setPayMethod('bank_transfer')
    else setPayMethod('cash')
    setPayNote('')
  }

  async function handleConfirmPayment() {
    if (!paymentModal) return
    setSavingPayment(true)
    try {
      await fetch(`/api/payroll/${paymentModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'paid',
          payment_method: payMethod,
          payment_note: payNote || null,
        }),
      })
      setPaymentModal(null)
      setSelectedIds(prev => { const n = new Set(prev); n.delete(paymentModal.id); return n })
      await loadPayroll()
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleBulkPay() {
    if (selectedIds.size === 0) return
    setBulkPaying(true)
    try {
      await Promise.all(
        [...selectedIds].map(id =>
          fetch(`/api/payroll/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_status: 'paid', payment_method: 'cash' }),
          })
        )
      )
      setSelectedIds(new Set())
      setShowBulkConfirm(false)
      await loadPayroll()
    } finally {
      setBulkPaying(false)
    }
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

  function openAdjustment(r: PayrollRecord, type: 'bonus' | 'deduction') {
    const currentAmount = type === 'bonus' ? (r.extra_bonus ?? 0) : (r.extra_deduction ?? 0)
    const currentNote = type === 'bonus' ? (r.extra_bonus_note ?? '') : (r.extra_deduction_note ?? '')
    setAdjustmentModal({ id: r.id, name: r.name, type, currentAmount, currentNote })
    setAdjAmount(currentAmount > 0 ? String(currentAmount) : '')
    setAdjNote(currentNote)
  }

  async function handleSaveAdjustment() {
    if (!adjustmentModal) return
    const amount = Number(adjAmount) || 0
    setSavingAdj(true)
    try {
      const body = adjustmentModal.type === 'bonus'
        ? { extra_bonus: amount, extra_bonus_note: adjNote }
        : { extra_deduction: amount, extra_deduction_note: adjNote }
      await fetch(`/api/payroll/${adjustmentModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setAdjustmentModal(null)
      await loadPayroll()
    } finally {
      setSavingAdj(false)
    }
  }

  // Esc key closes modals (priority: adjustment > dailyRate > detail > settings)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (adjustmentModal) { setAdjustmentModal(null); return }
      if (dailyRateModal) { setDailyRateModal(null); return }
      if (detailRecord) { setDetailRecord(null); return }
      if (showSettings) { setShowSettings(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [adjustmentModal, dailyRateModal, detailRecord, showSettings])

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
    extraBonus: s.extraBonus + (r.extra_bonus ?? 0),
    extraDeduction: s.extraDeduction + (r.extra_deduction ?? 0),
    totalPay: s.totalPay + r.total_pay,
  }), { basePay: 0, bonus: 0, extraBonus: 0, extraDeduction: 0, totalPay: 0 })

  const pendingRecords = records.filter(r => r.payment_status === 'pending')
  const paidRecords    = records.filter(r => r.payment_status === 'paid')
  const pendingTotal   = pendingRecords.reduce((s, r) => {
    const extraB = r.extra_bonus ?? 0
    const extraD = r.extra_deduction ?? 0
    return s + r.base_pay + r.diligence_bonus + extraB - extraD
  }, 0)
  const paidTotal = paidRecords.reduce((s, r) => {
    const extraB = r.extra_bonus ?? 0
    const extraD = r.extra_deduction ?? 0
    return s + r.base_pay + r.diligence_bonus + extraB - extraD
  }, 0)

  const filteredRecords = sortedRecords.filter(r => {
    if (payFilter === 'pending') return r.payment_status === 'pending'
    if (payFilter === 'paid')    return r.payment_status === 'paid'
    return true
  })

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const years = [2024, 2025, 2026, 2027]

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isNextMonthFuture = year > today.getFullYear() || (year === today.getFullYear() && month >= today.getMonth() + 1)

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
      {/* Row 1 — Title + Action buttons */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">เงินเดือน</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {period === 1 ? 'รอบ 1 (1–15)' : 'รอบ 2 (16–สิ้นเดือน)'}
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
          {canManage && (
            <>
              <button className="btn-secondary whitespace-nowrap" onClick={() => setShowSettings(!showSettings)}>⚙️ เบี้ยขยัน</button>
              <button className="btn-primary whitespace-nowrap" onClick={openCalcConfirm} disabled={loading}>
                {loading ? '⏳ คำนวณ...' : '🔄 คำนวณ'}
              </button>
            </>
          )}
          {records.length > 0 && (
            <button className="btn-secondary whitespace-nowrap" onClick={() => exportMonthlyReport(summaryForExport, year, month)}>⬇️ Export</button>
          )}
        </div>
      </div>

      {/* Row 2 — Filter bar */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors font-medium"
          >
            ←
          </button>
          <span className="px-2 text-sm font-semibold text-gray-800 min-w-[110px] text-center">
            {formatThaiMonthYear(year, month)}
          </span>
          <button
            onClick={nextMonth}
            disabled={isNextMonthFuture}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            →
          </button>
          <span className="text-gray-200 mx-1 select-none">|</span>
          <div className="flex rounded-lg overflow-hidden text-sm border border-gray-200">
            <button
              onClick={() => setPeriod(1)}
              className={`px-3 py-1 font-medium transition-colors ${period === 1 ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              รอบ 1
            </button>
            <button
              onClick={() => setPeriod(2)}
              className={`px-3 py-1 font-medium transition-colors border-l border-gray-200 ${period === 2 ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              รอบ 2
            </button>
          </div>
        </div>
      </div>

      {/* ── Calculate Confirmation Dialog ── */}
      {showCalcConfirm && (
        <div className="modal-backdrop" onClick={() => setShowCalcConfirm(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-xl">
                🔄
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base">ยืนยันการคำนวณเงินเดือน</p>
                <p className="text-sm text-gray-500 mt-1">
                  {formatThaiMonthYear(year, month)} · รอบ {period} ({period === 1 ? '1–15' : '16–สิ้นเดือน'})
                </p>
              </div>
            </div>

            {/* Scan warning */}
            <div className={`rounded-xl px-4 py-3 text-sm ${
              loadingCalcConfirm
                ? 'bg-gray-50 text-gray-400'
                : calcScanCount && calcScanCount > 0
                  ? 'bg-amber-50 border border-amber-200'
                  : 'bg-green-50 border border-green-200'
            }`}>
              {loadingCalcConfirm ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  กำลังตรวจสอบข้อมูลลายนิ้วมือ...
                </span>
              ) : calcScanCount && calcScanCount > 0 ? (
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5 text-base flex-shrink-0">⚠️</span>
                  <div>
                    <p className="font-semibold text-amber-800">พบข้อมูลลายนิ้วมือในช่วงนี้ {calcScanCount.toLocaleString()} รายการ</p>
                    <p className="text-amber-700 mt-0.5 text-xs leading-relaxed">
                      ข้อมูลเหล่านี้อาจยังไม่ได้ถูกนำเข้าระบบ หากคำนวณเงินเดือนตอนนี้ อาจทำให้ผลการคำนวณไม่ครบถ้วน
                    </p>
                  </div>
                </div>
              ) : (
                <span className="flex items-center gap-2 text-green-700 font-medium">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  ไม่พบข้อมูลลายนิ้วมือค้างอยู่ — พร้อมคำนวณ
                </span>
              )}
            </div>

            {/* Note */}
            {records.length > 0 && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                ℹ️ มีข้อมูลเงินเดือนอยู่แล้ว {records.length} คน การคำนวณใหม่จะอัปเดตตัวเลขทั้งหมด (ข้อมูลปรับเพิ่ม/ลดที่ตั้งค่าไว้จะถูกรักษาไว้)
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCalcConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmAndCalculate}
                disabled={loadingCalcConfirm}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loadingCalcConfirm ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    ตรวจสอบ...
                  </>
                ) : 'คำนวณเงินเดือน'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Payment Summary Bar ── */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">⏳</div>
            <div>
              <p className="text-xs text-amber-700 font-medium">รอจ่าย</p>
              <p className="text-base font-bold text-amber-800">{pendingRecords.length} คน</p>
              <p className="text-xs text-amber-600">{formatCurrency(pendingTotal)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">✅</div>
            <div>
              <p className="text-xs text-green-700 font-medium">จ่ายแล้ว</p>
              <p className="text-base font-bold text-green-800">{paidRecords.length} คน</p>
              <p className="text-xs text-green-600">{formatCurrency(paidTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <p className="text-xs text-white/70 mb-1">💰 เงินเดือน</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.basePay)}</p>
          </div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <p className="text-xs text-white/70 mb-1">⭐ เบี้ยขยัน</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.bonus)}</p>
          </div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white col-span-2 lg:col-span-1">
            <p className="text-xs text-white/70 mb-1">🏆 รวมทั้งหมด</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.totalPay)}</p>
          </div>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-teal-500 to-teal-600 text-white">
            <p className="text-xs text-white/70 mb-1">🖨️ ผลงานรวม (ชิ้น)</p>
            <p className="text-2xl font-bold">
              {Object.values(productionByEmployee).reduce((s, v) => s + v, 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* ── Payment Filter + Bulk Action ── */}
      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {([
              { key: 'all',     label: 'ทั้งหมด',   count: records.length },
              { key: 'pending', label: 'รอจ่าย',    count: pendingRecords.length },
              { key: 'paid',    label: 'จ่ายแล้ว',  count: paidRecords.length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setPayFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  payFilter === tab.key ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  payFilter === tab.key ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-800">
              เลือก {selectedIds.size} คน &mdash; {formatCurrency(
                records.filter(r => selectedIds.has(r.id)).reduce((s, r) => {
                  const extraB = r.extra_bonus ?? 0
                  const extraD = r.extra_deduction ?? 0
                  return s + r.base_pay + r.diligence_bonus + extraB - extraD
                }, 0)
              )}
            </p>
            <p className="text-xs text-blue-600">จ่ายเงินสดพร้อมกัน</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setSelectedIds(new Set())} className="btn-secondary text-sm !py-1.5">ยกเลิก</button>
            <button onClick={() => setShowBulkConfirm(true)} disabled={bulkPaying} className="btn-primary text-sm !py-1.5">
              💵 จ่ายที่เลือก ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Payroll Table */}
      <div className="card !p-0 overflow-hidden">
        {records.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💰</div>
            <p className="font-semibold text-gray-700 mb-1">ยังไม่มีข้อมูลเงินเดือน</p>
            <p className="text-sm text-gray-400 mb-5">{formatThaiMonthYear(year, month)} · รอบ {period}</p>
            {canManage && <button className="btn-primary" onClick={openCalcConfirm}>🔄 คำนวณเงินเดือน</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {canManage && (
                  <th className="table-header w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === pendingRecords.filter(r => filteredRecords.includes(r)).length}
                      onChange={e => {
                        const visiblePending = filteredRecords.filter(r => r.payment_status === 'pending')
                        if (e.target.checked) setSelectedIds(new Set(visiblePending.map(r => r.id)))
                        else setSelectedIds(new Set())
                      }}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </th>
                )}
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
                {canManage && <th className="table-header text-center">ปรับ</th>}
                <th className="table-header text-center whitespace-nowrap">สถานะ</th>
              </tr></thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const switchedToDaily = r.employment_type === 'monthly' && r.days_absent > paySettings.monthlyMaxAbsent
                  return (
                    <tr key={r.employee_id} className="hover:bg-gray-50">
                      {canManage && (
                        <td className="table-cell w-10">
                          {r.payment_status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={e => {
                                const next = new Set(selectedIds)
                                if (e.target.checked) next.add(r.id)
                                else next.delete(r.id)
                                setSelectedIds(next)
                              }}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                            {r.name.charAt(0)}
                          </div>
                          <button className="font-medium text-gray-800 hover:text-blue-600 transition-colors text-left" onClick={() => openDetail(r)}>
                            {r.name}
                          </button>
                        </div>
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
                              className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded hover:bg-yellow-200 transition-colors"
                              title={`คิดรายวัน (ขาด>${paySettings.monthlyMaxAbsent}วัน): ${formatCurrency(r.base_pay / (r.days_present || 1))}/วัน`}
                              onClick={() => { setDailyRateModal({ employeeId: r.employee_id, name: r.name }); setNewDailyRate('') }}
                            >
                              ⚠️ คิดรายวัน
                            </button>
                          )}
                          {switchedToDaily && !canManage && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚠️ คิดรายวัน</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-right">
                        {r.diligence_bonus > 0
                          ? <span className="text-green-600 font-medium">+{formatCurrency(r.diligence_bonus)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell text-right">
                        {(() => {
                          const extraB = r.extra_bonus ?? 0
                          const extraD = r.extra_deduction ?? 0
                          const hasAdj = extraB > 0 || extraD > 0
                          const net = r.base_pay + r.diligence_bonus + extraB - extraD
                          return (
                            <>
                              {hasAdj && (
                                <p className="text-xs text-gray-400 line-through">{formatCurrency(r.base_pay + r.diligence_bonus)}</p>
                              )}
                              {extraB > 0 && <p className="text-xs text-green-600">+{formatCurrency(extraB)}</p>}
                              {extraD > 0 && <p className="text-xs text-red-500">-{formatCurrency(extraD)}</p>}
                              <p className="font-bold text-purple-700">{formatCurrency(net)}</p>
                            </>
                          )
                        })()}
                      </td>
                      {canManage && (
                        <td className="table-cell">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => openAdjustment(r, 'bonus')}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                (r.extra_bonus ?? 0) > 0
                                  ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                              }`}
                              title="เงินเพิ่มพิเศษ"
                            >
                              +เพิ่ม
                            </button>
                            <button
                              onClick={() => openAdjustment(r, 'deduction')}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                (r.extra_deduction ?? 0) > 0
                                  ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                              }`}
                              title="หักเงิน"
                            >
                              -หัก
                            </button>
                          </div>
                        </td>
                      )}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {r.payment_status === 'paid' ? (
                            <>
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full"
                                title={r.paid_at ? `จ่ายโดย ${r.paid_by ?? ''} เมื่อ ${new Date(r.paid_at.endsWith('Z') ? r.paid_at : r.paid_at + 'Z').toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}` : undefined}
                              >
                                {r.payment_method ? PAYMENT_METHOD_ICONS[r.payment_method] : '✅'} จ่ายแล้ว
                              </span>
                              {canManage && (
                                <button
                                  onClick={() => {
                                    fetch(`/api/payroll/${r.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ payment_status: 'pending' }),
                                    }).then(() => loadPayroll())
                                  }}
                                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                  title="ยกเลิกการจ่าย"
                                >✕</button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                                ⏳ รอจ่าย
                              </span>
                              {canManage && (
                                <button
                                  onClick={() => openPaymentModal(r)}
                                  className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                >
                                  จ่าย
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-blue-50 font-bold">
                  {canManage && <td className="table-cell" />}
                  <td className="table-cell" colSpan={9}>รวมทั้งหมด</td>
                  <td className="table-cell text-right text-blue-700">{formatCurrency(totals.basePay)}</td>
                  <td className="table-cell text-right text-green-700">{formatCurrency(totals.bonus)}</td>
                  <td className="table-cell text-right">
                    {(totals.extraBonus > 0 || totals.extraDeduction > 0) && (
                      <p className="text-xs text-gray-400 line-through">{formatCurrency(totals.basePay + totals.bonus)}</p>
                    )}
                    {totals.extraBonus > 0 && <p className="text-xs text-green-600">+{formatCurrency(totals.extraBonus)}</p>}
                    {totals.extraDeduction > 0 && <p className="text-xs text-red-500">-{formatCurrency(totals.extraDeduction)}</p>}
                    <p className="font-semibold text-purple-700">{formatCurrency(totals.basePay + totals.bonus + totals.extraBonus - totals.extraDeduction)}</p>
                  </td>
                  {canManage && <td className="table-cell" />}
                  <td className="table-cell" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center gap-3 py-4 text-sm text-blue-600">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          กำลังคำนวณเงินเดือน...
        </div>
      )}
      {/* ── Payment Modal ── */}
      {paymentModal && (
        <div className="modal-backdrop" onClick={() => setPaymentModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">บันทึกการจ่ายเงิน</h3>
              <button onClick={() => setPaymentModal(null)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Employee info */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                  {paymentModal.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{paymentModal.name}</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(paymentModal.base_pay + paymentModal.diligence_bonus + (paymentModal.extra_bonus ?? 0) - (paymentModal.extra_deduction ?? 0))}
                  </p>
                </div>
              </div>

              {/* Method selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">วิธีการจ่าย</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'bank_transfer', 'promptpay'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setPayMethod(m)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                        payMethod === m
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <span className="text-xl">{PAYMENT_METHOD_ICONS[m]}</span>
                      <span className="text-xs text-center leading-tight">{PAYMENT_METHOD_LABELS[m]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank details */}
              {payMethod === 'bank_transfer' && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                  {paymentModal.bank_name ? (
                    <>
                      {(() => {
                        const bank = getBankById(paymentModal.bank_name)
                        return bank ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold mb-1" style={{ backgroundColor: bank.bgColor, color: bank.color }}>
                            {bank.shortName} · {bank.name}
                          </span>
                        ) : <span className="text-xs text-gray-500">{paymentModal.bank_name}</span>
                      })()}
                      <p className="text-gray-600">เลขบัญชี: <span className="font-mono font-semibold text-gray-800">{paymentModal.bank_account_number ?? '—'}</span></p>
                      <p className="text-gray-600">ชื่อบัญชี: <span className="font-semibold text-gray-800">{paymentModal.bank_account_name ?? '—'}</span></p>
                    </>
                  ) : (
                    <p className="text-gray-400 text-xs italic text-center py-2">ไม่มีข้อมูลบัญชีธนาคาร<br/>กรอกข้อมูลได้ที่หน้าจัดการพนักงาน</p>
                  )}
                </div>
              )}

              {/* PromptPay details */}
              {payMethod === 'promptpay' && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  {paymentModal.prompt_pay_id ? (
                    <p className="text-gray-600">PromptPay: <span className="font-mono font-semibold text-gray-800">{paymentModal.prompt_pay_id}</span></p>
                  ) : (
                    <p className="text-gray-400 text-xs italic text-center py-2">ไม่มีข้อมูล PromptPay<br/>กรอกข้อมูลได้ที่หน้าจัดการพนักงาน</p>
                  )}
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">หมายเหตุ (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition-all"
                  placeholder="เช่น โอนเข้าบัญชีเรียบร้อย"
                />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2 justify-end">
              <button onClick={() => setPaymentModal(null)} className="btn-secondary">ยกเลิก</button>
              <button
                onClick={handleConfirmPayment}
                disabled={savingPayment}
                className="btn-primary flex items-center gap-2"
              >
                {savingPayment ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    กำลังบันทึก...
                  </>
                ) : `✅ ยืนยันการจ่าย`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Pay Confirm Dialog ── */}
      {showBulkConfirm && (
        <div className="modal-backdrop" onClick={() => setShowBulkConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-xl flex-shrink-0">💵</div>
              <div>
                <p className="font-bold text-gray-900">ยืนยันจ่ายเงินสด</p>
                <p className="text-sm text-gray-500 mt-1">
                  จ่ายเงินสดให้ <span className="font-semibold text-gray-700">{selectedIds.size} คน</span> รวม{' '}
                  <span className="font-semibold text-green-600">
                    {formatCurrency(records.filter(r => selectedIds.has(r.id)).reduce((s, r) => {
                      return s + r.base_pay + r.diligence_bonus + (r.extra_bonus ?? 0) - (r.extra_deduction ?? 0)
                    }, 0))}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBulkConfirm(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleBulkPay} disabled={bulkPaying} className="btn-primary flex items-center gap-2">
                {bulkPaying ? '⏳ กำลังบันทึก...' : `✅ ยืนยัน (${selectedIds.size} คน)`}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {(detailRecord.extra_bonus ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">เงินเพิ่มพิเศษ{detailRecord.extra_bonus_note ? ` (${detailRecord.extra_bonus_note})` : ''}</span>
                      <span className="text-green-600 font-medium">+{formatCurrency(detailRecord.extra_bonus)}</span>
                    </div>
                  )}
                  {(detailRecord.extra_deduction ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">หัก{detailRecord.extra_deduction_note ? ` (${detailRecord.extra_deduction_note})` : ''}</span>
                      <span className="text-red-600 font-medium">-{formatCurrency(detailRecord.extra_deduction)}</span>
                    </div>
                  )}
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

              {/* Absent dates section */}
              {detailAbsentDates.length > 0 && (
                <div className="px-6 pb-4">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2.5">
                      🚫 วันที่ขาดงาน ({detailAbsentDates.length} วัน)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailAbsentDates.map(({ date, type }) => (
                        <span
                          key={date}
                          className={`text-xs px-2.5 py-1 rounded-md font-medium ${
                            type === 'leave_full_day' || type === 'leave_sick'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                          title={
                            type === 'leave_full_day' ? 'ลาทั้งวัน (ไม่ได้รับค่าจ้าง)'
                            : type === 'leave_sick'    ? 'ลาป่วย (ไม่มีใบแพทย์)'
                            : 'ขาดงาน'
                          }
                        >
                          {formatThaiDateShort(date)}
                          {(type === 'leave_full_day' || type === 'leave_sick') && (
                            <span className="ml-1 opacity-60 text-[10px]">ลา</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-red-400 mt-2">
                      🔴 แดง = ขาดงาน &nbsp;|&nbsp; 🟠 ส้ม = ลาไม่มีใบแพทย์ (นับเป็นวันขาด)
                    </p>
                  </div>
                </div>
              )}

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

      {/* Adjustment Modal */}
      {adjustmentModal && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {adjustmentModal.type === 'bonus' ? 'เงินเพิ่มพิเศษ' : 'หักเงิน'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{adjustmentModal.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  min={0}
                  className="w-full"
                  placeholder="เช่น 500"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <input
                  type="text"
                  className="w-full"
                  placeholder={adjustmentModal.type === 'bonus' ? 'เช่น ค่าทำความสะอาด' : 'เช่น เบิกล่วงหน้า'}
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAdjustment() }}
                />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setAdjAmount('0')
                  setAdjNote('')
                }}
              >
                ล้างค่า
              </button>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setAdjustmentModal(null)}>ยกเลิก</button>
                <button
                  className={`btn-primary ${adjustmentModal.type === 'deduction' ? '!bg-red-600 hover:!bg-red-700' : ''}`}
                  onClick={handleSaveAdjustment}
                  disabled={savingAdj}
                >
                  {savingAdj ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
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
