'use client'
import { useEffect, useMemo, useState } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { useRouter } from 'next/navigation'
import { getMonthlySummary, getAvailableMonths } from '@/lib/reports'
import { formatThaiMonthYear } from '@/lib/formatters'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { EmployeeProfile } from '@/lib/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type DashSortKey = 'name' | 'employmentType' | 'daysPresent' | 'daysLate' | 'daysAbsent' | 'attendanceRate'

export default function DashboardPage() {
  const { master, settings, loadAttendance, loadSettings, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()
  const isRegularUser = user?.role === 'user'
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadSettings()
    loadAttendance()
    fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
  }, [])

  const availableMonths = useMemo(() => getAvailableMonths(master), [master])

  // Default to latest month when data loads
  useEffect(() => {
    if (availableMonths.length > 0 && selectedYear === null) {
      const latest = availableMonths[availableMonths.length - 1]
      setSelectedYear(latest.year)
      setSelectedMonth(latest.month)
    }
  }, [availableMonths])

  // Available years from months
  const availableYears = useMemo(() => {
    const years = [...new Set(availableMonths.map(m => m.year))].sort()
    return years
  }, [availableMonths])

  // Months available for selected year
  const monthsForYear = useMemo(() => {
    if (!selectedYear) return []
    return availableMonths.filter(m => m.year === selectedYear)
  }, [availableMonths, selectedYear])

  // When year changes, auto-select latest month in that year
  function handleYearChange(year: number) {
    setSelectedYear(year)
    const months = availableMonths.filter(m => m.year === year)
    if (months.length > 0) {
      setSelectedMonth(months[months.length - 1].month)
    }
  }

  const monthlySummary = useMemo(() => {
    if (!selectedYear || !selectedMonth) return []
    return getMonthlySummary(master, selectedYear, selectedMonth, employees, settings)
  }, [master, selectedYear, selectedMonth, employees, settings])

  const teamStats = useMemo(() => {
    if (!monthlySummary.length) return null
    const total = monthlySummary.length
    const avgAttendance = monthlySummary.reduce((s, e) => s + e.attendanceRate, 0) / total
    const totalLate = monthlySummary.reduce((s, e) => s + e.daysLate, 0)
    const totalAbsent = monthlySummary.reduce((s, e) => s + e.daysAbsent, 0)
    return { avgAttendance, totalLate, totalAbsent, total }
  }, [monthlySummary])

  const { sortKey, sortDir, handleSort, sorted } = useSortable<DashSortKey>('name')
  const sortedSummary = useMemo(() => sorted(monthlySummary, (key, e) => {
    switch (key) {
      case 'name': return e.name
      case 'employmentType': return e.employmentType ?? ''
      case 'daysPresent': return e.daysPresent
      case 'daysLate': return e.daysLate
      case 'daysAbsent': return e.daysAbsent
      case 'attendanceRate': return e.attendanceRate
    }
  }), [monthlySummary, sortKey, sortDir])

  const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  if (!isLoaded) {
    return <div className="p-8 text-center text-gray-400">⏳ กำลังโหลดข้อมูล...</div>
  }

  if (master.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-4xl mb-4">📂</div>
        {isRegularUser ? (
          <p className="text-gray-500">ยังไม่มีข้อมูลของคุณในระบบ</p>
        ) : (
          <>
            <p className="text-gray-500 mb-4">ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน</p>
            <button className="btn-primary" onClick={() => router.push('/settings')}>อัปโหลดไฟล์</button>
          </>
        )}
      </div>
    )
  }

  const chartData = monthlySummary.map((e) => ({
    name: e.name, มาทำงาน: e.daysPresent, ขาดงาน: e.daysAbsent, สาย: e.daysLate,
  }))

  return (
    <div className="p-8 space-y-6">
      {/* Header + Month Selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ภาพรวมการเข้างาน</h2>
          {selectedYear && selectedMonth && (
            <p className="text-gray-500 mt-1">{formatThaiMonthYear(selectedYear, selectedMonth)}</p>
          )}
        </div>

        {/* Month/Year Picker */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
            <span className="text-sm text-gray-500 mr-1">📅 เดือน:</span>
            {/* Month pills */}
            <div className="flex gap-1 flex-wrap">
              {monthsForYear.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedMonth === m.month
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {MONTH_NAMES[m.month - 1]}
                </button>
              ))}
            </div>
            {/* Year selector */}
            {availableYears.length > 1 && (
              <>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <select
                  value={selectedYear ?? ''}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="text-sm border-0 bg-transparent text-gray-700 font-medium cursor-pointer focus:ring-0 pr-6"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {teamStats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card text-center"><p className="text-3xl font-bold text-blue-600">{teamStats.total}</p><p className="text-sm text-gray-500 mt-1">พนักงาน</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-green-600">{teamStats.avgAttendance.toFixed(1)}%</p><p className="text-sm text-gray-500 mt-1">อัตราการมาทำงาน</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-yellow-600">{teamStats.totalLate}</p><p className="text-sm text-gray-500 mt-1">ครั้งที่มาสาย</p></div>
          <div className="card text-center"><p className="text-3xl font-bold text-red-600">{teamStats.totalAbsent}</p><p className="text-sm text-gray-500 mt-1">วันขาดงาน</p></div>
        </div>
      )}

      {chartData.length > 0 ? (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">
            สรุปการเข้างานรายคน
            {selectedYear && selectedMonth && (
              <span className="ml-2 text-sm font-normal text-gray-400">({formatThaiMonthYear(selectedYear, selectedMonth)})</span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="มาทำงาน" fill="#16a34a" radius={[4,4,0,0]} />
              <Bar dataKey="สาย" fill="#d97706" radius={[4,4,0,0]} />
              <Bar dataKey="ขาดงาน" fill="#dc2626" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        selectedYear && selectedMonth && (
          <div className="card text-center py-12">
            <p className="text-gray-400">ไม่มีข้อมูลการเข้างานสำหรับ {formatThaiMonthYear(selectedYear, selectedMonth)}</p>
          </div>
        )
      )}

      {monthlySummary.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">สรุปรายบุคคล</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'name', label: 'ชื่อ', cls: '' },
                  { key: 'employmentType', label: 'ประเภท', cls: 'text-center' },
                  { key: 'daysPresent', label: 'มาทำงาน', cls: 'text-center' },
                  { key: 'daysLate', label: 'สาย', cls: 'text-center' },
                  { key: 'daysAbsent', label: 'ขาดงาน', cls: 'text-center' },
                  { key: 'attendanceRate', label: 'อัตรา%', cls: 'text-center' },
                ] as { key: DashSortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header ${col.cls}`}>
                    <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                      {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {sortedSummary.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{emp.name}</td>
                    <td className="table-cell text-center">
                      {emp.employmentType === 'daily' ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">รายวัน</span>
                       : emp.employmentType === 'monthly' ? <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">รายเดือน</span>
                       : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="table-cell text-center">{emp.daysPresent}</td>
                    <td className="table-cell text-center"><span className={emp.daysLate > 0 ? 'text-yellow-600 font-medium' : 'text-gray-400'}>{emp.daysLate}</span></td>
                    <td className="table-cell text-center"><span className={emp.daysAbsent > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{emp.daysAbsent}</span></td>
                    <td className="table-cell text-center"><span className={`font-medium ${emp.attendanceRate >= 90 ? 'text-green-600' : emp.attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>{emp.attendanceRate.toFixed(1)}%</span></td>
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
