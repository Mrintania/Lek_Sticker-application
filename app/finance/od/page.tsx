'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatCurrency, THAI_MONTHS } from '@/lib/formatters'
import { THAI_BANKS } from '@/lib/banks'

interface OdAccount {
  id: number; bank_name: string; account_number: string
  credit_limit: number; interest_rate: number; is_active: number
  latest_balance_used: number | null; latest_interest: number | null
  latest_year: number | null; latest_month: number | null
}

interface OdEntry {
  id: number; od_account_id: number; year: number; month: number
  balance_used: number; interest_amount: number; payment_amount: number
  note: string | null; entry_date: string
}

export default function OdPage() {
  const { user, loading: authLoading } = useCurrentUser()
  const now = new Date()
  const [accounts, setAccounts] = useState<OdAccount[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [entries, setEntries] = useState<OdEntry[]>([])
  const [entryYear, setEntryYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [editAccount, setEditAccount] = useState<OdAccount | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [accountForm, setAccountForm] = useState({ bank_name: '', account_number: '', credit_limit: '', interest_rate: '' })
  const [entryForm, setEntryForm] = useState({ year: '', month: '', balance_used: '', interest_amount: '', payment_amount: '', note: '', entry_date: '' })
  const [computedInterest, setComputedInterest] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEscapeKey(() => {
    if (showAccountModal) setShowAccountModal(false)
    else if (showEntryModal) setShowEntryModal(false)
    else if (confirmDeleteId !== null) setConfirmDeleteId(null)
  }, showAccountModal || showEntryModal || confirmDeleteId !== null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finance/od')
    if (res.ok) setAccounts(await res.json())
    setLoading(false)
  }, [])

  const loadEntries = useCallback(async (id: number) => {
    const res = await fetch(`/api/finance/od/${id}/entries?year=${entryYear}`)
    if (res.ok) setEntries(await res.json())
  }, [entryYear])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { if (selectedId) loadEntries(selectedId) }, [selectedId, loadEntries])

  const selectedAccount = accounts.find(a => a.id === selectedId)

  const openAddAccount = () => {
    setEditAccount(null)
    setAccountForm({ bank_name: '', account_number: '', credit_limit: '', interest_rate: '' })
    setError('')
    setShowAccountModal(true)
  }

  const openEditAccount = (a: OdAccount) => {
    setEditAccount(a)
    setAccountForm({ bank_name: a.bank_name, account_number: a.account_number, credit_limit: String(a.credit_limit), interest_rate: String(a.interest_rate) })
    setError('')
    setShowAccountModal(true)
  }

  const handleSaveAccount = async () => {
    if (!accountForm.bank_name || !accountForm.account_number) { setError('กรุณาระบุชื่อธนาคารและเลขบัญชี'); return }
    setSaving(true)
    const body = { bank_name: accountForm.bank_name, account_number: accountForm.account_number, credit_limit: parseFloat(accountForm.credit_limit) || 0, interest_rate: parseFloat(accountForm.interest_rate) || 0 }
    const res = editAccount
      ? await fetch(`/api/finance/od/${editAccount.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/finance/od', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowAccountModal(false); loadAccounts() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  const handleDeleteAccount = async (id: number) => {
    await fetch(`/api/finance/od/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    if (selectedId === id) setSelectedId(null)
    loadAccounts()
  }

  const openAddEntry = () => {
    if (!selectedAccount) return
    const rate = selectedAccount.interest_rate
    setEntryForm({ year: String(now.getFullYear()), month: String(now.getMonth() + 1), balance_used: '', interest_amount: '', payment_amount: '', note: '', entry_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01` })
    setComputedInterest('')
    setError('')
    setShowEntryModal(true)
    void rate
  }

  const handleBalanceUsedChange = (val: string) => {
    setEntryForm(f => ({ ...f, balance_used: val }))
    if (selectedAccount && val) {
      const ci = parseFloat(val) * selectedAccount.interest_rate / 12 / 100
      setComputedInterest(ci.toFixed(2))
      setEntryForm(f => ({ ...f, interest_amount: ci.toFixed(2) }))
    }
  }

  const handleSaveEntry = async () => {
    if (!selectedId || !entryForm.year || !entryForm.month || entryForm.balance_used === '' || !entryForm.entry_date) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน'); return
    }
    setSaving(true)
    const body = { year: parseInt(entryForm.year), month: parseInt(entryForm.month), balance_used: parseFloat(entryForm.balance_used), interest_amount: parseFloat(entryForm.interest_amount) || undefined, payment_amount: parseFloat(entryForm.payment_amount) || 0, note: entryForm.note, entry_date: entryForm.entry_date }
    const res = await fetch(`/api/finance/od/${selectedId}/entries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowEntryModal(false); loadEntries(selectedId); loadAccounts() }
    else { const d = await res.json(); setError(d.error || 'เกิดข้อผิดพลาด') }
    setSaving(false)
  }

  const getBankBg = (name: string) => THAI_BANKS.find(b => name.toLowerCase().includes(b.id) || name.includes(b.shortName))?.bgColor || '#6b7280'

  if (authLoading || loading) return <div className="page-container text-center text-gray-400 pt-20">⏳ กำลังโหลด...</div>
  if (!user) return null
  const canEdit = user.role === 'admin' || user.role === 'manager'

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">บัญชี OD</h1>
          <p className="text-sm text-gray-500 mt-0.5">ติดตามยอด OD แยกตามธนาคาร</p>
        </div>
        {canEdit && <button onClick={openAddAccount} className="btn-primary">+ เพิ่มธนาคาร</button>}
      </div>

      {accounts.length === 0 ? (
        <div className="card text-center text-gray-400 py-10">ยังไม่มีบัญชี OD</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(a => (
            <div key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
              className={`card cursor-pointer transition-all hover:shadow-md ${selectedId === a.id ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: getBankBg(a.bank_name) }}>
                    {a.bank_name.substring(0, 3)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{a.bank_name}</div>
                    <div className="text-xs text-gray-400">···{a.account_number.slice(-4)}</div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditAccount(a)} className="text-blue-400 hover:text-blue-600 p-1 text-xs">✏️</button>
                    <button onClick={() => setConfirmDeleteId(a.id)} className="text-red-400 hover:text-red-600 p-1 text-xs">🗑️</button>
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">วงเงิน OD</div>
                  <div className="font-semibold text-gray-700">{formatCurrency(a.credit_limit)}</div>
                </div>
                <div>
                  <div className="text-gray-400">อัตราดอกเบี้ย</div>
                  <div className="font-semibold text-gray-700">{a.interest_rate}% ต่อปี</div>
                </div>
                <div>
                  <div className="text-gray-400">ยอดใช้ล่าสุด</div>
                  <div className="font-semibold text-red-600">{a.latest_balance_used != null ? formatCurrency(a.latest_balance_used) : '-'}</div>
                </div>
                <div>
                  <div className="text-gray-400">ดอกเบี้ยล่าสุด</div>
                  <div className="font-semibold text-orange-600">{a.latest_interest != null ? formatCurrency(a.latest_interest) : '-'}</div>
                </div>
              </div>
              {a.latest_year && <div className="mt-2 text-xs text-gray-400 text-right">{THAI_MONTHS[(a.latest_month ?? 1) - 1]} {a.latest_year}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Entry history */}
      {selectedId && selectedAccount && (
        <div className="card !p-0">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div>
              <span className="font-semibold text-gray-700 text-sm">ประวัติ OD — {selectedAccount.bank_name}</span>
              <select className="ml-3 !w-auto text-xs" value={entryYear} onChange={e => setEntryYear(parseInt(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {canEdit && <button onClick={openAddEntry} className="btn-primary text-xs py-1">+ บันทึกยอด</button>}
          </div>
          {entries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มีประวัติ</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">เดือน/ปี</th>
                    <th className="table-header text-right">ยอดใช้ OD</th>
                    <th className="table-header text-right">ดอกเบี้ย</th>
                    <th className="table-header text-right">ชำระ</th>
                    <th className="table-header">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="table-cell">{THAI_MONTHS[e.month - 1]} {e.year}</td>
                      <td className="table-cell text-right font-medium text-red-600">{formatCurrency(e.balance_used)}</td>
                      <td className="table-cell text-right text-orange-600">{formatCurrency(e.interest_amount)}</td>
                      <td className="table-cell text-right text-green-600">{e.payment_amount > 0 ? formatCurrency(e.payment_amount) : '-'}</td>
                      <td className="table-cell text-gray-500">{e.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowAccountModal(false) }}>
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editAccount ? 'แก้ไขบัญชี OD' : 'เพิ่มบัญชี OD'}</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร <span className="text-red-500">*</span></label>
                <select value={THAI_BANKS.find(b => b.name === accountForm.bank_name)?.id || '_custom'}
                  onChange={e => {
                    const b = THAI_BANKS.find(x => x.id === e.target.value)
                    setAccountForm(f => ({ ...f, bank_name: b ? b.name : '' }))
                  }}>
                  <option value="">-- เลือกธนาคาร --</option>
                  {THAI_BANKS.map(b => <option key={b.id} value={b.id}>{b.name} ({b.shortName})</option>)}
                  <option value="_custom">ระบุเอง</option>
                </select>
                {!THAI_BANKS.find(b => b.name === accountForm.bank_name) && (
                  <input className="mt-2" type="text" placeholder="ชื่อธนาคาร" value={accountForm.bank_name} onChange={e => setAccountForm(f => ({ ...f, bank_name: e.target.value }))} />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี <span className="text-red-500">*</span></label>
                <input type="text" placeholder="เช่น 123-4-56789-0" value={accountForm.account_number} onChange={e => setAccountForm(f => ({ ...f, account_number: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วงเงิน OD (บาท)</label>
                  <input type="number" min="0" placeholder="0" value={accountForm.credit_limit} onChange={e => setAccountForm(f => ({ ...f, credit_limit: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">อัตราดอกเบี้ย (% ต่อปี)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={accountForm.interest_rate} onChange={e => setAccountForm(f => ({ ...f, interest_rate: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAccountModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleSaveAccount} disabled={saving} className="btn-primary">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowEntryModal(false) }}>
          <div className="modal-panel">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">บันทึกยอด OD — {selectedAccount?.bank_name}</h2>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div className="form-grid-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
                  <input type="number" value={entryForm.year} onChange={e => setEntryForm(f => ({ ...f, year: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
                  <select value={entryForm.month} onChange={e => setEntryForm(f => ({ ...f, month: e.target.value }))}>
                    {THAI_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดใช้ OD (บาท) <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={entryForm.balance_used} onChange={e => handleBalanceUsedChange(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ดอกเบี้ยเดือนนี้ (บาท)
                  {computedInterest && <span className="text-xs text-gray-400 ml-1">(คำนวณอัตโนมัติ — แก้ไขได้)</span>}
                </label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={entryForm.interest_amount} onChange={e => setEntryForm(f => ({ ...f, interest_amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ยอดชำระ (บาท)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={entryForm.payment_amount} onChange={e => setEntryForm(f => ({ ...f, payment_amount: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันที่บันทึก <span className="text-red-500">*</span></label>
                <input type="date" value={entryForm.entry_date} onChange={e => setEntryForm(f => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                <input type="text" placeholder="หมายเหตุ" value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowEntryModal(false)} className="btn-secondary">ยกเลิก</button>
              <button onClick={handleSaveEntry} disabled={saving} className="btn-primary">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete account */}
      {confirmDeleteId !== null && (
        <div className="modal-backdrop">
          <div className="modal-panel p-6 space-y-4">
            <p className="text-gray-800 font-medium">ยืนยันการปิดบัญชี OD นี้?</p>
            <p className="text-sm text-gray-500">ประวัติการบันทึกจะยังคงอยู่</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">ยกเลิก</button>
              <button onClick={() => handleDeleteAccount(confirmDeleteId)} className="btn-danger">ปิดบัญชี</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
