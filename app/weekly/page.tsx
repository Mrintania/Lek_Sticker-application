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

  if (!isLoaded) return <div className="p-8 text-center text-gray-400">⏳ กำลังโหลด...</div>

  if (master.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
      </div>
    )
  }

  const weekLabel = selected
    ? (() => {
        const { start, end } = getWeekDateRange(selected.year, selected.week)
        return `สัปดาห์ที่ ${selected.week} (${formatThaiDateShort(start)} - ${formatThaiDateShort(end)})`
      })()
    : ''

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">รายงานรายสัปดาห์</h2>
          <p className="text-gray-500 mt-1">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">เลือกสัปดาห์:</label>
          <select value={selectedIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))}>
            {[...weeks].reverse().map((w, i) => {
              const idx = weeks.length - 1 - i
              const { start, end } = getWeekDateRange(w.year, w.week)
              return (
                <option key={idx} value={idx}>
                  สัปดาห์ {w.week}/{w.year} ({formatThaiDateShort(start)})
                </option>
              )
            })}
          </select>
          {summary.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => selected && exportWeeklyReport(summary, weekDates, selected.year, selected.week)}
            >
              ⬇️ Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Attendance Grid */}
      {weekDates.length > 0 && summary.length > 0 && (
        <div className="card overflow-x-auto">
          <h3 className="font-semibold text-gray-800 mb-4">ตารางการเข้างาน</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header min-w-[120px]">ชื่อ</th>
                {weekDates.map((d) => (
                  <th key={d} className="table-header text-center min-w-[80px]">
                    <div>{THAI_DAYS[new Date(d + 'T00:00:00').getDay() === 0 ? 6 : new Date(d + 'T00:00:00').getDay() - 1]}</div>
                    <div className="text-xs font-normal text-gray-400">{d.slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map((emp) => (
                <tr key={emp.employeeId} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{emp.name}</td>
                  {weekDates.map((d) => {
                    const status = statusGrid[emp.employeeId]?.[d]
                    return (
                      <td key={d} className="table-cell">
                        <div className="flex items-center justify-center">
                          {status ? (
                            <span
                              className={`block w-3 h-3 rounded-full ${statusDotClass[status] ?? 'bg-gray-300'}`}
                              title={status}
                            />
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 mt-4 text-xs text-gray-500">
            {Object.entries(statusDotClass).map(([s, cls]) => (
              <span key={s} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />
                {s === 'present' ? 'มา' : s === 'late' ? 'สาย' : s === 'earlyLeave' ? 'ออกก่อน' : s === 'halfDay' ? 'ครึ่งวัน' : s === 'noCheckout' ? 'ไม่มีบันทึกออก' : 'ขาด'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary Table */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">สรุปรายบุคคล</h3>
        {summary.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลสำหรับสัปดาห์นี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
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
                      <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                        {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSummary.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{emp.name}</td>
                    <td className="table-cell text-center">{emp.daysPresent}</td>
                    <td className="table-cell text-center">
                      <span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>{emp.daysLate}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{emp.daysAbsent}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={emp.daysNoCheckout > 0 ? 'text-slate-600' : 'text-gray-400'}>{emp.daysNoCheckout}</span>
                    </td>
                    <td className="table-cell text-center">{formatHours(emp.totalWorkHours)}</td>
                    <td className="table-cell text-center">{formatHours(emp.avgWorkHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
