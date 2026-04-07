'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getDailyRecords, getAvailableDates } from '@/lib/reports'
import { formatThaiDateFull, formatTime, formatHours, formatMinutes } from '@/lib/formatters'
import StatusBadge from '@/components/shared/StatusBadge'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canManage } from '@/lib/auth'
import StatusOverrideModal from '@/components/attendance/StatusOverrideModal'
import { exportDailyReport } from '@/lib/exporter'
import { AttendanceStatus, EmployeeProfile } from '@/lib/types'

type DailySortKey = 'name' | 'checkIn' | 'checkOut' | 'workHours' | 'lateMinutes' | 'status'

export default function DailyPage() {
  const { master, settings, loadAttendance, loadSettings, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [holidays, setHolidays] = useState<string[]>([])

  useEffect(() => {
    if (!isLoaded) loadAttendance()
    loadSettings()
    fetch('/api/employees').then(r => r.ok ? r.json() : []).then(setEmployees).catch(() => {})
    fetch('/api/holidays').then(r => r.ok ? r.json() : [])
      .then((data: { date: string }[]) => setHolidays(data.map(h => h.date)))
      .catch(() => {})
  }, [isLoaded])

  const dates = useMemo(() => getAvailableDates(master), [master])
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, dates.length - 1))
  useEffect(() => { setSelectedIdx(Math.max(0, dates.length - 1)) }, [dates.length])

  const selectedDate = dates[selectedIdx] ?? ''

  const [overrideTarget, setOverrideTarget] = useState<{ employeeId: string; name: string; status: string } | null>(null)

  const isRegularUser = user?.role === 'user'
  const hasManage = user && canManage(user.role)

  const { sortKey, sortDir, handleSort, sorted } = useSortable<DailySortKey>('name')

  const isWorkingDay = useMemo(() => {
    if (!selectedDate) return false
    if (holidays.includes(selectedDate)) return false
    const jsDay = new Date(selectedDate + 'T00:00:00').getDay()
    const ourDow = jsDay === 0 ? 6 : jsDay - 1
    return settings.workDays.includes(ourDow)
  }, [selectedDate, holidays, settings.workDays])

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

  const isLatest = selectedIdx === dates.length - 1

  if (!isLoaded) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">รายงานรายวัน</h2>
          {selectedDate && (
            <p className="text-gray-500 mt-1 text-sm">{formatThaiDateFull(selectedDate)}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Prev / Next navigator */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-1 py-1">
            <button
              onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
              disabled={selectedIdx === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[90px] text-center px-1">{selectedDate}</span>
            <button
              onClick={() => setSelectedIdx(i => Math.min(dates.length - 1, i + 1))}
              disabled={isLatest}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {!isLatest && (
            <button
              onClick={() => setSelectedIdx(dates.length - 1)}
              className="text-xs px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl font-medium transition-colors border border-blue-200"
            >
              ล่าสุด
            </button>
          )}
          {rawRecords.length > 0 && !isRegularUser && (
            <button className="btn-secondary whitespace-nowrap" onClick={() => exportDailyReport(rawRecords, selectedDate)}>
              ⬇️ Export
            </button>
          )}
        </div>
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
            {/* ── Mobile cards ── */}
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
                        <button
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                          onClick={() => setOverrideTarget({ employeeId: r.employeeId, name: r.name, status: r.status })}
                        >
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
                            <button
                              className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                              onClick={() => setOverrideTarget({ employeeId: emp.employeeId, name: emp.name, status: 'absent' })}
                            >
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

            {/* ── Desktop table ── */}
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
                      <td className="table-cell text-center">
                        <StatusBadge status={r.status as AttendanceStatus} />
                      </td>
                      {hasManage && (
                        <td className="table-cell text-center">
                          <button
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                            onClick={() => setOverrideTarget({ employeeId: r.employeeId, name: r.name, status: r.status })}
                          >
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
                          <button
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                            onClick={() => setOverrideTarget({ employeeId: emp.employeeId, name: emp.name, status: 'absent' })}
                          >
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
