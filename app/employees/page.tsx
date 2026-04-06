'use client'
import { useState, useEffect, useCallback } from 'react'
import { EmployeeProfile, EmploymentType } from '@/lib/types'
import { formatCurrency } from '@/lib/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { SortIcon } from '@/components/shared/SortIcon'
import { THAI_BANKS, getBankById } from '@/lib/banks'

type SortKey = 'employeeId' | 'name' | 'department' | 'employmentType' | 'rate' | 'startDate' | 'isActive'
type SortDir = 'asc' | 'desc'

const EMPTY_FORM: Omit<EmployeeProfile, 'isActive'> = {
  employeeId: '',
  name: '',
  nickname: '',
  department: '',
  employmentType: 'daily',
  dailyRate: undefined,
  monthlySalary: undefined,
  startDate: '',
}

export default function EmployeesPage() {
  const { user } = useCurrentUser()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [filter, setFilter] = useState<'all' | 'daily' | 'monthly' | 'inactive'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<EmployeeProfile, 'isActive'>>(EMPTY_FORM)
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [showBankSection, setShowBankSection] = useState(false)

  const loadEmployees = useCallback(() => {
    fetch('/api/employees?includeInactive=true').then(r => r.json()).then(setEmployees).catch(() => {})
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function getRate(e: EmployeeProfile) {
    return e.employmentType === 'daily' ? (e.dailyRate ?? 0) : (e.monthlySalary ?? 0)
  }

  const filtered = employees
    .filter((e) => {
      if (filter === 'all') return e.isActive
      if (filter === 'inactive') return !e.isActive
      return e.isActive && e.employmentType === filter
    })
    .sort((a, b) => {
      let va: string | number, vb: string | number
      switch (sortKey) {
        case 'employeeId':   va = a.employeeId; vb = b.employeeId; break
        case 'name':         va = a.name; vb = b.name; break
        case 'department':   va = a.department || ''; vb = b.department || ''; break
        case 'employmentType': va = a.employmentType; vb = b.employmentType; break
        case 'rate':         va = getRate(a); vb = getRate(b); break
        case 'startDate':    va = a.startDate || ''; vb = b.startDate || ''; break
        case 'isActive':     va = a.isActive ? 1 : 0; vb = b.isActive ? 1 : 0; break
        default:             va = a.name; vb = b.name
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const activeCount = employees.filter(e => e.isActive).length
  const dailyCount = employees.filter((e) => e.isActive && e.employmentType === 'daily').length
  const monthlyCount = employees.filter((e) => e.isActive && e.employmentType === 'monthly').length
  const inactiveCount = employees.filter(e => !e.isActive).length

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setFormError('')
    setShowBankSection(false)
    setShowModal(true)
  }

  function openEdit(emp: EmployeeProfile) {
    setForm({ ...emp })
    setEditId(emp.employeeId)
    setFormError('')
    setShowBankSection(!!(emp.bankName || emp.bankAccountNumber || emp.promptPayId || emp.phone))
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.employeeId.trim()) {
      setFormError('กรุณากรอกรหัสพนักงานและชื่อ')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editId) {
        const res = await fetch(`/api/employees/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) { const d = await res.json(); setFormError(d.error || 'เกิดข้อผิดพลาด'); return }
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, isActive: true }),
        })
        if (!res.ok) { const d = await res.json(); setFormError(d.error || 'เกิดข้อผิดพลาด'); return }
      }
      setShowModal(false)
      loadEmployees()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(employeeId: string) {
    await fetch(`/api/employees/${employeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    setConfirmDeactivate(null)
    loadEmployees()
  }

  async function handleActivate(employeeId: string) {
    await fetch(`/api/employees/${employeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    loadEmployees()
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">จัดการพนักงาน</h2>
          <p className="text-gray-500 mt-1 text-sm">
            ทั้งหมด {activeCount} คน | รายวัน {dailyCount} คน | รายเดือน {monthlyCount} คน
          </p>
        </div>
        {canManage && <button className="btn-primary self-start sm:self-auto" onClick={openAdd}>+ เพิ่มพนักงาน</button>}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `ทั้งหมด (${activeCount})` },
          { key: 'daily', label: `รายวัน (${dailyCount})` },
          { key: 'monthly', label: `รายเดือน (${monthlyCount})` },
          { key: 'inactive', label: `ไม่ active (${inactiveCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">ไม่มีข้อมูลพนักงาน</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {filtered.map((emp) => (
                <div key={emp.employeeId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-800 text-sm">{emp.name}</p>
                        {emp.nickname && <span className="text-xs text-gray-400">({emp.nickname})</span>}
                        {emp.employmentType === 'daily'
                          ? <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">รายวัน</span>
                          : <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">รายเดือน</span>}
                        {emp.isActive
                          ? <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">Active</span>
                          : <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactive</span>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-xs text-gray-400 font-mono">{emp.employeeId}</span>
                        {emp.department && <span className="text-xs text-gray-500">{emp.department}</span>}
                        <span className="text-xs text-gray-500">
                          {emp.employmentType === 'daily' && emp.dailyRate
                            ? formatCurrency(emp.dailyRate) + '/วัน'
                            : emp.employmentType === 'monthly' && emp.monthlySalary
                            ? formatCurrency(emp.monthlySalary) + '/เดือน'
                            : null}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(emp)} title="แก้ไข"
                          className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {emp.isActive && (
                          <button onClick={() => setConfirmDeactivate(emp.employeeId)} title="ปิดใช้งาน"
                            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
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
                      { key: 'employeeId', label: 'รหัส', cls: '' },
                      { key: 'name', label: 'ชื่อ', cls: '' },
                      { key: null, label: 'ชื่อเล่น', cls: '' },
                      { key: 'department', label: 'แผนก', cls: '' },
                      { key: 'employmentType', label: 'ประเภท', cls: 'text-center' },
                      { key: 'rate', label: 'ค่าแรง', cls: 'text-center' },
                      { key: 'startDate', label: 'วันเริ่มงาน', cls: 'text-center' },
                      { key: 'isActive', label: 'สถานะ', cls: 'text-center' },
                      { key: null, label: 'จัดการ', cls: 'text-center' },
                    ] as { key: SortKey | null; label: string; cls: string }[]).map((col, i) => (
                      <th key={i} className={`table-header ${col.cls}`}>
                        {col.key ? (
                          <button
                            onClick={() => handleSort(col.key as SortKey)}
                            className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors font-semibold"
                          >
                            {col.label}
                            <SortIcon active={sortKey === col.key} dir={sortDir} />
                          </button>
                        ) : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50">
                      <td className="table-cell text-gray-400 font-mono text-xs">{emp.employeeId}</td>
                      <td className="table-cell font-medium">{emp.name}</td>
                      <td className="table-cell text-gray-500">{emp.nickname || '-'}</td>
                      <td className="table-cell text-gray-600">{emp.department || '-'}</td>
                      <td className="table-cell text-center">
                        {emp.employmentType === 'daily' ? (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">รายวัน</span>
                        ) : (
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-medium">รายเดือน</span>
                        )}
                      </td>
                      <td className="table-cell text-center text-gray-700">
                        {emp.employmentType === 'daily' && emp.dailyRate
                          ? formatCurrency(emp.dailyRate) + '/วัน'
                          : emp.employmentType === 'monthly' && emp.monthlySalary
                          ? formatCurrency(emp.monthlySalary) + '/เดือน'
                          : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="table-cell text-center text-gray-500 text-xs">{emp.startDate || '-'}</td>
                      <td className="table-cell text-center">
                        {emp.isActive ? (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                        )}
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canManage && (
                            <button
                              onClick={() => openEdit(emp)}
                              title="แก้ไข"
                              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          {canManage && emp.isActive && (
                            <button
                              onClick={() => setConfirmDeactivate(emp.employeeId)}
                              title="ปิดใช้งาน"
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                          {canManage && !emp.isActive && (
                            <button
                              onClick={() => handleActivate(emp.employeeId)}
                              title="เปิดใช้งานอีกครั้ง"
                              className="p-1.5 rounded-lg text-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                          {!canManage && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editId ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
              </h3>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="form-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสพนักงาน *</label>
                  <input
                    type="text"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                    disabled={!!editId}
                    className="w-full"
                    placeholder="เช่น 01, EMP001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full"
                    placeholder="ชื่อ-นามสกุล"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเล่น</label>
                  <input
                    type="text"
                    value={form.nickname ?? ''}
                    onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                    className="w-full"
                    placeholder="ชื่อเล่น"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">แผนก</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full"
                    placeholder="แผนก"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทการจ้างงาน *</label>
                <div className="flex gap-4">
                  {(['daily', 'monthly'] as EmploymentType[]).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={type}
                        checked={form.employmentType === type}
                        onChange={() => setForm({ ...form, employmentType: type })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">{type === 'daily' ? 'รายวัน' : 'รายเดือน'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.employmentType === 'daily' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ค่าแรงต่อวัน (บาท)</label>
                  <input
                    type="number"
                    value={form.dailyRate ?? ''}
                    onChange={(e) => setForm({ ...form, dailyRate: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full"
                    placeholder="เช่น 400"
                    min={0}
                  />
                </div>
              )}
              {form.employmentType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เงินเดือน (บาท)</label>
                  <input
                    type="number"
                    value={form.monthlySalary ?? ''}
                    onChange={(e) => setForm({ ...form, monthlySalary: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full"
                    placeholder="เช่น 15000"
                    min={0}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่เริ่มงาน</label>
                <input
                  type="date"
                  value={form.startDate ?? ''}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full"
                />
              </div>

              {/* ── Bank & Contact Info ── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBankSection(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                >
                  <span className="flex items-center gap-2">
                    🏦 <span>ข้อมูลการติดต่อและบัญชีธนาคาร</span>
                    {(form.bankName || form.bankAccountNumber || form.promptPayId || form.phone) && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">มีข้อมูล</span>
                    )}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showBankSection ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showBankSection && (
                  <div className="p-4 space-y-3 border-t border-gray-100">
                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">เบอร์โทรศัพท์</label>
                      <input
                        type="tel"
                        value={form.phone ?? ''}
                        onChange={e => setForm({ ...form, phone: e.target.value || undefined })}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all"
                        placeholder="0XX-XXX-XXXX"
                      />
                    </div>

                    {/* Bank selector */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ธนาคาร</label>
                      <select
                        value={form.bankName ?? ''}
                        onChange={e => setForm({ ...form, bankName: e.target.value || undefined })}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all bg-white"
                      >
                        <option value="">— เลือกธนาคาร —</option>
                        {THAI_BANKS.map(bank => (
                          <option key={bank.id} value={bank.id}>
                            {bank.name} ({bank.shortName})
                          </option>
                        ))}
                      </select>
                      {form.bankName && (() => {
                        const bank = getBankById(form.bankName)
                        return bank ? (
                          <span
                            className="inline-block mt-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold"
                            style={{ backgroundColor: bank.bgColor, color: bank.color }}
                          >
                            {bank.shortName}
                          </span>
                        ) : null
                      })()}
                    </div>

                    {/* Account number */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">เลขบัญชี</label>
                      <input
                        type="text"
                        value={form.bankAccountNumber ?? ''}
                        onChange={e => setForm({ ...form, bankAccountNumber: e.target.value || undefined })}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all font-mono"
                        placeholder="XXX-X-XXXXX-X"
                      />
                    </div>

                    {/* Account name */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">ชื่อบัญชี</label>
                      <input
                        type="text"
                        value={form.bankAccountName ?? ''}
                        onChange={e => setForm({ ...form, bankAccountName: e.target.value || undefined })}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all"
                        placeholder="ชื่อ-นามสกุล ในบัญชี"
                      />
                    </div>

                    {/* PromptPay ID */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">PromptPay ID</label>
                      <input
                        type="text"
                        value={form.promptPayId ?? ''}
                        onChange={e => setForm({ ...form, promptPayId: e.target.value || undefined })}
                        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all font-mono"
                        placeholder="เบอร์โทรหรือเลขบัตรประชาชน"
                      />
                    </div>
                  </div>
                )}
              </div>

              {formError && <p className="text-red-600 text-sm">⚠️ {formError}</p>}
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.employeeId.trim()}
              >
                {saving ? 'กำลังบันทึก...' : editId ? 'บันทึก' : 'เพิ่มพนักงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Deactivate */}
      {confirmDeactivate && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full sm:max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">ยืนยันการปิดใช้งาน</h3>
            <p className="text-gray-600 text-sm mb-6">
              พนักงานจะถูกปิดใช้งาน แต่ประวัติการเข้างานจะยังคงอยู่
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setConfirmDeactivate(null)}>ยกเลิก</button>
              <button className="btn-danger" onClick={() => handleDeactivate(confirmDeactivate)}>ปิดใช้งาน</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
