'use client'
import { useState, useEffect, useMemo } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import StatusBadge from '@/components/shared/StatusBadge'
import {
  formatThaiMonthYear,
  formatCurrency,
  formatTime,
  formatMinutes,
  THAI_MONTHS_SHORT,
  toBuddhistYear,
} from '@/lib/formatters'
import { AttendanceStatus } from '@/lib/types'

interface AttendanceRec {
  employeeId: string
  name: string
  date: string
  checkIn: Date | null
  checkOut: Date | null
  workHours: number | null
  lateMinutes: number
  status: AttendanceStatus
  isLate: boolean
  isEarlyLeave: boolean
}

interface PayrollRec {
  employee_id: string
  year: number
  month: number
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

interface LeaveRec {
  id: number
  employee_id: string
  leave_type: string
  date: string
  status: string
  reason: string | null
  created_at: string
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'ลาป่วย (มีใบรับรองแพทย์)',
  full_day: 'ลาทั้งวัน',
  half_morning: 'ลาครึ่งวันเช้า',
  half_afternoon: 'ลาครึ่งวันบ่าย',
}

const LEAVE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'รอการอนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
}

const ATTENDANCE_BORDER: Partial<Record<AttendanceStatus, string>> = {
  present: 'border-l-green-400',
  late: 'border-l-yellow-400',
  earlyLeave: 'border-l-yellow-400',
  halfDay: 'border-l-purple-400',
  noCheckout: 'border-l-slate-300',
  absent: 'border-l-red-400',
  holiday: 'border-l-slate-300',
  leave_sick: 'border-l-orange-400',
  leave_sick_cert: 'border-l-orange-400',
  leave_full_day: 'border-l-orange-400',
  leave_half_morning: 'border-l-orange-400',
  leave_half_afternoon: 'border-l-orange-400',
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse text-center !py-4">
      <div className="h-7 bg-gray-200 rounded w-16 mx-auto mb-2" />
      <div className="h-3 bg-gray-100 rounded w-20 mx-auto" />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-l-4 border-l-gray-200 animate-pulse">
      <div className="w-14 h-3 bg-gray-200 rounded flex-shrink-0" />
      <div className="w-16 h-5 bg-gray-100 rounded-full" />
      <div className="ml-auto w-24 h-3 bg-gray-200 rounded" />
      <div className="w-10 h-3 bg-gray-100 rounded" />
    </div>
  )
}

export default function MePage() {
  const { user, loading: userLoading } = useCurrentUser()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const [attendance, setAttendance] = useState<AttendanceRec[]>([])
  const [payroll, setPayroll] = useState<PayrollRec | null>(null)
  const [leaves, setLeaves] = useState<LeaveRec[]>([])

  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [loadingPayroll, setLoadingPayroll] = useState(true)
  const [loadingLeaves, setLoadingLeaves] = useState(true)

  const currentYear  = today.getFullYear()
  const currentMonth = today.getMonth() + 1


  useEffect(() => {
    if (!user || userLoading) return
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = `${year}-${String(month).padStart(2, '0')}-31`

    setLoadingAttendance(true)
    setLoadingPayroll(true)
    setLoadingLeaves(true)

    fetch(`/api/attendance?start=${start}&end=${end}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: (Omit<AttendanceRec, 'checkIn' | 'checkOut'> & { checkIn: string | null; checkOut: string | null })[]) => {
        setAttendance(data.map(r => ({
          ...r,
          checkIn: r.checkIn ? new Date(r.checkIn) : null,
          checkOut: r.checkOut ? new Date(r.checkOut) : null,
        })))
      })
      .catch(() => setAttendance([]))
      .finally(() => setLoadingAttendance(false))

    fetch(`/api/payroll?year=${year}&month=${month}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: PayrollRec[]) => {
        if (data.length === 0) { setPayroll(null); return }
        // รวมทุก period ในเดือนเดียวกัน (period 1 + period 2 → ทั้งเดือน)
        const merged: PayrollRec = data.reduce((acc, rec) => ({
          ...acc,
          working_days:       acc.working_days       + rec.working_days,
          days_present:       acc.days_present       + rec.days_present,
          days_absent:        acc.days_absent        + rec.days_absent,
          days_sick_with_cert: acc.days_sick_with_cert + rec.days_sick_with_cert,
          days_sick_no_cert:  acc.days_sick_no_cert  + rec.days_sick_no_cert,
          days_half_day:      acc.days_half_day      + rec.days_half_day,
          total_late_minutes: acc.total_late_minutes + rec.total_late_minutes,
          base_pay:           acc.base_pay           + rec.base_pay,
          diligence_bonus:    acc.diligence_bonus    + rec.diligence_bonus,
          deductions:         acc.deductions         + rec.deductions,
          total_pay:          acc.total_pay          + rec.total_pay,
        }))
        setPayroll(merged)
      })
      .catch(() => setPayroll(null))
      .finally(() => setLoadingPayroll(false))

    fetch('/api/leaves')
      .then(r => r.ok ? r.json() : [])
      .then(setLeaves)
      .catch(() => setLeaves([]))
      .finally(() => setLoadingLeaves(false))

  }, [user, userLoading, year, month])

  // KPI computed values
  const kpi = useMemo(() => {
    const todayStr = today.toISOString().slice(0, 10)
    const isCurrentMonth = year === currentYear && month === currentMonth

    // เดือนปัจจุบัน: คำนวณจาก attendance array ตัด cutoff วันนี้
    // (payroll record อาจถูก calculate ก่อน import scan → ข้อมูลไม่ตรง)
    if (isCurrentMonth || !payroll) {
      const filtered = isCurrentMonth
        ? attendance.filter(r => r.date <= todayStr)
        : attendance
      const present = filtered.filter(r => !['absent', 'holiday'].includes(r.status)).length
      const absent  = filtered.filter(r => r.status === 'absent').length
      const working = filtered.filter(r => r.status !== 'holiday').length
      const late    = filtered.reduce((s, r) => s + (r.lateMinutes ?? 0), 0)
      return {
        daysPresent: present,
        workingDays: working || null,
        daysAbsent: absent,
        lateMinutes: late,
        diligenceBonus: payroll?.diligence_bonus ?? null,
        hasPayroll: !!payroll,
      }
    }

    // เดือนที่ผ่านมา: ใช้ payroll record (คำนวณแล้วถูกต้อง)
    return {
      daysPresent: payroll.days_present,
      workingDays: payroll.working_days,
      daysAbsent: payroll.days_absent + payroll.days_sick_no_cert,
      lateMinutes: payroll.total_late_minutes,
      diligenceBonus: payroll.diligence_bonus,
      hasPayroll: true,
    }
  }, [payroll, attendance, year, month, currentYear, currentMonth])

  // Quick status badge
  const statusBadge = useMemo(() => {
    if (loadingAttendance && loadingPayroll) return null
    if (kpi.daysAbsent === 0 && kpi.lateMinutes === 0) {
      return { text: 'มาครบ ✓', cls: 'bg-green-100 text-green-700' }
    }
    if (kpi.daysAbsent > 0) {
      return { text: `ขาด ${kpi.daysAbsent} วัน`, cls: 'bg-red-100 text-red-700' }
    }
    return { text: `สาย ${formatMinutes(kpi.lateMinutes)}`, cls: 'bg-yellow-100 text-yellow-700' }
  }, [kpi, loadingAttendance, loadingPayroll])

  // All attendance for selected month sorted newest first
  const sortedAttendance = useMemo(() => (
    [...attendance].sort((a, b) => b.date.localeCompare(a.date))
  ), [attendance])

  // Leave stats
  const leaveStats = useMemo(() => {
    const pending = leaves.filter(l => l.status === 'pending').length
    const approved = leaves.filter(l => l.status === 'approved').length
    const thisMonth = leaves.filter(l => {
      const d = new Date(l.date + 'T00:00:00')
      return d.getFullYear() === year && d.getMonth() + 1 === month
    }).length
    return { pending, approved, thisMonth }
  }, [leaves, year, month])

  const recentLeaves = useMemo(() => (
    [...leaves].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
  ), [leaves])

  const years = [currentYear - 1, currentYear]

  if (userLoading) return null

  // No employee linked
  if (!user?.employeeId) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-5xl mb-4">🔗</p>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ยังไม่ได้เชื่อมโยงกับพนักงาน</h2>
          <p className="text-gray-500 text-sm max-w-xs">บัญชีของคุณยังไม่ได้เชื่อมกับข้อมูลพนักงาน กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    )
  }

  const displayName = user.fullName || user.username

  return (
    <div className="page-container">
      {/* ── Section 1: Header + Month Selector ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              สวัสดี, {displayName} 👋
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">{formatThaiMonthYear(year, month)}</p>
          </div>
          {statusBadge && (
            <span className={`text-sm font-semibold px-3 py-1.5 rounded-full flex-shrink-0 ${statusBadge.cls}`}>
              {statusBadge.text}
            </span>
          )}
        </div>

        {/* Month + Year selector */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 overflow-x-auto pb-1 flex-1 scrollbar-none">
            {THAI_MONTHS_SHORT.map((m, i) => {
              const isFuture = year === currentYear && (i + 1) > currentMonth
              return (
                <button
                  key={i}
                  onClick={() => !isFuture && setMonth(i + 1)}
                  disabled={isFuture}
                  className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                    month === i + 1
                      ? 'bg-blue-600 text-white'
                      : isFuture
                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="!w-auto text-sm flex-shrink-0"
          >
            {years.map(y => (
              <option key={y} value={y}>{toBuddhistYear(y)}</option>
            ))}

          </select>
        </div>
      </div>

      {/* ── Section 2: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {(loadingAttendance && loadingPayroll) ? (
          [0,1,2,3].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="card text-center !py-3 sm:!py-4">
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {kpi.daysPresent}
                {kpi.workingDays != null && <span className="text-lg text-gray-400">/{kpi.workingDays}</span>}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">มาทำงาน (วัน)</p>
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              <p className={`text-2xl sm:text-3xl font-bold ${kpi.daysAbsent > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {kpi.daysAbsent}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">ขาด/ลา (วัน)</p>
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              <p className={`text-xl sm:text-2xl font-bold ${kpi.lateMinutes > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                {kpi.lateMinutes > 0 ? formatMinutes(kpi.lateMinutes) : '—'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">เวลาสาย</p>
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              {kpi.hasPayroll ? (
                <>
                  <p className={`text-xl sm:text-2xl font-bold ${(kpi.diligenceBonus ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {(kpi.diligenceBonus ?? 0) > 0 ? formatCurrency(kpi.diligenceBonus!) : '฿0'}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">เบี้ยขยัน</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-300 mt-1">—</p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-1">เบี้ยขยัน</p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Section 3: Attendance this month ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">การเข้างาน — {formatThaiMonthYear(year, month)}</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {loadingAttendance ? (
            [0,1,2,3,4].map(i => <SkeletonRow key={i} />)
          ) : sortedAttendance.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">ไม่มีข้อมูลการเข้างานในเดือนนี้</div>
          ) : (
            sortedAttendance.map(rec => {
              const borderCls = ATTENDANCE_BORDER[rec.status] ?? 'border-l-gray-200'
              const dateObj = new Date(rec.date + 'T00:00:00')
              const dayStr = dateObj.toLocaleDateString('th-TH', { weekday: 'short' })
              const dateStr = `${dateObj.getDate()} ${['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][dateObj.getMonth()]}`
              return (
                <div key={rec.date} className={`flex items-center gap-2 sm:gap-3 py-2.5 px-4 border-l-4 ${borderCls}`}>
                  <div className="w-16 sm:w-20 flex-shrink-0">
                    <p className="text-xs font-medium text-gray-700">{dateStr}</p>
                    <p className="text-xs text-gray-400">{dayStr}</p>
                  </div>
                  <StatusBadge status={rec.status} />
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="text-gray-400">เข้า</span>
                      <span className="font-mono font-medium text-gray-700">{rec.checkIn ? formatTime(rec.checkIn) : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="text-gray-400">ออก</span>
                      <span className="font-mono font-medium text-gray-700">{rec.checkOut ? formatTime(rec.checkOut) : '—'}</span>
                    </div>
                    {rec.workHours != null && (
                      <span className="hidden sm:inline text-xs text-gray-400">
                        {Math.floor(rec.workHours)}ชม.
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Section 4: Leave Summary ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">สรุปการลา</h3>
        </div>

        {/* 3 mini stats */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: 'รออนุมัติ', value: leaveStats.pending, cls: leaveStats.pending > 0 ? 'text-yellow-600' : 'text-gray-400' },
            { label: 'อนุมัติแล้ว', value: leaveStats.approved, cls: 'text-green-600' },
            { label: 'เดือนนี้', value: leaveStats.thisMonth, cls: 'text-blue-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="text-center py-3 px-2">
              <p className={`text-xl font-bold ${cls}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent leaves list */}
        <div className="divide-y divide-gray-50">
          {loadingLeaves ? (
            [0,1,2].map(i => (
              <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
                <div className="space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-5 bg-gray-100 rounded-full w-20" />
              </div>
            ))
          ) : recentLeaves.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">ยังไม่มีใบลา</div>
          ) : (
            recentLeaves.map(leave => (
              <div key={leave.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {LEAVE_TYPE_LABELS[leave.leave_type] ?? leave.leave_type}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(leave.date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${LEAVE_STATUS_COLORS[leave.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {LEAVE_STATUS_LABELS[leave.status] ?? leave.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
