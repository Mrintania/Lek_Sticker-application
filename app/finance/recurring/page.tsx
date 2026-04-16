'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEscapeKey } from '@/hooks/useEscapeKey'

const CATEGORY_LABELS: Record<string, string> = {
  car_installment: 'ค่างวดรถ', rent: 'ค่าเช่า', salary_total: 'เงินเดือนรวม',
  insurance: 'ค่าประกัน',
  raw_materials: 'วัตถุดิบ', electricity: 'ค่าไฟ', transport: 'ค่าขนส่ง',
  maintenance: 'ค่าซ่อมบำรุง', ot: 'ค่าโอที', other: 'อื่นๆ',
}

interface Template {
  id: number; expense_type: string; category: string
  sub_category: string | null; default_amount: number
  note: string | null; is_active: number
}

export default function RecurringPage() {
  const { user, loading: authLoading } = useCurrentUser()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<Template | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ expense_type: 'fixed', category: '', sub_category: '', default_amount: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(() => {
    if (showModal) setShowModal(false)
    else if (confirmDeleteId !== null) setConfirmDeleteId(null)
  }, showModal || confirmDeleteId !== null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finance/recurring')
    if (res.ok) setTemplates(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTemplate(null)
    setForm({ expense_type: 'fixed', category: '', sub_category: '', default_amount: '', note: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (t: Template) => {
    setEditTemplate(t)
    setForm({ expense_type: t.expense_type, category: t.category, sub_category: t.sub_category ?? '', default_amount: String(t.default_amount), note: t.note ?? '' })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.category.trim()) { setError('กรุณาระบุหมวดหมู่'); return }
    setSaving(true)
    const body = { ...form, default_amount: parseFloat(form.default_amount) || 0 }
    const res = editTemplate
      ? await fetch(`/api/finance/recurring/${editTemplate.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/finance/recurring', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowModal(false); load() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  const toggleActive = async (t: Template) => {
    await fetch(`/api/finance/recurring/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: t.is_active ? 0 : 1 })
    })
    load()
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/finance/recurring/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    load()
  }

  if (authLoading || loading) {
    return <div className="page-container text-center text-gray-400 pt-20">⏳ กำลังโหลด...</div>
  }
  if (!user) return null

  const fixed = templates.filter(t => t.expense_type === 'fixed')
  const variable = templates.filter(t => t.expense_type === 'variable')

  const TemplateList = ({ items, label }: { items: Template[]; label: string }) => (
    <div className="card space-y-2">
      <h3 className="font-semibold text-gray-700 mb-3">{label}</h3>
      {items.length === 0 && <p className="text-gray-400 text-sm text-center py-4">ไม่มีรายการ</p>}
      {items.map(t => (
        <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg border ${t.is_active ? 'border-gray-100 bg-gray-50' : 'border-dashed border-gray-200 bg-white opacity-50'}`}>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-800">
              {CATEGORY_LABELS[t.category] || t.category}
              {t.sub_category && <span className="text-gray-500 ml-1">· {t.sub_category}</span>}
            </div>
            <div className="text-xs text-gray-500">
              ยอดเริ่มต้น: {t.default_amount.toLocaleString('th-TH')} บาท
              {t.note && ` · ${t.note}`}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <button onClick={() => toggleActive(t)} className={`text-xs px-2 py-1 rounded-full border ${t.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
              {t.is_active ? 'เปิด' : 'ปิด'}
            </button>
            <button onClick={() => openEdit(t)} className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1">แก้ไข</button>
            <button onClick={() => setConfirmDeleteId(t.id)} className="text-red-400 hover:text-red-600 text-xs px-2 py-1">ลบ</button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายจ่ายประจำ (Template)</h1>
          <p className="text-sm text-gray-500 mt-0.5">กำหนด template เพื่อนำเข้ารายจ่ายประจำในแต่ละเดือน</p>
        </div>
        <button onClick={openAdd} className="btn-primary">+ เพิ่ม Template</button>
      </div>

      <div className="form-grid-2">
        <TemplateList items={fixed} label="💳 รายจ่ายคงที่ (Fixed)" />
        <TemplateList items={variable} label="📊 รายจ่ายผันแปร (Variable)" />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editTemplate ? 'แก้ไข Template' : 'เพิ่ม Template ใหม่'}</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <select value={form.expense_type} onChange={e => setForm(f => ({ ...f, expense_type: e.target.value }))}>
                  <option value="fixed">รายจ่ายคงที่</option>
                  <option value="variable">รายจ่ายผันแปร</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ <span className="text-red-500">*</span></label>
                <select value={CATEGORY_LABELS[form.category] ? form.category : 'other'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">-- เลือกหมวดหมู่ --</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {(!CATEGORY_LABELS[form.category] || form.category === 'other') && (
                  <input className="mt-2" type="text" placeholder="ระบุหมวดหมู่" value={form.category === 'other' ? '' : form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <input type="text" placeholder="เช่น Toyota Hilux" value={form.sub_category} onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเริ่มต้น (บาท)</label>
                <input type="number" min="0" placeholder="0" value={form.default_amount} onChange={e => setForm(f => ({ ...f, default_amount: e.target.value }))} />
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

      {/* Confirm delete */}
      {confirmDeleteId !== null && (
        <div className="modal-backdrop">
          <div className="modal-panel p-6 space-y-4">
            <p className="text-gray-800 font-medium">ยืนยันการลบ Template นี้?</p>
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
