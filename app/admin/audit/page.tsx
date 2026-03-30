'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'
import { AUDIT_ACTION_LABELS, AUDIT_ACTION_COLORS, AuditAction } from '@/lib/audit'

interface AuditLog {
  id: number
  actor: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

const ACTION_GROUPS = [
  { label: 'ทั้งหมด', value: '' },
  { label: 'เข้า/ออกระบบ', value: 'auth', actions: ['auth.login', 'auth.logout'] },
  { label: 'ใบลา', value: 'leave', actions: ['leave.create', 'leave.approve', 'leave.reject', 'leave.edit', 'leave.delete'] },
  { label: 'พนักงาน', value: 'employee', actions: ['employee.create', 'employee.update', 'employee.deactivate'] },
  { label: 'ผู้ใช้ระบบ', value: 'user', actions: ['user.create', 'user.update', 'user.delete'] },
  { label: 'สถานะการมา', value: 'attendance', actions: ['attendance.override', 'attendance.override_delete'] },
  { label: 'ข้อมูลสแกน', value: 'scan', actions: ['scan.import', 'scan.reset'] },
  { label: 'เงินเดือน', value: 'payroll', actions: ['payroll.calculate'] },
  { label: 'การตั้งค่า', value: 'settings', actions: ['settings.update', 'settings.payroll_update'] },
  { label: 'วันหยุด', value: 'holiday', actions: ['holiday.create', 'holiday.update', 'holiday.delete'] },
]

function formatDateTime(dt: string) {
  const d = new Date(dt.replace(' ', 'T') + 'Z')
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function DetailView({ json }: { json: string | null }) {
  if (!json) return <span className="text-gray-400 text-xs">-</span>
  try {
    const parsed = JSON.parse(json)
    const entries = Object.entries(parsed)
    if (entries.length === 0) return <span className="text-gray-400 text-xs">-</span>
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            <span className="font-medium">{k}:</span>
            <span className="truncate max-w-[120px]">{String(v ?? '-')}</span>
          </span>
        ))}
      </div>
    )
  } catch {
    return <span className="text-xs text-gray-500">{json}</span>
  }
}

const PAGE_SIZE = 50

export default function AuditPage() {
  const { user } = useCurrentUser()
  const router = useRouter()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  // Filters
  const [filterGroup, setFilterGroup] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterActor, setFilterActor] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Redirect non-admin
  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/dashboard')
  }, [user, router])

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterAction) params.set('action', filterAction)
      if (filterActor) params.set('actor', filterActor)
      if (filterDateFrom) params.set('dateFrom', filterDateFrom)
      if (filterDateTo) params.set('dateTo', filterDateTo)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(p * PAGE_SIZE))

      const res = await fetch(`/api/admin/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterActor, filterDateFrom, filterDateTo])

  useEffect(() => {
    setPage(0)
    fetchLogs(0)
  }, [fetchLogs])

  function handleGroupChange(groupValue: string) {
    setFilterGroup(groupValue)
    setFilterAction('') // reset specific action
  }

  const selectedGroup = ACTION_GROUPS.find(g => g.value === filterGroup)
  const actionOptions = filterGroup && selectedGroup?.actions
    ? selectedGroup.actions
    : Object.keys(AUDIT_ACTION_LABELS)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (!user || user.role !== 'admin') return null

  return (
    <div className="p-6 max-w-7xl space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">บันทึกการใช้งาน</h2>
        <p className="text-gray-500 mt-1">ติดตามทุกการกระทำในระบบ — เฉพาะ Admin</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">ตัวกรอง</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Group filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">หมวดหมู่</label>
            <select
              value={filterGroup}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {ACTION_GROUPS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">การกระทำ</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">ทั้งหมด</option>
              {actionOptions.map(a => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_LABELS[a as AuditAction] ?? a}
                </option>
              ))}
            </select>
          </div>

          {/* Actor filter */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">ผู้ใช้</label>
            <input
              type="text"
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              placeholder="ชื่อผู้ใช้..."
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">
            {loading ? 'กำลังโหลด...' : `พบ ${total.toLocaleString()} รายการ`}
          </span>
          <button
            onClick={() => {
              setFilterGroup('')
              setFilterAction('')
              setFilterActor('')
              setFilterDateFrom('')
              setFilterDateTo('')
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">เวลา</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ผู้กระทำ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">การกระทำ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">เป้าหมาย</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>กำลังโหลด...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              ) : logs.map((log) => {
                const action = log.action as AuditAction
                const colorClass = AUDIT_ACTION_COLORS[action] ?? 'bg-gray-100 text-gray-600'
                const label = AUDIT_ACTION_LABELS[action] ?? log.action
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-800">{log.actor}</span>
                      {log.ip_address && (
                        <div className="text-xs text-gray-400">{log.ip_address}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {log.entity_type && (
                        <span>
                          {log.entity_type}
                          {log.entity_id && <span className="text-gray-400"> #{log.entity_id}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <DetailView json={log.details} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              หน้า {page + 1} / {totalPages} (แสดง {logs.length} จาก {total.toLocaleString()} รายการ)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPage(p => p - 1); fetchLogs(page - 1) }}
                disabled={page === 0}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ← ก่อนหน้า
              </button>
              <button
                onClick={() => { setPage(p => p + 1); fetchLogs(page + 1) }}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
              >
                ถัดไป →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
