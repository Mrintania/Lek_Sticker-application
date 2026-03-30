'use client'
import { useState, useMemo, useEffect } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { getDailyRecords, getAvailableDates } from '@/lib/reports'
import { formatThaiDateShort, formatTime, formatHours, formatMinutes } from '@/lib/formatters'
import StatusBadge from '@/components/shared/StatusBadge'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { canManage } from '@/lib/auth'
import StatusOverrideModal from '@/components/attendance/StatusOverrideModal'
import { exportDailyReport } from '@/lib/exporter'
import { AttendanceStatus } from '@/lib/types'

type DailySortKey = 'name' | 'checkIn' | 'checkOut' | 'workHours' | 'lateMinutes' | 'status'

export default function DailyPage() {
  const { master, loadAttendance, isLoaded } = useAttendanceStore()
  const { user } = useCurrentUser()

  useEffect(() => { if (!isLoaded) loadAttendance() }, [isLoaded])

  const dates = useMemo(() => getAvailableDates(master), [master])
  const [selectedDate, setSelectedDate] = useState<string>(() => dates[dates.length - 1] ?? '')
  useEffect(() => { if (!selectedDate && dates.length) setSelectedDate(dates[dates.length - 1]) }, [dates])

  const [overrideTarget, setOverrideTarget] = useState<{ employeeId: string; name: string; status: string } | null>(null)

  const isRegularUser = user?.role === 'user'

  const { sortKey, sortDir, handleSort, sorted } = useSortable<DailySortKey>('name')
  const rawRecords = useMemo(() => {
    const all = getDailyRecords(master, selectedDate)
    // Regular users: only see their own record
    if (isRegularUser && user?.employeeId) {
      return all.filter((r) => r.employeeId === user.employeeId)
    }
    return all
  }, [master, selectedDate, isRegularUser, user?.employeeId])
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
    present: rawRecords.filter((r) => !['absent'].includes(r.status)).length,
    late: rawRecords.filter((r) => r.isLate).length,
    absent: rawRecords.filter((r) => r.status === 'absent').length,
    noCheckout: rawRecords.filter((r) => r.status === 'noCheckout').length,
  }), [rawRecords])

  async function handleOverrideSaved() {
    await loadAttendance()
  }

  if (!isLoaded) return <div className="p-8 text-center text-gray-400">⏳ กำลังโหลด...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">รายงานรายวัน</h2>
          {selectedDate && <p className="text-gray-500 mt-1">{formatThaiDateShort(selectedDate)}</p>}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 font-medium">เลือกวันที่:</label>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="min-w-[180px]">
            {[...dates].reverse().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {rawRecords.length > 0 && !isRegularUser && (
            <button className="btn-secondary" onClick={() => exportDailyReport(rawRecords, selectedDate)}>⬇️ Export</button>
          )}
        </div>
      </div>

      {!isRegularUser && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'มาทำงาน', value: stats.present, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'มาสาย', value: stats.late, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'ไม่มีบันทึกออก', value: stats.noCheckout, color: 'text-slate-600', bg: 'bg-slate-50' },
            { label: 'ขาดงาน', value: stats.absent, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((s) => (
            <div key={s.label} className={`card text-center ${s.bg}`}>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-600 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {records.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลในวันนี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
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
                {user && canManage(user.role) && <th className="table-header text-center">จัดการ</th>}
              </tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.employeeId} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-400">{i + 1}</td>
                    <td className="table-cell font-medium">{r.name}</td>
                    <td className="table-cell text-center font-mono">
                      {r.checkIn ? <span className={r.isLate ? 'text-yellow-600 font-semibold' : 'text-green-600'}>{formatTime(r.checkIn)}</span> : '-'}
                    </td>
                    <td className="table-cell text-center font-mono">
                      {r.checkOut ? <span className={r.isEarlyLeave ? 'text-orange-600 font-semibold' : ''}>{formatTime(r.checkOut)}</span> : '-'}
                    </td>
                    <td className="table-cell text-center">{formatHours(r.workHours)}</td>
                    <td className="table-cell text-center">
                      {r.lateMinutes > 0 ? <span className="text-yellow-600 font-medium">{formatMinutes(r.lateMinutes)}</span> : <span className="text-green-500 text-xs">ตรงเวลา</span>}
                    </td>
                    <td className="table-cell text-center">
                      <StatusBadge status={r.status as AttendanceStatus} />
                    </td>
                    {user && canManage(user.role) && (
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {overrideTarget && selectedDate && (
        <StatusOverrideModal
          employeeId={overrideTarget.employeeId}
          employeeName={overrideTarget.name}
          date={selectedDate}
          currentStatus={overrideTarget.status}
          onClose={() => setOverrideTarget(null)}
          onSaved={handleOverrideSaved}
        />
      )}
    </div>
  )
}
