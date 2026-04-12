'use client'
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getEmployeeRecords, getMonthlySummary, getAvailableMonths } from '@/lib/reports'
import { formatThaiDateShort, formatTime, formatHours, formatMinutes, formatThaiMonthYear } from '@/lib/formatters'
import StatusBadge from '@/components/shared/StatusBadge'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { exportEmployeeReport } from '@/lib/exporter'
import { EmployeeProfile } from '@/lib/types'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type EmpSortKey = 'date' | 'checkIn' | 'checkOut' | 'workHours' | 'lateMinutes' | 'status'

export default function EmployeePage() {
  const { master, settings, loadAttendance, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()
  const isRegularUser = user?.role === 'user'
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isLoaded) loadAttendance()
    fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
  }, [isLoaded])

  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>()
    master.forEach((r) => map.set(r.employeeId, r.name))
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [master])

  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => searchParams.get('empId') ?? '')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => searchParams.get('month') ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set())

  function handleMonthSelect(ym: string) {
    setSelectedMonth(ym)
    if (!ym) {
      setStartDate('')
      setEndDate('')
    } else {
      const [y, m] = ym.split('-').map(Number)
      const last = new Date(y, m, 0).getDate()
      setStartDate(`${ym}-01`)
      setEndDate(`${ym}-${String(last).padStart(2, '0')}`)
    }
  }

  function handleDateChange(type: 'start' | 'end', val: string) {
    setSelectedMonth('') // clear month shortcut เมื่อแก้วันที่เอง
    if (type === 'start') setStartDate(val)
    else setEndDate(val)
  }

  // Init date range from URL param month
  useEffect(() => {
    const m = searchParams.get('month')
    if (m) handleMonthSelect(m)
  }, [])

  // Fetch holidays for selected month
  useEffect(() => {
    if (!startDate) return
    const y = startDate.slice(0, 4)
    fetch(`/api/holidays?year=${y}`)
      .then(r => r.json())
      .then((data: { date: string; is_active: number }[]) => {
        const s = new Set(data.filter(h => h.is_active).map(h => h.date))
        setHolidayDates(s)
      })
      .catch(() => {})
  }, [startDate?.slice(0, 7)])

  // Auto-select first employee when data loads
  useEffect(() => {
    if (!selectedEmpId && uniqueEmployees.length > 0) {
      setSelectedEmpId(uniqueEmployees[0][0])
    }
  }, [uniqueEmployees, selectedEmpId])

  const records = useMemo(
    () => getEmployeeRecords(master, selectedEmpId, startDate || undefined, endDate || undefined),
    [master, selectedEmpId, startDate, endDate]
  )

  const months = useMemo(() => getAvailableMonths(master), [master])

  const monthlyTrend = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return months.map((m) => {
      const isCurrentMonth = m.year === today.getFullYear() && m.month === today.getMonth() + 1
      const cutoff = isCurrentMonth ? todayStr : undefined
      const summary = getMonthlySummary(master, m.year, m.month, employees, settings, cutoff)
      const emp = summary.find((s) => s.employeeId === selectedEmpId)
      return {
        label: formatThaiMonthYear(m.year, m.month),
        มาทำงาน: emp?.daysPresent ?? 0,
        ชม: emp?.totalWorkHours ?? 0,
        'อัตรา%': emp?.attendanceRate ?? 0,
      }
    })
  }, [months, master, employees, settings, selectedEmpId])

  const kpis = useMemo(() => {
    if (!records.length) return null
    const present = records.filter((r) => ['present', 'late', 'earlyLeave', 'halfDay', 'noCheckout'].includes(r.status)).length
    const late = records.filter((r) => r.isLate).length
    const hours = records.reduce((s, r) => s + (r.workHours ?? 0), 0)
    const totalLate = records.reduce((s, r) => s + r.lateMinutes, 0)
    return {
      attendanceRate: (present / records.length) * 100,
      punctualityRate: present > 0 ? ((present - late) / present) * 100 : 100,
      avgHours: present > 0 ? hours / present : 0,
      totalLate,
    }
  }, [records])

  const absentRows = useMemo(() => {
    if (!startDate || !endDate || !settings) return []
    const absent: { date: string }[] = []
    const presentDates = new Set(records.map(r => r.date))
    const cur = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const today = new Date()
    while (cur <= end && cur <= today) {
      const dow = cur.getDay()
      const ourDow = dow === 0 ? 6 : dow - 1
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`
      if (settings.workDays.includes(ourDow) && !holidayDates.has(dateStr) && !presentDates.has(dateStr)) {
        absent.push({ date: dateStr })
      }
      cur.setDate(cur.getDate() + 1)
    }
    return absent
  }, [records, startDate, endDate, settings, holidayDates])

  const { sortKey, sortDir, handleSort, sorted } = useSortable<EmpSortKey>('date', 'desc')
  const sortedRecords = useMemo(() => sorted(records, (key, r) => {
    switch (key) {
      case 'date': return r.date
      case 'checkIn': return r.checkIn ? r.checkIn.getTime() : -1
      case 'checkOut': return r.checkOut ? r.checkOut.getTime() : -1
      case 'workHours': return r.workHours ?? -1
      case 'lateMinutes': return r.lateMinutes
      case 'status': return r.status
    }
  }), [records, sortKey, sortDir])

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>

  if (master.length === 0) {
    return (
      <div className="page-container text-center">
        <p className="text-gray-400 py-8">{isRegularUser ? 'ยังไม่มีข้อมูลของคุณในระบบ' : 'ยังไม่มีข้อมูลการสแกน กรุณาอัปโหลดไฟล์ก่อน'}</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">ข้อมูลพนักงานรายคน</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isRegularUser && (
            <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="!w-auto flex-1 sm:flex-none">
              {uniqueEmployees.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}

          {/* Month shortcut */}
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthSelect(e.target.value)}
            className="!w-auto flex-1 sm:flex-none"
          >
            <option value="">ทุกเดือน</option>
            {months.map((m) => {
              const ym = `${m.year}-${String(m.month).padStart(2, '0')}`
              return (
                <option key={ym} value={ym}>
                  {formatThaiMonthYear(m.year, m.month)}
                </option>
              )
            })}
          </select>

          {/* Manual date range */}
          <input type="date" value={startDate} onChange={(e) => handleDateChange('start', e.target.value)} className="!w-auto flex-1 sm:flex-none" />
          <span className="text-gray-400 text-sm">ถึง</span>
          <input type="date" value={endDate} onChange={(e) => handleDateChange('end', e.target.value)} className="!w-auto flex-1 sm:flex-none" />

          {(startDate || endDate) && (
            <button
              onClick={() => { setSelectedMonth(''); setStartDate(''); setEndDate('') }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
              title="ล้างตัวกรอง"
            >✕</button>
          )}

          {records.length > 0 && !isRegularUser && (
            <button className="btn-secondary whitespace-nowrap" onClick={() => exportEmployeeReport(records, selectedEmpId, master.find(r => r.employeeId === selectedEmpId)?.name ?? '')}>
              ⬇️ Export Excel
            </button>
          )}
        </div>
      </div>

      {kpis && (
        <div className="stats-grid">
          <div className="stat-card">
            <p className={`text-2xl sm:text-3xl font-bold ${kpis.attendanceRate >= 90 ? 'text-green-600' : kpis.attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              {kpis.attendanceRate.toFixed(1)}%
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">อัตราการมาทำงาน</p>
          </div>
          <div className="stat-card">
            <p className={`text-2xl sm:text-3xl font-bold ${kpis.punctualityRate >= 90 ? 'text-green-600' : kpis.punctualityRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              {kpis.punctualityRate.toFixed(1)}%
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">อัตราตรงเวลา</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl sm:text-3xl font-bold text-blue-600">{formatHours(kpis.avgHours)}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">เฉลี่ยชม.ต่อวัน</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{formatMinutes(kpis.totalLate)}</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">รวมเวลาสาย</p>
          </div>
        </div>
      )}

      {monthlyTrend.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">แนวโน้มการมาทำงาน (อัตรา%)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyTrend} margin={{ top: 0, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="อัตรา%" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base">ประวัติการเข้างาน ({records.length + absentRows.length} วัน)</h3>
        </div>
        {records.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูลสำหรับพนักงานคนนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {([
                    { key: 'date', label: 'วันที่', cls: '' },
                    { key: 'checkIn', label: 'เวลาเข้า', cls: 'text-center' },
                    { key: 'checkOut', label: 'เวลาออก', cls: 'text-center' },
                    { key: 'workHours', label: 'ชั่วโมงทำงาน', cls: 'text-center' },
                    { key: 'lateMinutes', label: 'สาย', cls: 'text-center' },
                    { key: 'status', label: 'สถานะ', cls: 'text-center' },
                  ] as { key: EmpSortKey; label: string; cls: string }[]).map((col) => (
                    <th key={col.key} className={`table-header ${col.cls}`}>
                      <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                        {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((r) => (
                  <tr key={r.date} className="hover:bg-gray-50">
                    <td className="table-cell">{formatThaiDateShort(r.date)}</td>
                    <td className="table-cell text-center font-mono">
                      {r.checkIn ? (
                        <span className={r.isLate ? 'text-yellow-600 font-semibold' : 'text-green-600'}>
                          {formatTime(r.checkIn)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="table-cell text-center font-mono">
                      {r.checkOut ? formatTime(r.checkOut) : '-'}
                    </td>
                    <td className="table-cell text-center">{formatHours(r.workHours)}</td>
                    <td className="table-cell text-center">
                      {r.lateMinutes > 0 ? (
                        <span className="text-yellow-600 text-sm">{formatMinutes(r.lateMinutes)}</span>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="table-cell text-center">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {absentRows.map((r) => (
                  <tr key={`absent-${r.date}`} className="hover:bg-red-50/40 bg-red-50/20">
                    <td className="table-cell text-red-700">{formatThaiDateShort(r.date)}</td>
                    <td className="table-cell text-center text-gray-300">—</td>
                    <td className="table-cell text-center text-gray-300">—</td>
                    <td className="table-cell text-center text-gray-300">—</td>
                    <td className="table-cell text-center text-gray-300">—</td>
                    <td className="table-cell text-center"><StatusBadge status="absent" /></td>
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
