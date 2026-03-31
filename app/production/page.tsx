'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'

interface Machine {
  id: number
  code: string
  name: string
  description: string | null
  isActive: boolean
}

interface Assignment {
  machine_id: number
  date: string
  slot: number
  employee_id: string
  employee_name: string
}

interface ProductionItem {
  model_name: string
  quantity: number | string
}

interface ProductionRecord {
  id?: number
  machine_id: number
  date: string
  notes: string
  items: ProductionItem[]
  totalQuantity?: number
  employees?: { slot: number; employee_id: string; employee_name: string }[]
}

interface Employee {
  employeeId: string
  name: string
}

interface MachineForm {
  id: number | null
  code: string
  name: string
  description: string
}

const EMPTY_MACHINE_FORM: MachineForm = { id: null, code: '', name: '', description: '' }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateThai(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ProductionPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [machines, setMachines] = useState<Machine[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [records, setRecords] = useState<Record<number, ProductionRecord>>({})
  const [savingAssignment, setSavingAssignment] = useState<number | null>(null)
  const [savingRecord, setSavingRecord] = useState<number | null>(null)
  const [assignmentEdits, setAssignmentEdits] = useState<Record<number, { slot1: string; slot2: string }>>({})
  const [itemEdits, setItemEdits] = useState<Record<number, ProductionItem[]>>({})
  const [notesEdits, setNotesEdits] = useState<Record<number, string>>({})
  const [saveMsg, setSaveMsg] = useState<Record<number, string>>({})
  const [showMachineModal, setShowMachineModal] = useState(false)
  const [machineForm, setMachineForm] = useState<MachineForm>(EMPTY_MACHINE_FORM)
  const [machineFormError, setMachineFormError] = useState('')
  const [savingMachine, setSavingMachine] = useState(false)
  const [allMachines, setAllMachines] = useState<Machine[]>([])

  useEffect(() => {
    if (!loading && user && !['admin', 'manager'].includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  const loadMachines = useCallback(() => {
    fetch('/api/production/machines').then(r => r.json()).then((data: Machine[]) => {
      setMachines(data.filter(m => m.isActive))
    })
    fetch('/api/production/machines?includeInactive=true').then(r => r.json()).then(setAllMachines)
    fetch('/api/employees').then(r => r.json()).then(setEmployees)
  }, [])

  const loadDayData = useCallback((date: string) => {
    Promise.all([
      fetch(`/api/production/assignments?date=${date}`).then(r => r.json()),
      fetch(`/api/production/records?date=${date}`).then(r => r.json()),
    ]).then(([asgns, recs]: [Assignment[], ProductionRecord[]]) => {
      setAssignments(asgns)

      // Build assignment edits per machine
      const asgMap: Record<number, { slot1: string; slot2: string }> = {}
      for (const a of asgns) {
        if (!asgMap[a.machine_id]) asgMap[a.machine_id] = { slot1: '', slot2: '' }
        if (a.slot === 1) asgMap[a.machine_id].slot1 = a.employee_id
        if (a.slot === 2) asgMap[a.machine_id].slot2 = a.employee_id
      }
      setAssignmentEdits(asgMap)

      // Build record edits per machine
      const recMap: Record<number, ProductionRecord> = {}
      const itemMap: Record<number, ProductionItem[]> = {}
      const notesMap: Record<number, string> = {}
      for (const r of recs) {
        recMap[r.machine_id] = r
        itemMap[r.machine_id] = r.items.map(i => ({ model_name: i.model_name, quantity: i.quantity }))
        notesMap[r.machine_id] = r.notes || ''
      }
      setRecords(recMap)
      setItemEdits(itemMap)
      setNotesEdits(notesMap)
    })
  }, [])

  useEffect(() => {
    loadMachines()
  }, [loadMachines])

  useEffect(() => {
    if (machines.length > 0 || selectedDate) {
      loadDayData(selectedDate)
    }
  }, [selectedDate, loadDayData])

  function getAssignmentForMachine(machineId: number) {
    return assignmentEdits[machineId] ?? { slot1: '', slot2: '' }
  }

  /** คืน Set ของ employee_id ที่ถูกเลือกในทุก slot/ทุกแท่น ยกเว้น slot นั้นๆ (เพื่อให้ current value ยังเลือกอยู่ได้) */
  function getUsedEmployeeIds(excludeMachineId: number, excludeSlot: number): Set<string> {
    const used = new Set<string>()
    for (const [machId, asg] of Object.entries(assignmentEdits)) {
      const mId = Number(machId)
      if (asg.slot1 && !(mId === excludeMachineId && excludeSlot === 1)) used.add(asg.slot1)
      if (asg.slot2 && !(mId === excludeMachineId && excludeSlot === 2)) used.add(asg.slot2)
    }
    return used
  }

  function getItemsForMachine(machineId: number): ProductionItem[] {
    return itemEdits[machineId] ?? [{ model_name: '', quantity: '' }]
  }

  function setItems(machineId: number, items: ProductionItem[]) {
    setItemEdits(prev => ({ ...prev, [machineId]: items }))
  }

  function addItem(machineId: number) {
    setItems(machineId, [...getItemsForMachine(machineId), { model_name: '', quantity: '' }])
  }

  function removeItem(machineId: number, idx: number) {
    const items = getItemsForMachine(machineId).filter((_, i) => i !== idx)
    setItems(machineId, items.length > 0 ? items : [{ model_name: '', quantity: '' }])
  }

  function updateItem(machineId: number, idx: number, field: keyof ProductionItem, value: string) {
    const items = [...getItemsForMachine(machineId)]
    items[idx] = { ...items[idx], [field]: field === 'quantity' ? value : value }
    setItems(machineId, items)
  }

  async function saveAssignment(machineId: number) {
    setSavingAssignment(machineId)
    const { slot1, slot2 } = getAssignmentForMachine(machineId)
    const asgns = []
    if (slot1) asgns.push({ slot: 1, employee_id: slot1 })
    if (slot2) asgns.push({ slot: 2, employee_id: slot2 })
    await fetch('/api/production/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: machineId, date: selectedDate, assignments: asgns }),
    })
    setSavingAssignment(null)
    loadDayData(selectedDate)
  }

  async function saveRecord(machineId: number) {
    setSavingRecord(machineId)
    const items = getItemsForMachine(machineId)
      .filter(i => i.model_name.toString().trim() && Number(i.quantity) > 0)
      .map(i => ({ model_name: String(i.model_name).trim(), quantity: Number(i.quantity) }))

    const res = await fetch('/api/production/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_id: machineId, date: selectedDate, notes: notesEdits[machineId] || '', items }),
    })
    setSavingRecord(null)
    if (res.ok) {
      setSaveMsg(p => ({ ...p, [machineId]: 'บันทึกแล้ว ✓' }))
      setTimeout(() => setSaveMsg(p => ({ ...p, [machineId]: '' })), 2000)
      loadDayData(selectedDate)
    } else {
      const d = await res.json()
      setSaveMsg(p => ({ ...p, [machineId]: d.error || 'เกิดข้อผิดพลาด' }))
      setTimeout(() => setSaveMsg(p => ({ ...p, [machineId]: '' })), 2500)
    }
  }

  async function deleteRecord(machineId: number) {
    const record = records[machineId]
    if (!record?.id) return
    if (!confirm('ลบบันทึกงานวันนี้ของแท่นนี้?')) return
    await fetch(`/api/production/records/${record.id}`, { method: 'DELETE' })
    loadDayData(selectedDate)
  }

  // Machine management
  async function saveMachine() {
    if (!machineForm.code.trim() || !machineForm.name.trim()) {
      setMachineFormError('กรุณากรอกรหัสและชื่อแท่นพิมพ์')
      return
    }
    setSavingMachine(true)
    setMachineFormError('')
    const url = machineForm.id ? `/api/production/machines/${machineForm.id}` : '/api/production/machines'
    const method = machineForm.id ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: machineForm.code, name: machineForm.name, description: machineForm.description }),
    })
    setSavingMachine(false)
    if (res.ok) {
      loadMachines()
      setMachineForm(EMPTY_MACHINE_FORM)
    } else {
      const d = await res.json()
      setMachineFormError(d.error || 'เกิดข้อผิดพลาด')
    }
  }

  async function toggleMachineActive(m: Machine) {
    await fetch(`/api/production/machines/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !m.isActive }),
    })
    loadMachines()
  }

  if (loading) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>
  if (!user || !['admin', 'manager'].includes(user.role)) return null

  const totalToday = Object.values(records).reduce((s, r) => s + (r.totalQuantity ?? 0), 0)

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">🖨️ บันทึกงานผลิต</h2>
          <p className="text-gray-500 mt-1 text-sm">
            รวมวันนี้ <span className="font-semibold text-teal-700">{totalToday.toLocaleString()} ชิ้น</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowMachineModal(true); setMachineForm(EMPTY_MACHINE_FORM); setMachineFormError('') }}
            className="btn-secondary text-sm"
          >⚙️ จัดการแท่นพิมพ์</button>
          <a href="/production/dashboard" className="btn-secondary text-sm">📦 Dashboard</a>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="btn-secondary px-3 py-2 text-sm">←</button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">{formatDateThai(selectedDate)}</span>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5" />
        </div>
        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="btn-secondary px-3 py-2 text-sm">→</button>
        {selectedDate !== todayStr() && (
          <button onClick={() => setSelectedDate(todayStr())} className="text-sm text-blue-600 hover:text-blue-800">
            วันนี้
          </button>
        )}
      </div>

      {/* Machine cards */}
      {machines.length === 0 ? (
        <div className="card text-center text-gray-400 py-10">
          <p className="text-4xl mb-3">🖨️</p>
          <p className="font-medium">ยังไม่มีแท่นพิมพ์</p>
          <p className="text-sm mt-1">กด "จัดการแท่นพิมพ์" เพื่อเพิ่มแท่นพิมพ์</p>
        </div>
      ) : (
        <div className="space-y-4">
          {machines.map((machine) => {
            const asg = getAssignmentForMachine(machine.id)
            const items = getItemsForMachine(machine.id)
            const record = records[machine.id]
            const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
            const msg = saveMsg[machine.id]

            return (
              <div key={machine.id} className="card !p-0 overflow-hidden">
                {/* Machine header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-teal-800 text-lg">{machine.code}</span>
                    <span className="text-gray-700 font-medium">{machine.name}</span>
                    {record && record.totalQuantity !== undefined && record.totalQuantity > 0 && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
                        {record.totalQuantity.toLocaleString()} ชิ้น
                      </span>
                    )}
                  </div>
                  {record?.id && (
                    <button onClick={() => deleteRecord(machine.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                      ลบบันทึก
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Assignment section */}
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">มอบหมายพนักงาน</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[1, 2].map((slot) => {
                        const currentVal = slot === 1 ? asg.slot1 : asg.slot2
                        const usedIds = getUsedEmployeeIds(machine.id, slot)
                        return (
                        <div key={slot} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0 w-12">Slot {slot}:</span>
                          <select
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                            value={currentVal}
                            onChange={(e) => setAssignmentEdits(prev => ({
                              ...prev,
                              [machine.id]: { ...getAssignmentForMachine(machine.id), [`slot${slot}`]: e.target.value }
                            }))}
                          >
                            <option value="">— ไม่มี —</option>
                            {employees.map(emp => {
                              const isUsedElsewhere = usedIds.has(emp.employeeId)
                              return (
                                <option
                                  key={emp.employeeId}
                                  value={emp.employeeId}
                                  disabled={isUsedElsewhere}
                                  style={isUsedElsewhere ? { color: '#9ca3af' } : undefined}
                                >
                                  {emp.name}{isUsedElsewhere ? ' (ถูกมอบหมายแล้ว)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => saveAssignment(machine.id)}
                      disabled={savingAssignment === machine.id}
                      className="mt-2 text-xs btn-secondary py-1.5 px-3"
                    >
                      {savingAssignment === machine.id ? 'กำลังบันทึก...' : '💾 บันทึกการมอบหมาย'}
                    </button>
                  </div>

                  {/* Production items */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">รายการผลงาน</p>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 5rem auto auto' }}>
                          <input
                            type="text"
                            placeholder="ชื่อรุ่น"
                            className="min-w-0 text-sm"
                            value={item.model_name}
                            onChange={(e) => updateItem(machine.id, idx, 'model_name', e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="จำนวน"
                            className="w-full text-sm text-right"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItem(machine.id, idx, 'quantity', e.target.value)}
                          />
                          <span className="text-xs text-gray-400 whitespace-nowrap">ชิ้น</span>
                          <button onClick={() => removeItem(machine.id, idx)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addItem(machine.id)}
                      className="mt-2 text-xs text-teal-600 hover:text-teal-800 font-medium">
                      + เพิ่มรุ่น
                    </button>

                    {/* Notes */}
                    <input
                      type="text"
                      placeholder="หมายเหตุ (ถ้ามี)"
                      className="mt-3 w-full text-sm text-gray-600"
                      value={notesEdits[machine.id] ?? ''}
                      onChange={(e) => setNotesEdits(prev => ({ ...prev, [machine.id]: e.target.value }))}
                    />

                    {/* Save footer */}
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {totalQty > 0 && (
                          <span className="text-sm font-semibold text-teal-700">รวม {totalQty.toLocaleString()} ชิ้น</span>
                        )}
                        {msg && (
                          <span className={`text-xs ml-2 ${msg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>{msg}</span>
                        )}
                      </div>
                      <button
                        onClick={() => saveRecord(machine.id)}
                        disabled={savingRecord === machine.id}
                        className="btn-primary text-sm py-2 px-4"
                      >
                        {savingRecord === machine.id ? 'กำลังบันทึก...' : '💾 บันทึกงาน'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Machine Management Modal */}
      {showMachineModal && (
        <div className="modal-backdrop">
          <div className="modal-panel sm:max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">⚙️ จัดการแท่นพิมพ์</h3>
              <button onClick={() => { setShowMachineModal(false); setMachineForm(EMPTY_MACHINE_FORM) }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {/* Add/Edit form */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
                <p className="text-sm font-semibold text-blue-800">
                  {machineForm.id ? `✏️ แก้ไข: ${machineForm.code}` : '➕ เพิ่มแท่นพิมพ์ใหม่'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">รหัสแท่น *</label>
                    <input type="text" placeholder="M01" className="w-full text-sm"
                      value={machineForm.code}
                      onChange={e => setMachineForm(f => ({ ...f, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">ชื่อแท่นพิมพ์ *</label>
                    <input type="text" placeholder="แท่นพิมพ์ 1" className="w-full text-sm"
                      value={machineForm.name}
                      onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-600 mb-1 block">คำอธิบาย</label>
                    <input type="text" placeholder="คำอธิบายเพิ่มเติม (ถ้ามี)" className="w-full text-sm"
                      value={machineForm.description}
                      onChange={e => setMachineForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                {machineFormError && <p className="text-xs text-red-500">{machineFormError}</p>}
                <div className="flex gap-2">
                  <button onClick={saveMachine} disabled={savingMachine} className="btn-primary text-sm py-2 px-4">
                    {savingMachine ? 'กำลังบันทึก...' : machineForm.id ? 'บันทึกการแก้ไข' : '+ เพิ่มแท่น'}
                  </button>
                  {machineForm.id && (
                    <button onClick={() => { setMachineForm(EMPTY_MACHINE_FORM); setMachineFormError('') }}
                      className="btn-secondary text-sm py-2 px-3">ยกเลิก</button>
                  )}
                </div>
              </div>

              {/* Machine list */}
              <div className="space-y-2">
                {allMachines.map((m) => (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${m.isActive ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-teal-700 text-sm">{m.code}</span>
                        <span className="text-gray-700 text-sm truncate">{m.name}</span>
                        {!m.isActive && <span className="text-xs text-gray-400">(ปิดใช้งาน)</span>}
                      </div>
                      {m.description && <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setMachineForm({ id: m.id, code: m.code, name: m.name, description: m.description ?? '' }); setMachineFormError('') }}
                        className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => toggleMachineActive(m)}
                        className={`p-1.5 rounded-lg transition-colors ${m.isActive ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`}>
                        {m.isActive ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
