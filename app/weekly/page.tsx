'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getWeeklySummary, getAvailableWeeks, getDailyRecords } from '@/lib/reports'
import { getWeekDateRange, formatThaiDateShort, formatHours, THAI_DAYS_SHORT } from '@/lib/formatters'
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
  const isLatest = selectedIdx === weeks.length - 1

  const summary = useMemo(() => {
    if (!selected) return []
    return getWeeklySummary(master, selected.year, selected.week, employees, settings)
  }, [master, selected, employees, settings])

  const weekDates = useMemo(() => summary[0]?.weekDates ?? [], [summary])

  const statusGrid = useMemo(() => {
    const grid: Record<string, Record<string, string>> = {}
    weekDates.forEach((date) => {
      getDailyRecords(master, date).forEach((r) => {
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

  const statusLabel: Record<string, string> = {
    present: 'มา', late: 'สาย', earlyLeave: 'ออกก่อน',
    halfDay: 'ครึ่งวัน', noCheckout: 'ไม่ออก', absent: 'ขาด',
  }

  const weekLabel = selected
    ? (() => {
        const { start, end } = getWeekDateRange(selected.year, selected.week)
        return `${formatThaiDateShort(start)} – ${formatThaiDateShort(end)}`
      })()
    : ''

  const teamStats = useMemo(() => {
    if (!summary.length) return null
    return {
      total: summary.length,
      present: summary.reduce((s, e) => s + e.daysPresent, 0),
      late: summary.reduce((s, e) => s + e.daysLate, 0),
      absent: summary.reduce((s, e) => s + e.daysAbsent, 0),
    }
  }, [summary])

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>
  if (master.length === 0) return (
    <div className="page-container text-center">
      <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
    </div>
  )

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">รายงานรายสัปดาห์</h2>
          {selected && <p className="text-gray-500 mt-1 text-sm">สัปดาห์ที่ {selected.week} · {weekLabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-1 py-1">
            <button
              onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
              disabled={selectedIdx === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[80px] text-center px-1">
              {selected ? `สัปดาห์ ${selected.week}` : '—'}
            </span>
            <button
              onClick={() => setSelectedIdx(i => Math.min(weeks.length - 1, i + 1))}
              disabled={isLatest}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {!isLatest && (
            <button
              onClick={() => setSelectedIdx(weeks.length - 1)}
              className="text-xs px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-medium transition-colors border border-blue-200"
            >
              ล่าสุด
            </button>
          )}
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

      {/* Stats */}
      {teamStats && !isRegularUser && (
        <div className="stats-grid">
          {[
            { label: 'พนักงาน', value: teamStats.total, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: '👥' },
            { label: 'วัน-มาทำงาน', value: teamStats.present, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', icon: '✅' },
            { label: 'ครั้งที่สาย', value: teamStats.late, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', icon: '⏰' },
            { label: 'วัน-ขาดงาน', value: teamStats.absent, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: '❌' },
          ].map((s) => (
            <div key={s.label} className={`stat-card ${s.bg} border ${s.border}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">{s.label}</p>
                <span className="text-base">{s.icon}</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Grid */}
      {weekDates.length > 0 && summary.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base">ตารางการเข้างาน</h3>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              {Object.entries(statusDotClass).map(([s, cls]) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
                  {statusLabel[s]}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header min-w-[100px]">ชื่อ</th>
                  {weekDates.map((d) => {
                    const dow = new Date(d + 'T00:00:00').getDay()
                    const dayIdx = dow === 0 ? 6 : dow - 1
                    return (
                      <th key={d} className="table-header text-center min-w-[52px]">
                        <div className="text-xs font-semibold">{THAI_DAYS_SHORT[dayIdx]}</div>
                        <div className="text-[10px] font-normal text-gray-400">{d.slice(5)}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {summary.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium text-xs sm:text-sm">{emp.name}</td>
                    {weekDates.map((d) => {
                      const status = statusGrid[emp.employeeId]?.[d]
                      return (
                        <td key={d} className="table-cell">
                          <div className="flex items-center justify-center">
                            {status ? (
                              <span
                                className={`block w-3 h-3 rounded-full ${statusDotClass[status] ?? 'bg-gray-300'}`}
                                title={statusLabel[status] ?? status}
                              />
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
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-gray-400 text-sm">ไม่มีข้อมูลสำหรับสัปดาห์นี้</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sortedSummary.map((emp) => (
                <div key={emp.employeeId} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                    <span className="text-xs text-gray-500">{formatHours(emp.totalWorkHours)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">มา {emp.daysPresent} วัน</span>
                    {emp.daysLate > 0 && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">สาย {emp.daysLate} วัน</span>}
                    {emp.daysAbsent > 0 && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">ขาด {emp.daysAbsent} วัน</span>}
                    {emp.daysNoCheckout > 0 && <span className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full">ไม่ออก {emp.daysNoCheckout}</span>}
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
                    <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-center font-medium text-green-600">{emp.daysPresent}</td>
                      <td className="table-cell text-center"><span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-300'}>{ emp.daysLate > 0 ? emp.daysLate : '—'}</span></td>
                      <td className="table-cell text-center"><span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-300'}>{emp.daysAbsent > 0 ? emp.daysAbsent : '—'}</span></td>
                      <td className="table-cell text-center"><span className={emp.daysNoCheckout > 0 ? 'text-slate-600 font-medium' : 'text-gray-300'}>{emp.daysNoCheckout > 0 ? emp.daysNoCheckout : '—'}</span></td>
                      <td className="table-cell text-center">{formatHours(emp.totalWorkHours)}</td>
                      <td className="table-cell text-center text-gray-500">{formatHours(emp.avgWorkHours)}</td>
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
