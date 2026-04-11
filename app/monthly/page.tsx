'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getMonthlySummary, getAvailableMonths } from '@/lib/reports'
import { formatThaiMonthYear, formatHours, formatMinutes, formatCurrency } from '@/lib/formatters'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { exportMonthlyReport } from '@/lib/exporter'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmployeeProfile } from '@/lib/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type MonthlySortKey = 'name' | 'employmentType' | 'workingDaysInMonth' | 'daysPresent' | 'daysLate' | 'daysAbsent' | 'totalWorkHours' | 'attendanceRate' | 'punctualityRate' | 'estimatedPay'
type LateSortKey = 'name' | 'daysLate' | 'totalLateMinutes' | 'avgLate'

export default function MonthlyPage() {
  const { master, settings, loadAttendance, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()
  const isRegularUser = user?.role === 'user'
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])

  useEffect(() => {
    if (!isLoaded) loadAttendance()
    fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
  }, [isLoaded])

  const months = useMemo(() => getAvailableMonths(master), [master])
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, months.length - 1))
  useEffect(() => { setSelectedIdx(Math.max(0, months.length - 1)) }, [months.length])

  const selected = months[selectedIdx]
  const isLatest = selectedIdx === months.length - 1

  const summary = useMemo(() => {
    if (!selected) return []
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const isCurrentMonth = selected.year === today.getFullYear() && selected.month === today.getMonth() + 1
    const cutoff = isCurrentMonth ? todayStr : undefined
    return getMonthlySummary(master, selected.year, selected.month, employees, settings, cutoff)
  }, [master, selected, employees, settings])

  const { sortKey: mSortKey, sortDir: mSortDir, handleSort: mHandleSort, sorted: mSorted } = useSortable<MonthlySortKey>('name')
  const sortedSummary = useMemo(() => mSorted(summary, (key, e) => {
    switch (key) {
      case 'name': return e.name
      case 'employmentType': return e.employmentType ?? ''
      case 'workingDaysInMonth': return e.workingDaysInMonth
      case 'daysPresent': return e.daysPresent
      case 'daysLate': return e.daysLate
      case 'daysAbsent': return e.daysAbsent
      case 'totalWorkHours': return e.totalWorkHours
      case 'attendanceRate': return e.attendanceRate
      case 'punctualityRate': return e.punctualityRate
      case 'estimatedPay': return e.estimatedPay ?? -1
    }
  }), [summary, mSortKey, mSortDir])

  const { sortKey: lSortKey, sortDir: lSortDir, handleSort: lHandleSort, sorted: lSorted } = useSortable<LateSortKey>('totalLateMinutes', 'desc')
  const sortedLate = useMemo(() => lSorted(
    summary.filter(e => e.totalLateMinutes > 0),
    (key, e) => {
      switch (key) {
        case 'name': return e.name
        case 'daysLate': return e.daysLate
        case 'totalLateMinutes': return e.totalLateMinutes
        case 'avgLate': return e.daysLate > 0 ? e.totalLateMinutes / e.daysLate : 0
      }
    }
  ), [summary, lSortKey, lSortDir])

  const teamStats = useMemo(() => {
    if (!summary.length) return null
    const total = summary.length
    const avgRate = summary.reduce((s, e) => s + e.attendanceRate, 0) / total
    const totalLate = summary.reduce((s, e) => s + e.daysLate, 0)
    const totalAbsent = summary.reduce((s, e) => s + e.daysAbsent, 0)
    const totalHours = summary.reduce((s, e) => s + e.totalWorkHours, 0)
    return { total, avgRate, totalLate, totalAbsent, totalHours }
  }, [summary])

  const hasPayData = summary.some(e => e.estimatedPay !== undefined)

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>
  if (master.length === 0) return (
    <div className="page-container text-center">
      <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
    </div>
  )

  const chartData = summary.map(e => ({ name: e.name, 'ชม.ทำงาน': e.totalWorkHours }))

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">รายงานรายเดือน</h2>
          {selected && <p className="text-gray-500 mt-1 text-sm">{formatThaiMonthYear(selected.year, selected.month)}</p>}
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
            <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center px-1">
              {selected ? formatThaiMonthYear(selected.year, selected.month) : '—'}
            </span>
            <button
              onClick={() => setSelectedIdx(i => Math.min(months.length - 1, i + 1))}
              disabled={isLatest}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {!isLatest && (
            <button
              onClick={() => setSelectedIdx(months.length - 1)}
              className="text-xs px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-medium transition-colors border border-blue-200"
            >
              ล่าสุด
            </button>
          )}
          {summary.length > 0 && !isRegularUser && (
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={() => selected && exportMonthlyReport(summary, selected.year, selected.month)}
            >
              ⬇️ Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {teamStats && !isRegularUser && (
        <div className="stats-grid">
          {[
            { label: 'พนักงานทั้งหมด', value: teamStats.total, suffix: 'คน', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: '👥' },
            { label: 'อัตราการมาเฉลี่ย', value: `${teamStats.avgRate.toFixed(1)}%`, suffix: '', color: teamStats.avgRate >= 90 ? 'text-green-600' : teamStats.avgRate >= 75 ? 'text-yellow-600' : 'text-red-600', bg: 'bg-green-50', border: 'border-green-100', icon: '📊' },
            { label: 'ครั้งที่มาสาย', value: teamStats.totalLate, suffix: 'ครั้ง', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', icon: '⏰' },
            { label: 'วันขาดงานรวม', value: teamStats.totalAbsent, suffix: 'วัน', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', icon: '❌' },
          ].map((s) => (
            <div key={s.label} className={`stat-card ${s.bg} border ${s.border}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">{s.label}</p>
                <span className="text-base">{s.icon}</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.value}</p>
              {s.suffix && <p className="text-xs text-gray-400 mt-1">{s.suffix}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Hours chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">ชั่วโมงทำงานรวม</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 8, bottom: 24, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="ชม.ทำงาน" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">สรุปรายบุคคล</h3>
        </div>
        {summary.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-gray-400 text-sm">ไม่มีข้อมูลสำหรับเดือนนี้</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sortedSummary.map((emp) => (
                <div key={emp.employeeId} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                      <div className="mt-0.5">
                        {emp.employmentType === 'daily'
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">รายวัน</span>
                          : emp.employmentType === 'monthly'
                          ? <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">รายเดือน</span>
                          : null}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-bold ${emp.attendanceRate >= 90 ? 'text-green-600' : emp.attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {emp.attendanceRate.toFixed(0)}%
                      </span>
                      {hasPayData && emp.estimatedPay !== undefined && (
                        <p className="text-xs text-blue-700 font-medium mt-0.5">{formatCurrency(emp.estimatedPay)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">วันทำงาน {emp.workingDaysInMonth}</span>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">มา {emp.daysPresent}</span>
                    {emp.daysLate > 0 && <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">สาย {emp.daysLate}</span>}
                    {emp.daysAbsent > 0 && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">ขาด {emp.daysAbsent}</span>}
                    <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{formatHours(emp.totalWorkHours)}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {([
                      { key: 'name', label: 'ชื่อ', cls: '' },
                      { key: 'employmentType', label: 'ประเภท', cls: 'text-center' },
                      { key: 'workingDaysInMonth', label: 'วันทำงาน', cls: 'text-center' },
                      { key: 'daysPresent', label: 'มาทำงาน', cls: 'text-center' },
                      { key: 'daysLate', label: 'สาย', cls: 'text-center' },
                      { key: 'daysAbsent', label: 'ขาดงาน', cls: 'text-center' },
                      { key: 'totalWorkHours', label: 'รวมชม.', cls: 'text-center' },
                      { key: 'attendanceRate', label: 'มาทำงาน%', cls: 'text-center' },
                      { key: 'punctualityRate', label: 'ตรงเวลา%', cls: 'text-center' },
                      ...(hasPayData ? [{ key: 'estimatedPay' as MonthlySortKey, label: 'ค่าจ้างประมาณ', cls: 'text-center' }] : []),
                    ] as { key: MonthlySortKey; label: string; cls: string }[]).map((col) => (
                      <th key={col.key} className={`table-header ${col.cls}`}>
                        <button onClick={() => mHandleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                          {col.label}<SortIcon active={mSortKey === col.key} dir={mSortDir} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-center">
                        {emp.employmentType === 'daily' ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">รายวัน</span>
                        ) : emp.employmentType === 'monthly' ? (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">รายเดือน</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="table-cell text-center text-gray-500">{emp.workingDaysInMonth}</td>
                      <td className="table-cell text-center font-medium text-green-600">{emp.daysPresent}</td>
                      <td className="table-cell text-center">
                        <span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-300'}>{emp.daysLate > 0 ? emp.daysLate : '—'}</span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-300'}>{emp.daysAbsent > 0 ? emp.daysAbsent : '—'}</span>
                      </td>
                      <td className="table-cell text-center">{formatHours(emp.totalWorkHours)}</td>
                      <td className="table-cell text-center">
                        <span className={`font-medium ${emp.attendanceRate >= 90 ? 'text-green-600' : emp.attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {emp.attendanceRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`font-medium ${emp.punctualityRate >= 90 ? 'text-green-600' : emp.punctualityRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {emp.punctualityRate.toFixed(1)}%
                        </span>
                      </td>
                      {hasPayData && (
                        <td className="table-cell text-center font-medium text-blue-700">
                          {emp.estimatedPay !== undefined ? formatCurrency(emp.estimatedPay) : '—'}
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

      {/* Late detail */}
      {sortedLate.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base">รายละเอียดการมาสาย</h3>
            <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">{sortedLate.length} คน</span>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {sortedLate.map((emp) => (
              <div key={emp.employeeId} className="p-4 flex items-center justify-between gap-3">
                <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                <div className="text-right">
                  <p className="text-sm font-medium text-yellow-600">{emp.daysLate} วัน · {formatMinutes(emp.totalLateMinutes)}</p>
                  <p className="text-xs text-gray-400">เฉลี่ย {emp.daysLate > 0 ? formatMinutes(Math.round(emp.totalLateMinutes / emp.daysLate)) : '—'}/วัน</p>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {([
                    { key: 'name', label: 'ชื่อ', cls: '' },
                    { key: 'daysLate', label: 'จำนวนวันที่สาย', cls: 'text-center' },
                    { key: 'totalLateMinutes', label: 'รวมเวลาสาย', cls: 'text-center' },
                    { key: 'avgLate', label: 'เฉลี่ยสาย/วัน', cls: 'text-center' },
                  ] as { key: LateSortKey; label: string; cls: string }[]).map((col) => (
                    <th key={col.key} className={`table-header ${col.cls}`}>
                      <button onClick={() => lHandleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                        {col.label}<SortIcon active={lSortKey === col.key} dir={lSortDir} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedLate.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{emp.name}</td>
                    <td className="table-cell text-center text-yellow-600 font-medium">{emp.daysLate} วัน</td>
                    <td className="table-cell text-center text-yellow-600">{formatMinutes(emp.totalLateMinutes)}</td>
                    <td className="table-cell text-center text-gray-500">
                      {emp.daysLate > 0 ? formatMinutes(Math.round(emp.totalLateMinutes / emp.daysLate)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
