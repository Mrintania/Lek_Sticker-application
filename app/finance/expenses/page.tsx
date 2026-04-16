'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatCurrency, THAI_MONTHS } from '@/lib/formatters'

/** "2026-04-01" → "01-04-2026" */
function toDisplayDate(s: string): string {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}-${m}-${y}`
}

/** ensure "01-04-2026" or "2026-04-01" → "2026-04-01" for <input type="date"> */
function toInputDate(s: string): string {
  if (!s) return ''
  if (s.includes('-') && s.indexOf('-') === 4) return s // already YYYY-MM-DD
  const [d, m, y] = s.split('-')
  return `${y}-${m}-${d}`
}

const CATEGORY_LABELS: Record<string, string> = {
  car_installment: 'ค่างวดรถ', rent: 'ค่าเช่า', salary_total: 'เงินเดือนรวม',
  insurance: 'ค่าประกัน',
  raw_materials: 'วัตถุดิบ', electricity: 'ค่าไฟ', transport: 'ค่าขนส่ง',
  maintenance: 'ค่าซ่อมบำรุง', ot: 'ค่าโอที', other: 'อื่นๆ',
}

interface ExpenseRecord {
  id: number; year: number; month: number; expense_type: string
  category: string; sub_category: string | null; amount: number
  note: string | null; entry_date: string; from_recurring: number
}

interface Suggestion { id: number; expense_type: string; category: string; sub_category: string | null; default_amount: number }

export default function ExpensesPage() {
  const { user, loading: authLoading } = useCurrentUser()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [filter, setFilter] = useState<'all' | 'fixed' | 'variable'>('all')
  const [records, setRecords] = useState<ExpenseRecord[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRecord, setEditRecord] = useState<ExpenseRecord | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [applying, setApplying] = useState(false)
  useEscapeKey(() => {
    if (showModal) setShowModal(false)
    else if (confirmDeleteId !== null) setConfirmDeleteId(null)
    else if (showApplyConfirm) setShowApplyConfirm(false)
  }, showModal || confirmDeleteId !== null || showApplyConfirm)
  const [form, setForm] = useState({ expense_type: 'fixed', category: '', sub_category: '', amount: '', note: '', entry_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [expRes, sugRes] = await Promise.all([
      fetch(`/api/finance/expenses?year=${year}&month=${month}&limit=200`),
      fetch(`/api/finance/expenses/suggest?year=${year}&month=${month}`)
    ])
    if (expRes.ok) { const d = await expRes.json(); setRecords(d.data || []) }
    if (sugRes.ok) setSuggestions(await sugRes.json())
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? records : records.filter(r => r.expense_type === filter)
  const fixedRecords = records.filter(r => r.expense_type === 'fixed')
  const variableRecords = records.filter(r => r.expense_type === 'variable')
  const totalFixed = fixedRecords.reduce((s, r) => s + r.amount, 0)
  const totalVariable = variableRecords.reduce((s, r) => s + r.amount, 0)

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const openAdd = () => {
    setEditRecord(null)
    setForm({ expense_type: 'fixed', category: '', sub_category: '', amount: '', note: '', entry_date: `${year}-${String(month).padStart(2, '0')}-01` })
    setError('')
    setShowModal(true)
  }

  const openEdit = (r: ExpenseRecord) => {
    setEditRecord(r)
    setForm({ expense_type: r.expense_type, category: r.category, sub_category: r.sub_category ?? '', amount: String(r.amount), note: r.note ?? '', entry_date: toInputDate(r.entry_date) })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.entry_date || !form.amount) { setError('กรุณากรอกข้อมูลให้ครบถ้วน'); return }
    setSaving(true)
    const [ey, em] = form.entry_date.split('-')
    const body = { year: parseInt(ey), month: parseInt(em), expense_type: form.expense_type, category: form.category, sub_category: form.sub_category, amount: parseFloat(form.amount), note: form.note, entry_date: form.entry_date }
    const res = editRecord
      ? await fetch(`/api/finance/expenses/${editRecord.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/finance/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowModal(false); load() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    load()
  }

  const handleApply = async () => {
    setApplying(true)
    const res = await fetch('/api/finance/recurring/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month }) })
    if (res.ok) { setShowApplyConfirm(false); load() }
    setApplying(false)
  }

  if (authLoading) return <div className="page-container text-center text-gray-400 pt-20">⏳ กำลังโหลด...</div>
  if (!user) return null
  const canEdit = user.role === 'admin' || user.role === 'manager'

  const RecordTable = ({ items }: { items: ExpenseRecord[] }) => {
    const [sortKey, setSortKey] = useState<'entry_date' | 'category' | 'amount'>('entry_date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const toggleSort = (key: typeof sortKey) => {
      if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else { setSortKey(key); setSortDir('asc') }
    }
    const sorted = [...items].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'entry_date') cmp = a.entry_date.localeCompare(b.entry_date)
      else if (sortKey === 'category') cmp = (CATEGORY_LABELS[a.category] || a.category).localeCompare(CATEGORY_LABELS[b.category] || b.category, 'th')
      else if (sortKey === 'amount') cmp = a.amount - b.amount
      return sortDir === 'asc' ? cmp : -cmp
    })
    const SortIcon = ({ col }: { col: typeof sortKey }) => (
      <span className="ml-1 text-xs">{sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : <span className="text-gray-300">⇅</span>}</span>
    )
    return (
    <>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="table-header cursor-pointer select-none hover:bg-gray-50" onClick={() => toggleSort('entry_date')}>วันที่<SortIcon col="entry_date" /></th>
              <th className="table-header cursor-pointer select-none hover:bg-gray-50" onClick={() => toggleSort('category')}>หมวดหมู่<SortIcon col="category" /></th>
              <th className="table-header">รายละเอียด</th>
              <th className="table-header text-right cursor-pointer select-none hover:bg-gray-50" onClick={() => toggleSort('amount')}>ยอดเงิน<SortIcon col="amount" /></th>
              {canEdit && <th className="table-header text-center">จัดการ</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="table-cell">{toDisplayDate(r.entry_date)}</td>
                <td className="table-cell">
                  <span className="inline-flex items-center gap-1">
                    {CATEGORY_LABELS[r.category] || r.category}
                    {r.from_recurring === 1 && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ประจำ</span>}
                  </span>
                </td>
                <td className="table-cell text-gray-500">{r.sub_category || r.note || '-'}</td>
                <td className="table-cell text-right font-semibold text-red-600">{formatCurrency(r.amount)}</td>
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
      <div className="sm:hidden divide-y divide-gray-100">
        {sorted.map(r => (
          <div key={r.id} className="p-4 flex justify-between items-start">
            <div>
              <div className="text-sm font-medium text-gray-800">{CATEGORY_LABELS[r.category] || r.category}</div>
              <div className="text-xs text-gray-500">{toDisplayDate(r.entry_date)} {r.sub_category && `· ${r.sub_category}`}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-red-600">{formatCurrency(r.amount)}</div>
              {canEdit && (
                <div className="flex gap-2 mt-1 justify-end">
                  <button onClick={() => openEdit(r)} className="text-blue-500 text-xs">แก้ไข</button>
                  <button onClick={() => setConfirmDeleteId(r.id)} className="text-red-400 text-xs">ลบ</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายจ่าย</h1>
          <p className="text-sm text-gray-500 mt-0.5">{THAI_MONTHS[month - 1]} {year + 543}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="btn-secondary px-2">◀</button>
            <span className="text-sm text-gray-700 font-medium px-2">{THAI_MONTHS[month - 1]} {year}</span>
            <button onClick={nextMonth} className="btn-secondary px-2">▶</button>
          </div>
          {canEdit && suggestions.length > 0 && (
            <button onClick={() => setShowApplyConfirm(true)} className="bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 text-sm font-medium">
              📋 นำเข้าประจำ ({suggestions.length})
            </button>
          )}
          {canEdit && <button onClick={openAdd} className="btn-primary">+ เพิ่มรายจ่าย</button>}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">💳 คงที่</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalFixed)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-gray-500 mb-1">📊 ผันแปร</div>
          <div className="text-lg font-bold text-orange-600">{formatCurrency(totalVariable)}</div>
        </div>
        <div className="stat-card col-span-2">
          <div className="text-xs text-gray-500 mb-1">💸 รายจ่ายรวม</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(totalFixed + totalVariable)}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'fixed', 'variable'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
            {f === 'all' ? 'ทั้งหมด' : f === 'fixed' ? 'คงที่' : 'ผันแปร'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center text-gray-400 py-8">⏳ กำลังโหลด...</div>
      ) : filter === 'all' ? (
        <>
          {fixedRecords.length > 0 && (
            <div className="card !p-0">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">💳 รายจ่ายคงที่</span>
                <span className="ml-2 text-sm text-red-600 font-medium">{formatCurrency(totalFixed)}</span>
              </div>
              <RecordTable items={fixedRecords} />
            </div>
          )}
          {variableRecords.length > 0 && (
            <div className="card !p-0">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span className="font-semibold text-gray-700 text-sm">📊 รายจ่ายผันแปร</span>
                <span className="ml-2 text-sm text-orange-600 font-medium">{formatCurrency(totalVariable)}</span>
              </div>
              <RecordTable items={variableRecords} />
            </div>
          )}
          {records.length === 0 && <div className="card text-center text-gray-400 py-8">ยังไม่มีรายจ่าย</div>}
        </>
      ) : (
        <div className="card !p-0">
          {filtered.length === 0
            ? <div className="p-8 text-center text-gray-400">ไม่มีรายการ</div>
            : <RecordTable items={filtered} />}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editRecord ? 'แก้ไขรายจ่าย' : 'เพิ่มรายจ่าย'}</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <div className="flex gap-2">
                  {['fixed', 'variable'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, expense_type: t }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${form.expense_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
                      {t === 'fixed' ? '💳 คงที่' : '📊 ผันแปร'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่ <span className="text-red-500">*</span></label>
                <select value={CATEGORY_LABELS[form.category] ? form.category : '_custom'}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value === '_custom' ? '' : e.target.value }))}>
                  <option value="">-- เลือกหมวดหมู่ --</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  <option value="_custom">ระบุเอง...</option>
                </select>
                {!CATEGORY_LABELS[form.category] && (
                  <input className="mt-2" type="text" placeholder="ระบุหมวดหมู่" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <input type="text" placeholder="รายละเอียดเพิ่มเติม" value={form.sub_category} onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดเงิน (บาท) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
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

      {/* Apply recurring confirm */}
      {showApplyConfirm && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">นำเข้ารายจ่ายประจำ</h2>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-gray-600 mb-3">จะนำเข้า {suggestions.length} รายการ:</p>
              {suggestions.map(s => (
                <div key={s.id} className="flex justify-between text-sm py-1 border-b border-gray-50">
                  <span className="text-gray-700">{CATEGORY_LABELS[s.category] || s.category} {s.sub_category && `· ${s.sub_category}`}</span>
                  <span className="text-gray-500">{s.default_amount.toLocaleString('th-TH')} บาท</span>
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowApplyConfirm(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleApply} disabled={applying} className="btn-primary">{applying ? 'กำลังนำเข้า...' : 'นำเข้าทั้งหมด'}</button>
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
