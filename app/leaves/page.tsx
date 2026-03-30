'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatThaiDateShort } from '@/lib/formatters'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'

type MyLeaveSortKey = 'date' | 'leaveType' | 'status'
type AllLeaveSortKey = 'employeeName' | 'date' | 'leaveType' | 'status'
type PendingSortKey = 'employeeName' | 'date' | 'leaveType'

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'ลาป่วย (มีใบรับรองแพทย์)',
  full_day: 'ลาทั้งวัน',
  half_morning: 'ลาครึ่งวันเช้า',
  half_afternoon: 'ลาครึ่งวันบ่าย',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'รอการอนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธ',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

interface Leave {
  id: number
  employee_id: string
  employee_name: string
  leave_type: string
  date: string
  has_medical_cert: number
  reason: string | null
  status: string
  approved_by: string | null
  reject_reason: string | null
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

interface LeaveForm {
  employeeId: string
  leaveType: string
  date: string
  hasMedicalCert: boolean
  reason: string
}

export default function LeavesPage() {
  const { user } = useCurrentUser()
  const [tab, setTab] = useState<'mine' | 'all' | 'pending'>('mine')
  const [myLeaves, setMyLeaves] = useState<Leave[]>([])
  const [allLeaves, setAllLeaves] = useState<Leave[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<Leave[]>([])
  const [employees, setEmployees] = useState<{ employeeId: string; name: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editModal, setEditModal] = useState<Leave | null>(null)
  const [editForm, setEditForm] = useState<{ leaveType: string; date: string; hasMedicalCert: boolean; reason: string }>({
    leaveType: 'sick', date: '', hasMedicalCert: false, reason: '',
  })
  const [form, setForm] = useState<LeaveForm>({ employeeId: '', leaveType: 'sick', date: '', hasMedicalCert: false, reason: '' })
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const [showDeleted, setShowDeleted] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  function showSyncMsg(msg: string) {
    setSyncMsg(msg)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  // Sync payroll for the affected month after leave changes
  async function syncPayroll(dateStr: string) {
    // Parse YYYY-MM-DD directly — avoid timezone ambiguity
    const parts = dateStr.split('-').map(Number)
    const year = parts[0]
    const month = parts[1]
    if (!year || !month) return
    try {
      const res = await fetch('/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      if (res.ok) {
        showSyncMsg('✅ อัปเดตข้อมูลเงินเดือนแล้ว')
      } else {
        showSyncMsg('⚠️ อัปเดตเงินเดือนไม่สำเร็จ กรุณาคำนวณใหม่ในหน้าเงินเดือน')
      }
    } catch {
      showSyncMsg('⚠️ เชื่อมต่อไม่ได้ กรุณาคำนวณเงินเดือนใหม่ด้วยตนเอง')
    }
  }

  const loadMyLeaves = useCallback(() => {
    fetch('/api/leaves').then(r => r.json()).then(setMyLeaves).catch(() => {})
  }, [])

  const loadAllLeaves = useCallback((withDeleted = false) => {
    const url = withDeleted ? '/api/leaves?includeDeleted=true' : '/api/leaves'
    fetch(url).then(r => r.json()).then(setAllLeaves).catch(() => {})
  }, [])

  const loadPendingLeaves = useCallback(() => {
    fetch('/api/leaves?status=pending').then(r => r.json()).then(setPendingLeaves).catch(() => {})
  }, [])

  useEffect(() => {
    if (canManage) {
      setTab('all')
      loadAllLeaves(showDeleted)
      loadPendingLeaves()
      fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
    } else {
      loadMyLeaves()
    }
  }, [user])

  // Reload all-leaves list when toggle changes
  useEffect(() => {
    if (canManage) loadAllLeaves(showDeleted)
  }, [showDeleted])

  async function handleSubmitLeave() {
    if (!form.date || !form.leaveType) { setFormError('กรุณากรอกข้อมูลให้ครบ'); return }
    setLoading(true)
    setFormError('')
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, hasMedicalCert: form.hasMedicalCert }),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error || 'เกิดข้อผิดพลาด'); return }
      setShowForm(false)
      setForm({ employeeId: '', leaveType: 'sick', date: '', hasMedicalCert: false, reason: '' })
      loadMyLeaves()
      if (canManage) { loadAllLeaves(); loadPendingLeaves() }
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: number) {
    const leave = pendingLeaves.find(l => l.id === id)
    await fetch(`/api/leaves/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    // Auto-sync payroll for the affected month
    if (leave?.date) await syncPayroll(leave.date)
    loadPendingLeaves()
    loadMyLeaves()
    loadAllLeaves(showDeleted)
  }

  async function handleReject() {
    if (!rejectModal) return
    const leave = pendingLeaves.find(l => l.id === rejectModal.id)
    await fetch(`/api/leaves/${rejectModal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejectReason }),
    })
    // Auto-sync payroll
    if (leave?.date) await syncPayroll(leave.date)
    setRejectModal(null)
    setRejectReason('')
    loadPendingLeaves()
    loadMyLeaves()
    loadAllLeaves(showDeleted)
  }

  async function handleDelete(id: number) {
    if (!confirm('ยืนยันการลบใบลา?')) return
    const res = await fetch(`/api/leaves/${id}`, { method: 'DELETE' })
    // API returns { success, date, wasApproved } — sync payroll if the leave was approved
    if (res.ok) {
      const data = await res.json()
      if (data.wasApproved && data.date) await syncPayroll(data.date)
    }
    loadMyLeaves()
    if (canManage) { loadAllLeaves(showDeleted); loadPendingLeaves() }
  }

  function openEditModal(l: Leave) {
    setEditModal(l)
    setEditForm({
      leaveType: l.leave_type,
      date: l.date,
      hasMedicalCert: l.has_medical_cert === 1,
      reason: l.reason || '',
    })
  }

  async function handleSaveEdit() {
    if (!editModal) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leaves/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', ...editForm }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || 'เกิดข้อผิดพลาด')
        return
      }
      // sync payroll เฉพาะ admin/manager เท่านั้น
      if (canManage) {
        await syncPayroll(editForm.date)
        if (editModal.date !== editForm.date) await syncPayroll(editModal.date)
      }
      setEditModal(null)
      loadMyLeaves()
      if (canManage) { loadAllLeaves(showDeleted); loadPendingLeaves() }
    } finally {
      setLoading(false)
    }
  }

  const { sortKey: mySortKey, sortDir: mySortDir, handleSort: myHandleSort, sorted: mySorted } = useSortable<MyLeaveSortKey>('date', 'desc')
  const { sortKey: allSortKey, sortDir: allSortDir, handleSort: allHandleSort, sorted: allSorted } = useSortable<AllLeaveSortKey>('date', 'desc')
  const { sortKey: pendSortKey, sortDir: pendSortDir, handleSort: pendHandleSort, sorted: pendSorted } = useSortable<PendingSortKey>('date', 'desc')

  const tabs = canManage
    ? [
        { key: 'all', label: 'ประวัติทั้งหมด' },
        { key: 'pending', label: `รออนุมัติ (${pendingLeaves.length})` },
      ]
    : []

  return (
    <div className="p-8 space-y-6">
      {/* Payroll sync toast */}
      {syncMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          syncMsg.startsWith('✅') ? 'bg-green-600 text-white' : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
        }`}>
          {syncMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ระบบการลา</h2>
          <p className="text-gray-500 mt-1">บันทึกและจัดการใบลาพนักงาน</p>
        </div>
        {!canManage && <button className="btn-primary" onClick={() => setShowForm(true)}>+ ขอลา</button>}
      </div>

      {/* Tabs */}
      {canManage && (
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* My Leaves — only for regular users (not admin/manager) */}
      {!canManage && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">ประวัติการลาของฉัน</h3>
          {myLeaves.filter(l => !canManage || l.employee_id === user?.employeeId).length === 0 ? (
            <p className="text-center text-gray-400 py-8">ไม่มีประวัติการลา</p>
          ) : (
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'date', label: 'วันที่', cls: '' },
                  { key: 'leaveType', label: 'ประเภท', cls: '' },
                ] as { key: MyLeaveSortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header ${col.cls}`}>
                    <button onClick={() => myHandleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                      {col.label}<SortIcon active={mySortKey === col.key} dir={mySortDir} />
                    </button>
                  </th>
                ))}
                <th className="table-header text-center">ใบแพทย์</th>
                <th className="table-header">เหตุผล</th>
                <th className="table-header text-center">
                  <button onClick={() => myHandleSort('status')} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                    สถานะ<SortIcon active={mySortKey === 'status'} dir={mySortDir} />
                  </button>
                </th>
                <th className="table-header text-center">จัดการ</th>
              </tr></thead>
              <tbody>
                {mySorted(
                  myLeaves.filter(l => !canManage || l.employee_id === user?.employeeId),
                  (key, l) => key === 'date' ? l.date : key === 'leaveType' ? l.leave_type : l.status
                ).map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="table-cell">{formatThaiDateShort(l.date)}</td>
                      <td className="table-cell">{LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}</td>
                      <td className="table-cell text-center">{l.leave_type === 'sick' ? '✅' : '—'}</td>
                      <td className="table-cell text-gray-500">{l.reason || '—'}</td>
                      <td className="table-cell text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>{STATUS_LABELS[l.status]}</span>
                        {l.status === 'rejected' && l.reject_reason && <p className="text-xs text-red-500 mt-1">{l.reject_reason}</p>}
                      </td>
                      <td className="table-cell text-center">
                        {l.status === 'pending' && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="แก้ไขใบลา"
                              onClick={() => openEditModal(l)}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className="text-red-400 hover:text-red-600 text-xs"
                              onClick={() => handleDelete(l.id)}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* All Leaves History (manager/admin) */}
      {tab === 'all' && canManage && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-gray-800">
              ประวัติการลาทั้งหมด
              {showDeleted && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  (รวมที่ลบแล้ว {allLeaves.filter(l => l.deleted_at).length} รายการ)
                </span>
              )}
            </h3>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setShowDeleted(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${showDeleted ? 'bg-red-400' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showDeleted ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-600">แสดงที่ถูกลบแล้ว</span>
            </label>
          </div>

          {allLeaves.length === 0 ? (
            <p className="text-center text-gray-400 py-8">ไม่มีประวัติการลา</p>
          ) : (
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'employeeName', label: 'พนักงาน', cls: '' },
                  { key: 'date', label: 'วันที่', cls: '' },
                  { key: 'leaveType', label: 'ประเภท', cls: '' },
                ] as { key: AllLeaveSortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header ${col.cls}`}>
                    <button onClick={() => allHandleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                      {col.label}<SortIcon active={allSortKey === col.key} dir={allSortDir} />
                    </button>
                  </th>
                ))}
                <th className="table-header text-center">ใบแพทย์</th>
                <th className="table-header">เหตุผล</th>
                <th className="table-header text-center">
                  <button onClick={() => allHandleSort('status')} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                    สถานะ<SortIcon active={allSortKey === 'status'} dir={allSortDir} />
                  </button>
                </th>
                <th className="table-header text-center">จัดการ</th>
              </tr></thead>
              <tbody>
                {allSorted(allLeaves, (key, l) => key === 'employeeName' ? (l.employee_name || l.employee_id) : key === 'date' ? l.date : key === 'leaveType' ? l.leave_type : l.status).map((l) => {
                  const isDeleted = !!l.deleted_at
                  return (
                    <tr key={l.id} className={isDeleted ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className={`table-cell font-medium ${isDeleted ? 'line-through text-gray-400' : ''}`}>
                        {l.employee_name || l.employee_id}
                      </td>
                      <td className={`table-cell ${isDeleted ? 'line-through text-gray-400' : ''}`}>
                        {formatThaiDateShort(l.date)}
                      </td>
                      <td className={`table-cell ${isDeleted ? 'line-through text-gray-400' : ''}`}>
                        {LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}
                      </td>
                      <td className="table-cell text-center">{l.leave_type === 'sick' ? '✅' : '—'}</td>
                      <td className={`table-cell ${isDeleted ? 'text-gray-400' : 'text-gray-500'}`}>
                        {l.reason || '—'}
                      </td>
                      <td className="table-cell text-center">
                        {isDeleted ? (
                          <div>
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                              🗑️ ถูกลบ
                            </span>
                            {l.deleted_by && (
                              <p className="text-xs text-gray-400 mt-0.5">โดย {l.deleted_by}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>
                              {STATUS_LABELS[l.status]}
                            </span>
                            {l.status === 'rejected' && l.reject_reason && (
                              <p className="text-xs text-red-500 mt-1">{l.reject_reason}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        {isDeleted ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => openEditModal(l)}
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="แก้ไขใบลา"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(l.id)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="ลบใบลา"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending Approvals */}
      {tab === 'pending' && canManage && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">รออนุมัติ</h3>
          {pendingLeaves.length === 0 ? (
            <p className="text-center text-gray-400 py-8">ไม่มีใบลาที่รออนุมัติ</p>
          ) : (
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'employeeName', label: 'พนักงาน', cls: '' },
                  { key: 'date', label: 'วันที่', cls: '' },
                  { key: 'leaveType', label: 'ประเภท', cls: '' },
                ] as { key: PendingSortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header ${col.cls}`}>
                    <button onClick={() => pendHandleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                      {col.label}<SortIcon active={pendSortKey === col.key} dir={pendSortDir} />
                    </button>
                  </th>
                ))}
                <th className="table-header text-center">ใบแพทย์</th>
                <th className="table-header">เหตุผล</th>
                <th className="table-header text-center">จัดการ</th>
              </tr></thead>
              <tbody>
                {pendSorted(pendingLeaves, (key, l) => key === 'employeeName' ? (l.employee_name || l.employee_id) : key === 'date' ? l.date : l.leave_type).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{l.employee_name || l.employee_id}</td>
                    <td className="table-cell">{formatThaiDateShort(l.date)}</td>
                    <td className="table-cell">{LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}</td>
                    <td className="table-cell text-center">{l.leave_type === 'sick' ? '✅' : '—'}</td>
                    <td className="table-cell text-gray-500">{l.reason || '—'}</td>
                    <td className="table-cell text-center">
                      <div className="flex gap-2 justify-center">
                        <button className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 font-medium" onClick={() => handleApprove(l.id)}>อนุมัติ</button>
                        <button className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 font-medium" onClick={() => openEditModal(l)}>แก้ไข</button>
                        <button className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 font-medium" onClick={() => setRejectModal({ id: l.id })}>ปฏิเสธ</button>
                        <button
                          onClick={() => handleDelete(l.id)}
                          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="ลบ"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Leave Request Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100"><h3 className="text-lg font-bold">ขอลา</h3></div>
            <div className="p-6 space-y-4">
              {canManage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">พนักงาน</label>
                  <select className="w-full" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">เลือกพนักงาน</option>
                    {employees.map((e) => <option key={e.employeeId} value={e.employeeId}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทการลา</label>
                <select className="w-full" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {/* Note for each leave type */}
              {form.leaveType === 'sick' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  🏥 ต้องมีใบรับรองแพทย์ — ไม่นับเป็นขาดงาน ยังได้รับเบี้ยขยัน
                </div>
              )}
              {form.leaveType === 'full_day' && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                  📋 ลาทั้งวัน — นับเป็นขาดงาน 1 วัน
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ลา</label>
                <input type="date" className="w-full" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล (ไม่บังคับ)</label>
                <input type="text" className="w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="เหตุผลการลา" />
              </div>
              {formError && <p className="text-red-600 text-sm">⚠️ {formError}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleSubmitLeave} disabled={loading}>{loading ? 'กำลังบันทึก...' : 'ยื่นใบลา'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Leave Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">แก้ไขใบลา</h3>
              <p className="text-sm text-gray-500 mt-1">{editModal.employee_name || editModal.employee_id}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทการลา</label>
                <select className="w-full" value={editForm.leaveType} onChange={(e) => setEditForm({ ...editForm, leaveType: e.target.value })}>
                  {Object.entries(LEAVE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {editForm.leaveType === 'sick' && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                  🏥 ลาป่วยมีใบรับรองแพทย์ — ไม่นับเป็นขาดงาน
                </div>
              )}
              {editForm.leaveType === 'full_day' && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-700">
                  📋 ลาทั้งวัน — นับเป็นขาดงาน 1 วัน
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ลา</label>
                <input type="date" className="w-full" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล</label>
                <input type="text" className="w-full" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} placeholder="เหตุผลการลา" />
              </div>
              {editModal.status !== 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ ใบลานี้ถูก{STATUS_LABELS[editModal.status]}แล้ว การแก้ไขจะอัปเดตสถานะการเข้างานด้วย
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setEditModal(null)}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={loading}>{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-4">เหตุผลการปฏิเสธ</h3>
            <input type="text" className="w-full" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="ระบุเหตุผล (ไม่บังคับ)" />
            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-secondary" onClick={() => setRejectModal(null)}>ยกเลิก</button>
              <button className="btn-danger" onClick={handleReject}>ยืนยันปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
