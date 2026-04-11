'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getDailyRecords, getAvailableDates } from '@/lib/reports'
import { formatTime, formatHours, formatMinutes } from '@/lib/formatters'
import StatusBadge from '@/components/shared/StatusBadge'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canManage } from '@/lib/auth'
import StatusOverrideModal from '@/components/attendance/StatusOverrideModal'
import { exportDailyReport } from '@/lib/exporter'
import { AttendanceStatus, EmployeeProfile } from '@/lib/types'

type DailySortKey = 'name' | 'checkIn' | 'checkOut' | 'workHours' | 'lateMinutes' | 'status'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateThai(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  const dateObj = new Date(dateStr + 'T00:00:00')
  return {
    day: thaiDays[dateObj.getDay()],
    full: `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`,
  }
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildCalendarDays(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(firstDay).fill(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return cells
}

export default function DailyPage() {
  const { master, settings, loadAttendance, loadSettings, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [holidayDates, setHolidayDates] = useState<Map<string, string>>(new Map())

  // Date navigator
  const today = todayStr()
  const [selectedDate, setSelectedDate] = useState<string>(today)

  // Calendar picker
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarYM, setCalendarYM] = useState(() => today.slice(0, 7))
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set())
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoaded) loadAttendance()
    loadSettings()
    fetch('/api/employees').then(r => r.ok ? r.json() : []).then(setEmployees).catch(() => {})
  }, [isLoaded])

  // Load holidays for current year
  useEffect(() => {
    const y = selectedDate.slice(0, 4)
    fetch(`/api/holidays?year=${y}`)
      .then(r => r.json())
      .then((data: { date: string; name: string; is_active: number }[]) => {
        const map = new Map<string, string>()
        for (const h of data) if (h.is_active) map.set(h.date, h.name)
        setHolidayDates(map)
      })
      .catch(() => {})
  }, [selectedDate.slice(0, 4)])

  // Load recorded dates when calendar opens
  useEffect(() => {
    if (!showCalendar) return
    const [y, m] = calendarYM.split('-')
    // Use available dates from master for this month
    const monthDates = new Set(
      getAvailableDates(master).filter(d => d.startsWith(`${y}-${m}`))
    )
    setRecordedDates(monthDates)
    // Refresh holidays if year changed
    fetch(`/api/holidays?year=${y}`)
      .then(r => r.json())
      .then((data: { date: string; name: string; is_active: number }[]) => {
        const map = new Map<string, string>()
        for (const h of data) if (h.is_active) map.set(h.date, h.name)
        setHolidayDates(map)
      })
      .catch(() => {})
  }, [showCalendar, calendarYM, master])

  // Close calendar on Esc
  useEffect(() => {
    if (!showCalendar) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowCalendar(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showCalendar])

  function openCalendar() {
    setCalendarYM(selectedDate.slice(0, 7))
    setShowCalendar(true)
  }

  function prevCalendarMonth() {
    const [y, m] = calendarYM.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function nextCalendarMonth() {
    const [y, m] = calendarYM.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const [overrideTarget, setOverrideTarget] = useState<{ employeeId: string; name: string; status: string } | null>(null)

  const isRegularUser = user?.role === 'user'
  const hasManage = user && canManage(user.role)

  const { sortKey, sortDir, handleSort, sorted } = useSortable<DailySortKey>('name')

  const [specialWorkDaySet, setSpecialWorkDaySet] = useState<Set<string>>(new Set())

  // Load special work days for selected month
  useEffect(() => {
    const [y, m] = selectedDate.split('-')
    fetch(`/api/special-work-days?year=${y}&month=${Number(m)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { date: string }[]) => setSpecialWorkDaySet(new Set(data.map(d => d.date))))
      .catch(() => {})
  }, [selectedDate.slice(0, 7)])

  const isSpecialWorkDay = specialWorkDaySet.has(selectedDate)

  const isWorkingDay = useMemo(() => {
    if (!selectedDate) return false
    if (isSpecialWorkDay) return true // วันทำงานพิเศษ = นับเป็นวันทำงานเสมอ
    const holidayName = holidayDates.get(selectedDate)
    const isSunday = new Date(selectedDate + 'T00:00:00').getDay() === 0
    if (holidayName || isSunday) return false
    const jsDay = new Date(selectedDate + 'T00:00:00').getDay()
    const ourDow = jsDay === 0 ? 6 : jsDay - 1
    return settings.workDays.includes(ourDow)
  }, [selectedDate, holidayDates, settings.workDays, isSpecialWorkDay])

  const rawRecords = useMemo(() => {
    const all = getDailyRecords(master, selectedDate)
    if (isRegularUser && user?.employeeId) return all.filter(r => r.employeeId === user.employeeId)
    return all
  }, [master, selectedDate, isRegularUser, user?.employeeId])

  const absentEmployees = useMemo(() => {
    if (isRegularUser || !isWorkingDay || !selectedDate) return []
    const presentIds = new Set(rawRecords.map(r => r.employeeId))
    return employees
      .filter(e => e.isActive && !presentIds.has(e.employeeId))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }, [employees, rawRecords, isWorkingDay, isRegularUser, selectedDate])

  const records = useMemo(() => sorted(rawRecords, (key, r) => {
    switch (key) {
      case 'name': return r.name
      case 'checkIn': return r.checkIn ? r.checkIn.getTime() : -1
      case 'checkOut': return r.checkOut ? r.checkOut.getTime() : -1
      case 'workHours': return r.workHours ?? -1
      case 'lateMinutes': return r.lateMinutes
      case 'status': return r.status
    }
  }), [rawRecords, sortKey, sortDir])

  const stats = useMemo(() => ({
    present: rawRecords.filter(r => !['absent'].includes(r.status)).length,
    late: rawRecords.filter(r => r.isLate).length,
    absent: rawRecords.filter(r => r.status === 'absent').length + absentEmployees.length,
    noCheckout: rawRecords.filter(r => r.status === 'noCheckout').length,
  }), [rawRecords, absentEmployees])

  const isToday = selectedDate === today
  const selectedIsSunday = new Date(selectedDate + 'T00:00:00').getDay() === 0
  const selectedHolidayName = holidayDates.get(selectedDate)
  const isSelectedHoliday = selectedIsSunday || !!selectedHolidayName
  const holidayLabel = selectedHolidayName ?? (selectedIsSunday ? 'วันอาทิตย์' : '')
  const { day, full } = formatDateThai(selectedDate)

  const thaiMonthsFull = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  const calDays = buildCalendarDays(calendarYM)
  const [calY, calM] = calendarYM.split('-').map(Number)

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">รายงานรายวัน</h2>
        </div>
        {rawRecords.length > 0 && !isRegularUser && (
          <button className="btn-secondary whitespace-nowrap" onClick={() => exportDailyReport(rawRecords, selectedDate)}>
            ⬇️ Export
          </button>
        )}
      </div>

      {/* Date Navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedDate(d => addDays(d, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={openCalendar}
          className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer hover:border-blue-300 transition-colors text-left"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${isSelectedHoliday ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50'}`}>{day}</span>
              <span className="font-semibold text-gray-800">{full}</span>
              {isToday && (
                <span className="text-xs font-semibold text-white bg-blue-500 px-2 py-0.5 rounded-lg">วันนี้</span>
              )}
              {isSelectedHoliday && !isSpecialWorkDay && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">🏖️ {holidayLabel}</span>
              )}
              {isSpecialWorkDay && (
                <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg">🏭 วันทำงานพิเศษ</span>
              )}
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          onClick={() => setSelectedDate(d => addDays(d, 1))}
          disabled={selectedDate >= today}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!isToday && (
          <button
            onClick={() => setSelectedDate(today)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            วันนี้
          </button>
        )}
      </div>

      {/* Stats */}
      {!isRegularUser && (
        <div className="stats-grid">
          {[
            { label: 'มาทำงาน', value: stats.present, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', icon: '✅' },
            { label: 'มาสาย', value: stats.late, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', icon: '⏰' },
            { label: 'ไม่มีบันทึกออก', value: stats.noCheckout, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', icon: '🔓' },
            { label: 'ขาดงาน', value: stats.absent, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: '❌' },
          ].map((s) => (
            <div key={s.label} className={`stat-card ${s.bg} border ${s.border}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">{s.label}</p>
                <span className="text-base">{s.icon}</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">คน</p>
            </div>
          ))}
        </div>
      )}

      {/* Records table */}
      <div className="card !p-0 overflow-hidden">
        {records.length === 0 && absentEmployees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-gray-400 text-sm">ไม่มีข้อมูลในวันนี้</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {records.map((r, i) => (
                <div key={r.employeeId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                        <p className="font-medium text-gray-800 text-sm truncate">{r.name}</p>
                      </div>
                      <div className="mt-1.5 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs text-gray-500">
                          เข้า: {r.checkIn ? <span className={r.isLate ? 'text-yellow-600 font-semibold' : 'text-green-600'}>{formatTime(r.checkIn)}</span> : '-'}
                        </span>
                        <span className="text-xs text-gray-500">
                          ออก: {r.checkOut ? <span className={r.isEarlyLeave ? 'text-orange-600 font-semibold' : ''}>{formatTime(r.checkOut)}</span> : '-'}
                        </span>
                        {r.workHours !== null && <span className="text-xs text-gray-500">{formatHours(r.workHours)}</span>}
                        {r.lateMinutes > 0 && <span className="text-xs text-yellow-600">สาย {formatMinutes(r.lateMinutes)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={r.status as AttendanceStatus} />
                      {hasManage && (
                        <button className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                          onClick={() => setOverrideTarget({ employeeId: r.employeeId, name: r.name, status: r.status })}>
                          ✏️ แก้ไข
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {absentEmployees.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-red-50 flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">ขาดงาน</span>
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{absentEmployees.length}</span>
                  </div>
                  {absentEmployees.map((emp) => (
                    <div key={emp.employeeId} className="p-4 bg-red-50/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-5">—</span>
                          <p className="font-medium text-red-700 text-sm">{emp.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status="absent" />
                          {hasManage && (
                            <button className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                              onClick={() => setOverrideTarget({ employeeId: emp.employeeId, name: emp.name, status: 'absent' })}>
                              ✏️ แก้ไข
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">#</th>
                    {([
                      { key: 'name', label: 'ชื่อ', cls: '' },
                      { key: 'checkIn', label: 'เวลาเข้า', cls: 'text-center' },
                      { key: 'checkOut', label: 'เวลาออก', cls: 'text-center' },
                      { key: 'workHours', label: 'ชั่วโมง', cls: 'text-center' },
                      { key: 'lateMinutes', label: 'สาย', cls: 'text-center' },
                      { key: 'status', label: 'สถานะ', cls: 'text-center' },
                    ] as { key: DailySortKey; label: string; cls: string }[]).map((col) => (
                      <th key={col.key} className={`table-header ${col.cls}`}>
                        <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                          {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                        </button>
                      </th>
                    ))}
                    {hasManage && <th className="table-header text-center">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell text-gray-400">{i + 1}</td>
                      <td className="table-cell font-medium">{r.name}</td>
                      <td className="table-cell text-center font-mono">
                        {r.checkIn ? <span className={r.isLate ? 'text-yellow-600 font-semibold' : 'text-green-600'}>{formatTime(r.checkIn)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell text-center font-mono">
                        {r.checkOut ? <span className={r.isEarlyLeave ? 'text-orange-600 font-semibold' : ''}>{formatTime(r.checkOut)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-cell text-center">{formatHours(r.workHours)}</td>
                      <td className="table-cell text-center">
                        {r.lateMinutes > 0 ? <span className="text-yellow-600 font-medium">{formatMinutes(r.lateMinutes)}</span> : <span className="text-green-500 text-xs">ตรงเวลา</span>}
                      </td>
                      <td className="table-cell text-center"><StatusBadge status={r.status as AttendanceStatus} /></td>
                      {hasManage && (
                        <td className="table-cell text-center">
                          <button className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                            onClick={() => setOverrideTarget({ employeeId: r.employeeId, name: r.name, status: r.status })}>
                            ✏️ แก้ไข
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {absentEmployees.length > 0 && (
                    <tr>
                      <td colSpan={hasManage ? 8 : 7} className="px-4 py-2 bg-red-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">ขาดงาน</span>
                          <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">{absentEmployees.length} คน</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {absentEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="bg-red-50/40 hover:bg-red-50 transition-colors">
                      <td className="table-cell text-gray-400">—</td>
                      <td className="table-cell font-medium text-red-700">{emp.name}</td>
                      <td className="table-cell text-center text-gray-300">—</td>
                      <td className="table-cell text-center text-gray-300">—</td>
                      <td className="table-cell text-center text-gray-300">—</td>
                      <td className="table-cell text-center text-gray-300">—</td>
                      <td className="table-cell text-center"><StatusBadge status="absent" /></td>
                      {hasManage && (
                        <td className="table-cell text-center">
                          <button className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                            onClick={() => setOverrideTarget({ employeeId: emp.employeeId, name: emp.name, status: 'absent' })}>
                            ✏️ แก้ไข
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="modal-backdrop" onClick={() => setShowCalendar(false)}>
          <div
            ref={calendarRef}
            className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevCalendarMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="font-bold text-gray-800">{thaiMonthsFull[calM]} {calY + 543}</span>
              <button onClick={nextCalendarMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {calDays.map((dateStr, i) => {
                if (!dateStr) return <div key={i} />
                const isSelected = dateStr === selectedDate
                const isToday2 = dateStr === today
                const hasRecord = recordedDates.has(dateStr)
                const isFuture = dateStr > today
                const holidayName = holidayDates.get(dateStr)
                const isSunday = new Date(dateStr + 'T00:00:00').getDay() === 0
                const isHoliday = !!holidayName || isSunday
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(dateStr); setShowCalendar(false) }}
                    disabled={isFuture}
                    title={holidayName}
                    className={`relative flex flex-col items-center justify-center h-9 w-full rounded-xl text-sm font-medium transition-colors
                      ${isSelected ? 'bg-blue-500 text-white shadow-md' : ''}
                      ${!isSelected && isHoliday ? 'bg-red-50 text-red-500' : ''}
                      ${!isSelected && !isHoliday && isToday2 ? 'bg-blue-50 text-blue-700 font-bold' : ''}
                      ${!isSelected && !isHoliday && !isToday2 && !isFuture ? 'text-gray-700 hover:bg-gray-100' : ''}
                      ${isFuture && !isHoliday ? 'text-gray-300 cursor-not-allowed' : ''}
                      ${isFuture && isHoliday ? 'text-red-300 cursor-not-allowed' : ''}
                    `}
                  >
                    <span>{Number(dateStr.split('-')[2])}</span>
                    {(hasRecord || isHoliday) && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {hasRecord && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />}
                        {isHoliday && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`} />}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span>มีข้อมูลการสแกน</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                <span>วันหยุด</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {overrideTarget && selectedDate && (
        <StatusOverrideModal
          employeeId={overrideTarget.employeeId}
          employeeName={overrideTarget.name}
          date={selectedDate}
          currentStatus={overrideTarget.status}
          onClose={() => setOverrideTarget(null)}
          onSaved={async () => { await loadAttendance() }}
        />
      )}
    </div>
  )
}
