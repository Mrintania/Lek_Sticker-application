'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getWeeklySummary, getAvailableWeeks, getDailyRecords } from '@/lib/reports'
import { getWeekDateRange, formatThaiDateShort, formatHours, THAI_DAYS_SHORT, THAI_DAYS } from '@/lib/formatters'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { exportWeeklyReport } from '@/lib/exporter'
import { EmployeeProfile } from '@/lib/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type WeeklySortKey = 'name' | 'daysPresent' | 'daysLate' | 'daysAbsent' | 'daysNoCheckout' | 'totalWorkHours' | 'avgWorkHours'

export default function WeeklyPage() {
  const { master, settings, loadAttendance, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()
  const isRegularUser = user?.role === 'user'
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])

  useEffect(() => {
    if (!isLoaded) loadAttendance()
    fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
  }, [isLoaded])

  const weeks = useMemo(() => getAvailableWeeks(master), [master])
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, weeks.length - 1))
  useEffect(() => { setSelectedIdx(Math.max(0, weeks.length - 1)) }, [weeks.length])

  const selected = weeks[selectedIdx]
  const summary = useMemo(() => {
    if (!selected) return []
    return getWeeklySummary(master, selected.year, selected.week, employees, settings)
  }, [master, selected, employees, settings])

  const weekDates = useMemo(() => {
    if (!selected) return []
    return summary[0]?.weekDates ?? []
  }, [summary, selected])

  const statusGrid = useMemo(() => {
    const grid: Record<string, Record<string, string>> = {}
    weekDates.forEach((date) => {
      const dayRecords = getDailyRecords(master, date)
      dayRecords.forEach((r) => {
        if (!grid[r.employeeId]) grid[r.employeeId] = {}
        grid[r.employeeId][date] = r.status
      })
    })
    return grid
  }, [master, weekDates])

  const { sortKey, sortDir, handleSort, sorted } = useSortable<WeeklySortKey>('name')
  const sortedSummary = useMemo(() => sorted(summary, (key, e) => {
    switch (key) {
      case 'name': return e.name
      case 'daysPresent': return e.daysPresent
      case 'daysLate': return e.daysLate
      case 'daysAbsent': return e.daysAbsent
      case 'daysNoCheckout': return e.daysNoCheckout
      case 'totalWorkHours': return e.totalWorkHours
      case 'avgWorkHours': return e.avgWorkHours
    }
  }), [summary, sortKey, sortDir])

  const statusDotClass: Record<string, string> = {
    present: 'bg-green-500',
    late: 'bg-yellow-500',
    earlyLeave: 'bg-orange-500',
    halfDay: 'bg-purple-500',
    noCheckout: 'bg-gray-400',
    absent: 'bg-red-500',
  }

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>

  if (master.length === 0) {
    return (
      <div className="page-container text-center">
        <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
      </div>
    )
  }

  const weekLabel = selected
    ? (() => {
        const { start, end } = getWeekDateRange(selected.year, selected.week)
        return `สัปดาห์ ${selected.week} (${formatThaiDateShort(start)} – ${formatThaiDateShort(end)})`
      })()
    : ''

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">รายงานรายสัปดาห์</h2>
          <p className="text-gray-500 mt-1 text-sm">{weekLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="flex-1 sm:flex-none !w-auto"
          >
            {[...weeks].reverse().map((w, i) => {
              const idx = weeks.length - 1 - i
              const { start } = getWeekDateRange(w.year, w.week)
              return (
                <option key={idx} value={idx}>
                  สัปดาห์ {w.week}/{w.year} ({formatThaiDateShort(start)})
                </option>
              )
            })}
          </select>
          {summary.length > 0 && !isRegularUser && (
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={() => selected && exportWeeklyReport(summary, weekDates, selected.year, selected.week)}
            >
              ⬇️ Export
            </button>
          )}
        </div>
      </div>

      {/* Attendance Grid */}
      {weekDates.length > 0 && summary.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base">ตารางการเข้างาน</h3>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {Object.entries(statusDotClass).map(([s, cls]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
                  {s === 'present' ? 'มา' : s === 'late' ? 'สาย' : s === 'earlyLeave' ? 'ออกก่อน' : s === 'halfDay' ? 'ครึ่งวัน' : s === 'noCheckout' ? 'ไม่ออก' : 'ขาด'}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header min-w-[100px]">ชื่อ</th>
                  {weekDates.map((d) => (
                    <th key={d} className="table-header text-center min-w-[52px]">
                      <div className="text-xs">{THAI_DAYS_SHORT[new Date(d + 'T00:00:00').getDay() === 0 ? 6 : new Date(d + 'T00:00:00').getDay() - 1]}</div>
                      <div className="text-[10px] font-normal text-gray-400">{d.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-xs sm:text-sm">{emp.name}</td>
                    {weekDates.map((d) => {
                      const status = statusGrid[emp.employeeId]?.[d]
                      return (
                        <td key={d} className="table-cell">
                          <div className="flex items-center justify-center">
                            {status ? (
                              <span className={`block w-3 h-3 rounded-full ${statusDotClass[status] ?? 'bg-gray-300'}`} title={status} />
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">สรุปรายบุคคล</h3>
        </div>
        {summary.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูลสำหรับสัปดาห์นี้</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sortedSummary.map((emp) => (
                <div key={emp.employeeId} className="p-4">
                  <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-xs text-gray-600">มา <b className="text-green-600">{emp.daysPresent}</b> วัน</span>
                    {emp.daysLate > 0 && <span className="text-xs text-yellow-600">สาย {emp.daysLate} วัน</span>}
                    {emp.daysAbsent > 0 && <span className="text-xs text-red-600">ขาด {emp.daysAbsent} วัน</span>}
                    <span className="text-xs text-gray-500">{formatHours(emp.totalWorkHours)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  {([
                    { key: 'name', label: 'ชื่อ', cls: '' },
                    { key: 'daysPresent', label: 'มาทำงาน', cls: 'text-center' },
                    { key: 'daysLate', label: 'สาย', cls: 'text-center' },
                    { key: 'daysAbsent', label: 'ขาดงาน', cls: 'text-center' },
                    { key: 'daysNoCheckout', label: 'ไม่มีบันทึกออก', cls: 'text-center' },
                    { key: 'totalWorkHours', label: 'รวมชั่วโมง', cls: 'text-center' },
                    { key: 'avgWorkHours', label: 'เฉลี่ย/วัน', cls: 'text-center' },
                  ] as { key: WeeklySortKey; label: string; cls: string }[]).map((col) => (
                    <th key={col.key} className={`table-header ${col.cls}`}>
                      <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 font-semibold">
                        {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                      </button>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {sortedSummary.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-center">{emp.daysPresent}</td>
                      <td className="table-cell text-center"><span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>{emp.daysLate}</span></td>
                      <td className="table-cell text-center"><span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{emp.daysAbsent}</span></td>
                      <td className="table-cell text-center"><span className={emp.daysNoCheckout > 0 ? 'text-slate-600' : 'text-gray-400'}>{emp.daysNoCheckout}</span></td>
                      <td className="table-cell text-center">{formatHours(emp.totalWorkHours)}</td>
                      <td className="table-cell text-center">{formatHours(emp.avgWorkHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
