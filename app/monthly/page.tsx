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
  const summary = useMemo(() => {
    if (!selected) return []
    return getMonthlySummary(master, selected.year, selected.month, employees, settings)
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
    summary.filter((e) => e.totalLateMinutes > 0),
    (key, e) => {
      switch (key) {
        case 'name': return e.name
        case 'daysLate': return e.daysLate
        case 'totalLateMinutes': return e.totalLateMinutes
        case 'avgLate': return e.daysLate > 0 ? e.totalLateMinutes / e.daysLate : 0
      }
    }
  ), [summary, lSortKey, lSortDir])

  if (!isLoaded) return <div className="p-8 text-center text-gray-400">⏳ กำลังโหลด...</div>

  if (master.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
      </div>
    )
  }

  const chartData = summary.map((e) => ({
    name: e.name,
    'ชม.ทำงาน': e.totalWorkHours,
  }))

  const hasPayData = summary.some((e) => e.estimatedPay !== undefined)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">รายงานรายเดือน</h2>
          {selected && <p className="text-gray-500 mt-1">{formatThaiMonthYear(selected.year, selected.month)}</p>}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">เลือกเดือน:</label>
          <select value={selectedIdx} onChange={(e) => setSelectedIdx(Number(e.target.value))}>
            {[...months].reverse().map((m, i) => {
              const idx = months.length - 1 - i
              return (
                <option key={idx} value={idx}>
                  {formatThaiMonthYear(m.year, m.month)}
                </option>
              )
            })}
          </select>
          {summary.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => selected && exportMonthlyReport(summary, selected.year, selected.month)}
            >
              ⬇️ Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Hours chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">ชั่วโมงทำงานรวม (ชม.)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="ชม.ทำงาน" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Table */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">สรุปรายบุคคล</h3>
        {summary.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลสำหรับเดือนนี้</p>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{emp.name}</td>
                    <td className="table-cell text-center">
                      {emp.employmentType === 'daily' ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">รายวัน</span>
                      ) : emp.employmentType === 'monthly' ? (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">รายเดือน</span>
                      ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="table-cell text-center text-gray-500">{emp.workingDaysInMonth}</td>
                    <td className="table-cell text-center font-medium">{emp.daysPresent}</td>
                    <td className="table-cell text-center">
                      <span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>{emp.daysLate}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{emp.daysAbsent}</span>
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
                        {emp.estimatedPay !== undefined ? formatCurrency(emp.estimatedPay) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Late detail */}
      {summary.some((e) => e.totalLateMinutes > 0) && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">รายละเอียดการมาสาย</h3>
          <div className="overflow-x-auto">
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
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-center text-yellow-600 font-medium">{emp.daysLate} วัน</td>
                      <td className="table-cell text-center text-yellow-600">{formatMinutes(emp.totalLateMinutes)}</td>
                      <td className="table-cell text-center text-gray-500">
                        {emp.daysLate > 0 ? formatMinutes(Math.round(emp.totalLateMinutes / emp.daysLate)) : '-'}
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
