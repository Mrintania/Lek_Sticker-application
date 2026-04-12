'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatCurrency, THAI_MONTHS } from '@/lib/formatters'

const INCOME_TYPE_LABELS: Record<string, string> = {
  print_order: '🖨️ ยอดส่งพิมพ์',
  other: '📋 รายรับอื่นๆ',
}

interface IncomeRecord {
  id: number; year: number; month: number; income_type: string
  quantity: number | null; price_per_unit: number | null; amount: number
  category: string | null; note: string | null; entry_date: string
  created_by: string | null
}

export default function IncomePage() {
  const { user, loading: authLoading } = useCurrentUser()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<IncomeRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  useEscapeKey(() => {
    if (showModal) setShowModal(false)
    else if (confirmDeleteId !== null) setConfirmDeleteId(null)
  }, showModal || confirmDeleteId !== null)
  const [form, setForm] = useState({
    income_type: 'print_order', quantity: '', price_per_unit: '', amount: '',
    category: '', note: '', entry_date: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finance/income?year=${year}&month=${month}&limit=100`)
    if (res.ok) { const d = await res.json(); setRecords(d.data || []) }
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const computedAmount = () => form.amount

  const openAdd = () => {
    setEditRecord(null)
    setForm({ income_type: 'print_order', quantity: '', price_per_unit: '', amount: '', category: '', note: '', entry_date: `${year}-${String(month).padStart(2, '0')}-01` })
    setError('')
    setShowModal(true)
  }

  const openEdit = (r: IncomeRecord) => {
    setEditRecord(r)
    setForm({
      income_type: r.income_type, quantity: r.quantity ? String(r.quantity) : '',
      price_per_unit: r.price_per_unit ? String(r.price_per_unit) : '',
      amount: String(r.amount), category: r.category ?? '', note: r.note ?? '', entry_date: r.entry_date
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    const amt = parseFloat(computedAmount())
    if (!form.entry_date || isNaN(amt) || amt <= 0) { setError('กรุณากรอกข้อมูลให้ครบถ้วน'); return }
    setSaving(true)
    const body = {
      year, month, income_type: form.income_type,
      amount: amt, category: form.category, note: form.note, entry_date: form.entry_date
    }
    const res = editRecord
      ? await fetch(`/api/finance/income/${editRecord.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/finance/income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowModal(false); load() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/finance/income/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    load()
  }

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const totalPrint = records.filter(r => r.income_type === 'print_order').reduce((s, r) => s + r.amount, 0)
  const totalOther = records.filter(r => r.income_type === 'other').reduce((s, r) => s + r.amount, 0)

  if (authLoading) return <div className="page-container text-center text-gray-400 pt-20">⏳ กำลังโหลด...</div>
  if (!user) return null
  const canEdit = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายรับ</h1>
          <p className="text-sm text-gray-500 mt-0.5">{THAI_MONTHS[month - 1]} {year + 543}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="btn-secondary px-2">◀</button>
            <span className="text-sm text-gray-700 font-medium px-2">{THAI_MONTHS[month - 1]} {year}</span>
            <button onClick={nextMonth} className="btn-secondary px-2">▶</button>
          </div>
          {canEdit && <button onClick={openAdd} className="btn-primary">+ เพิ่มรายรับ</button>}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">🖨️ ยอดส่งพิมพ์</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPrint)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">📋 รายรับอื่นๆ</div>
          <div className="text-lg font-bold text-blue-600">{formatCurrency(totalOther)}</div>
        </div>
        <div className="stat-card col-span-2">
          <div className="text-xs text-gray-500 mb-1">💰 รายรับรวม</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalPrint + totalOther)}</div>
        </div>
      </div>

      <div className="card !p-0">
        {loading ? (
          <div className="p-8 text-center text-gray-400">⏳ กำลังโหลด...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-gray-400">ยังไม่มีรายการรายรับ</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">วันที่</th>
                    <th className="table-header">ประเภท</th>
                    <th className="table-header">รายละเอียด</th>
                    <th className="table-header text-right">จำนวน × ราคา</th>
                    <th className="table-header text-right">ยอดเงิน</th>
                    {canEdit && <th className="table-header text-center">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="table-cell">{r.entry_date}</td>
                      <td className="table-cell">{INCOME_TYPE_LABELS[r.income_type] || r.income_type}</td>
                      <td className="table-cell text-gray-500">{r.category || r.note || '-'}</td>
                      <td className="table-cell text-right text-gray-500">
                        {r.quantity && r.price_per_unit ? `${r.quantity.toLocaleString()} × ${r.price_per_unit.toLocaleString()}` : '-'}
                      </td>
                      <td className="table-cell text-right font-semibold text-green-600">{formatCurrency(r.amount)}</td>
                      {canEdit && (
                        <td className="table-cell text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700 text-xs">แก้ไข</button>
                            <button onClick={() => setConfirmDeleteId(r.id)} className="text-red-400 hover:text-red-600 text-xs">ลบ</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {records.map(r => (
                <div key={r.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{INCOME_TYPE_LABELS[r.income_type]}</div>
                      <div className="text-xs text-gray-500">{r.entry_date} {r.note && `· ${r.note}`}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">{formatCurrency(r.amount)}</div>
                      {canEdit && (
                        <div className="flex gap-2 mt-1 justify-end">
                          <button onClick={() => openEdit(r)} className="text-blue-500 text-xs">แก้ไข</button>
                          <button onClick={() => setConfirmDeleteId(r.id)} className="text-red-400 text-xs">ลบ</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editRecord ? 'แก้ไขรายรับ' : 'เพิ่มรายรับ'}</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทรายรับ</label>
                <div className="flex gap-2">
                  {['print_order', 'other'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, income_type: t }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.income_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                      {INCOME_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {form.income_type === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
                  <input type="text" placeholder="เช่น ดอกเบี้ยรับ" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงิน (บาท) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ <span className="text-red-500">*</span></label>
                <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <input type="text" placeholder="หมายเหตุเพิ่มเติม" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDeleteId !== null && (
        <div className="modal-backdrop">
          <div className="modal-panel p-6 space-y-4">
            <p className="text-gray-800 font-medium">ยืนยันการลบรายการนี้?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">ยกเลิก</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="btn-danger">ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
