'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'
import { SortIcon } from '@/components/shared/SortIcon'
import { useSortable } from '@/hooks/useSortable'

type UserSortKey = 'username' | 'fullName' | 'role' | 'employeeId' | 'isActive'

interface UserRecord {
  id: number
  username: string
  role: 'admin' | 'manager' | 'user'
  employee_id: string | null
  full_name: string | null
  is_active: number
  created_at: string
}

interface UserForm {
  username: string
  password: string
  role: 'admin' | 'manager' | 'user'
  employeeId: string
  fullName: string
}

const EMPTY_FORM: UserForm = {
  username: '',
  password: '',
  role: 'user',
  employeeId: '',
  fullName: '',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'User',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  user: 'bg-gray-100 text-gray-600',
}

export default function AdminUsersPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [employees, setEmployees] = useState<{ employeeId: string; name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const loadUsers = useCallback(() => {
    fetch('/api/users?includeInactive=true').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== 'admin') {
        router.replace('/dashboard')
        return
      }
      loadUsers()
      fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {})
    }
  }, [user, loading])

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(u: UserRecord) {
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      employeeId: u.employee_id ?? '',
      fullName: u.full_name ?? '',
    })
    setEditId(u.id)
    setFormError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.username.trim()) { setFormError('กรุณากรอก Username'); return }
    if (!editId && !form.password.trim()) { setFormError('กรุณากรอก Password'); return }
    setSaving(true)
    setFormError('')
    try {
      if (editId) {
        const body: Record<string, unknown> = {
          role: form.role,
          employeeId: form.employeeId || null,
          fullName: form.fullName || null,
        }
        if (form.password) body.password = form.password
        const res = await fetch(`/api/users/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json(); setFormError(d.error || 'เกิดข้อผิดพลาด'); return }
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { const d = await res.json(); setFormError(d.error || 'เกิดข้อผิดพลาด'); return }
      }
      setShowModal(false)
      loadUsers()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(u: UserRecord) {
    if (u.username === user?.username) return // ป้องกัน disable ตัวเอง
    await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: u.is_active === 0 }),
    })
    loadUsers()
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        setDeleteTarget(null)
        loadUsers()
      } else {
        setDeleteError(data.error ?? 'เกิดข้อผิดพลาด')
      }
    } finally {
      setDeleting(false)
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordId || !newPassword.trim()) return
    const res = await fetch(`/api/users/${resetPasswordId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    if (res.ok) {
      setResetMsg('เปลี่ยน Password แล้ว')
      setNewPassword('')
      setTimeout(() => { setResetPasswordId(null); setResetMsg('') }, 2000)
    }
  }

  const { sortKey, sortDir, handleSort, sorted } = useSortable<UserSortKey>('username')
  const sortedUsers = useMemo(() => sorted(users, (key, u) => {
    switch (key) {
      case 'username': return u.username
      case 'fullName': return u.full_name ?? ''
      case 'role': return u.role
      case 'employeeId': return u.employee_id ?? ''
      case 'isActive': return u.is_active
    }
  }), [users, sortKey, sortDir])

  const activeCount = users.filter(u => u.is_active).length
  const inactiveCount = users.filter(u => !u.is_active).length
  const adminCount = users.filter(u => u.role === 'admin' && u.is_active).length
  const managerCount = users.filter(u => u.role === 'manager' && u.is_active).length

  // กรองตาม showInactive
  const displayedUsers = sortedUsers.filter(u => showInactive || u.is_active)

  if (loading) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">จัดการผู้ใช้งาน</h2>
          <p className="text-gray-500 mt-1 text-sm">
            Active {activeCount} คน | Admin {adminCount} | Manager {managerCount}
            {inactiveCount > 0 && <span className="text-gray-400"> | Inactive {inactiveCount} คน</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {inactiveCount > 0 && (
            <button
              onClick={() => setShowInactive(v => !v)}
              className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                showInactive
                  ? 'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {showInactive ? '🙈 ซ่อน Inactive' : `👁 แสดง Inactive (${inactiveCount})`}
            </button>
          )}
          <button className="btn-primary" onClick={openAdd}>+ เพิ่มผู้ใช้</button>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        {displayedUsers.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ไม่มีข้อมูลผู้ใช้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {([
                  { key: 'username', label: 'Username', cls: '' },
                  { key: 'fullName', label: 'ชื่อเต็ม', cls: '' },
                  { key: 'role', label: 'Role', cls: 'text-center' },
                  { key: 'employeeId', label: 'รหัสพนักงาน', cls: '' },
                  { key: 'isActive', label: 'สถานะ', cls: 'text-center' },
                ] as { key: UserSortKey; label: string; cls: string }[]).map((col) => (
                  <th key={col.key} className={`table-header ${col.cls}`}>
                    <button onClick={() => handleSort(col.key)} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold">
                      {col.label}<SortIcon active={sortKey === col.key} dir={sortDir} />
                    </button>
                  </th>
                ))}
                <th className="table-header text-center">จัดการ</th>
              </tr></thead>
              <tbody>
                {displayedUsers.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="table-cell font-mono font-medium">{u.username}</td>
                    <td className="table-cell text-gray-700">{u.full_name || '-'}</td>
                    <td className="table-cell text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 text-sm font-mono">{u.employee_id || '-'}</td>
                    <td className="table-cell text-center">
                      {u.is_active ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <div className="flex gap-1 justify-center items-center">
                        {/* แก้ไข */}
                        <button
                          onClick={() => openEdit(u)}
                          title="แก้ไขข้อมูล"
                          className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {/* เปลี่ยน Password */}
                        <button
                          onClick={() => { setResetPasswordId(u.id); setNewPassword('') }}
                          title="เปลี่ยน Password"
                          className="p-1.5 rounded-lg text-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        {/* ปิด/เปิดใช้งาน */}
                        {u.username !== user?.username && (
                          <button
                            onClick={() => handleToggleActive(u)}
                            title={u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.is_active
                                ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'
                                : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {u.is_active ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                        )}
                        {/* ลบผู้ใช้ */}
                        {u.username !== user?.username && (
                          <button
                            onClick={() => { setDeleteTarget(u); setDeleteError('') }}
                            title="ลบผู้ใช้"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">{editId ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  className="w-full"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editId}
                  placeholder="username"
                />
              </div>
              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input
                    type="password"
                    className="w-full"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="รหัสผ่าน"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเต็ม</label>
                <input
                  type="text"
                  className="w-full"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <div className="flex gap-4">
                  {(['admin', 'manager', 'user'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={r}
                        checked={form.role === r}
                        onChange={() => setForm({ ...form, role: r })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เชื่อมรหัสพนักงาน</label>
                <select className="w-full" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                  <option value="">ไม่เชื่อม</option>
                  {employees.map((e) => (
                    <option key={e.employeeId} value={e.employeeId}>{e.employeeId} - {e.name}</option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-red-600 text-sm">⚠️ {formError}</p>}
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'กำลังบันทึก...' : editId ? 'บันทึก' : 'สร้างผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบผู้ใช้</h3>
                <p className="text-sm text-gray-500 mt-0.5">การกระทำนี้ไม่สามารถยกเลิกได้</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Username:</span>{' '}
                <span className="font-mono">{deleteTarget.username}</span>
              </p>
              {deleteTarget.full_name && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">ชื่อ:</span> {deleteTarget.full_name}
                </p>
              )}
              <p className="text-sm text-gray-700">
                <span className="font-medium">Role:</span>{' '}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[deleteTarget.role]}`}>
                  {ROLE_LABELS[deleteTarget.role]}
                </span>
              </p>
            </div>

            <p className="text-sm text-red-600">⚠️ ข้อมูลผู้ใช้จะถูกลบออกจากระบบอย่างถาวร</p>

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">❌ {deleteError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                disabled={deleting}
              >ยกเลิก</button>
              <button
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting ? '⏳ กำลังลบ...' : '🗑️ ลบผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPasswordId && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm p-4 sm:p-6">
            <h3 className="text-lg font-bold mb-4">เปลี่ยน Password</h3>
            <input
              type="password"
              className="w-full"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="รหัสผ่านใหม่"
            />
            {resetMsg && <p className="text-green-600 text-sm mt-2">✓ {resetMsg}</p>}
            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-secondary" onClick={() => { setResetPasswordId(null); setNewPassword('') }}>ยกเลิก</button>
              <button className="btn-primary" onClick={handleResetPassword} disabled={!newPassword.trim()}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
