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
  const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  const dateObj = new Date(dateStr + 'T00:00:00')
  return {
    day: thaiDays[dateObj.getDay()],
    full: `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`,
  }
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
  const [records, setRecords] = useState<Record<number, ProductionRecord>>({})
  const [savingAssignment, setSavingAssignment] = useState<number | null>(null)
  const [savingRecord, setSavingRecord] = useState<number | null>(null)
  const [assignmentEdits, setAssignmentEdits] = useState<Record<number, { slot1: string; slot2: string }>>({})
  const [itemEdits, setItemEdits] = useState<Record<number, ProductionItem[]>>({})
  const [notesEdits, setNotesEdits] = useState<Record<number, string>>({})
  const [saveMsg, setSaveMsg] = useState<Record<number, string>>({})
  const [asgMsg, setAsgMsg] = useState<Record<number, string>>({})
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
      const asgMap: Record<number, { slot1: string; slot2: string }> = {}
      for (const a of asgns) {
        if (!asgMap[a.machine_id]) asgMap[a.machine_id] = { slot1: '', slot2: '' }
        if (a.slot === 1) asgMap[a.machine_id].slot1 = a.employee_id
        if (a.slot === 2) asgMap[a.machine_id].slot2 = a.employee_id
      }
      setAssignmentEdits(asgMap)

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

  useEffect(() => { loadMachines() }, [loadMachines])
  useEffect(() => { if (machines.length > 0 || selectedDate) loadDayData(selectedDate) }, [selectedDate, loadDayData])

  function getAssignmentForMachine(machineId: number) {
    return assignmentEdits[machineId] ?? { slot1: '', slot2: '' }
  }

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
    items[idx] = { ...items[idx], [field]: value }
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
    setAsgMsg(p => ({ ...p, [machineId]: '✓' }))
    setTimeout(() => setAsgMsg(p => ({ ...p, [machineId]: '' })), 2000)
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
    if (!confirm('ลบบันทึกงานของแท่นนี้?')) return
    await fetch(`/api/production/records/${record.id}`, { method: 'DELETE' })
    loadDayData(selectedDate)
  }

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
    if (res.ok) { loadMachines(); setMachineForm(EMPTY_MACHINE_FORM) }
    else { const d = await res.json(); setMachineFormError(d.error || 'เกิดข้อผิดพลาด') }
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
  const { day, full } = formatDateThai(selectedDate)
  const isToday = selectedDate === todayStr()

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">บันทึกงานผลิต</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            รวมทั้งวัน&nbsp;
            <span className={`font-bold ${totalToday > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
              {totalToday.toLocaleString()} ชิ้น
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowMachineModal(true); setMachineForm(EMPTY_MACHINE_FORM); setMachineFormError('') }}
            className="btn-secondary text-sm !px-3"
            title="จัดการแท่นพิมพ์"
          >
            <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            แท่นพิมพ์
          </button>
          <a href="/production/dashboard" className="btn-secondary text-sm !px-3">
            <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      {/* ── Date Navigator ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <label className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer hover:border-teal-300 transition-colors">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg">{day}</span>
              <span className="font-semibold text-gray-800">{full}</span>
              {isToday && (
                <span className="text-xs font-semibold text-white bg-teal-500 px-2 py-0.5 rounded-lg">วันนี้</span>
              )}
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="sr-only"
          />
        </label>

        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayStr())}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors"
          >
            ไปวันนี้
          </button>
        )}
      </div>

      {/* ── Machine Cards ── */}
      {machines.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🖨️</div>
          <p className="font-semibold text-gray-700">ยังไม่มีแท่นพิมพ์</p>
          <p className="text-sm text-gray-400 mt-1">กดปุ่ม "แท่นพิมพ์" เพื่อเพิ่มแท่นพิมพ์ใหม่</p>
        </div>
      ) : (
        <div className="space-y-4">
          {machines.map((machine) => {
            const asg = getAssignmentForMachine(machine.id)
            const items = getItemsForMachine(machine.id)
            const record = records[machine.id]
            const isSaved = !!(record?.id)
            const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
            const msg = saveMsg[machine.id]
            const assignMsg = asgMsg[machine.id]

            // Employee name helpers
            const emp1 = employees.find(e => e.employeeId === asg.slot1)
            const emp2 = employees.find(e => e.employeeId === asg.slot2)

            return (
              <div
                key={machine.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 transition-all ${
                  isSaved ? 'border-l-teal-400 border border-teal-100' : 'border-l-gray-200 border border-gray-100'
                }`}
              >
                {/* ── Card Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Machine code badge */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      isSaved ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {machine.code.replace(/[^0-9]/g, '') || machine.code.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 text-sm">{machine.code}</span>
                        <span className="text-gray-500 text-sm truncate">{machine.name}</span>
                      </div>
                      {isSaved && record.totalQuantity !== undefined && record.totalQuantity > 0 && (
                        <p className="text-xs text-teal-600 font-semibold mt-0.5">
                          ✓ บันทึกแล้ว · {record.totalQuantity.toLocaleString()} ชิ้น
                        </p>
                      )}
                      {!isSaved && (
                        <p className="text-xs text-gray-400 mt-0.5">ยังไม่ได้บันทึก</p>
                      )}
                    </div>
                  </div>
                  {isSaved && (
                    <button
                      onClick={() => deleteRecord(machine.id)}
                      className="flex-shrink-0 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                    >
                      ลบ
                    </button>
                  )}
                </div>

                <div className="divide-y divide-gray-50">
                  {/* ── Assignment Section ── */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">👥 พนักงาน</p>
                      <button
                        onClick={() => saveAssignment(machine.id)}
                        disabled={savingAssignment === machine.id}
                        className="text-xs text-teal-600 hover:text-teal-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50"
                      >
                        {savingAssignment === machine.id ? 'กำลังบันทึก...' : assignMsg ? `บันทึกแล้ว ${assignMsg}` : 'บันทึกการมอบหมาย'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2].map((slot) => {
                        const currentVal = slot === 1 ? asg.slot1 : asg.slot2
                        const currentEmp = slot === 1 ? emp1 : emp2
                        const usedIds = getUsedEmployeeIds(machine.id, slot)
                        return (
                          <div key={slot} className="relative">
                            <label className="block text-xs text-gray-400 mb-1">คนที่ {slot}</label>
                            <div className="relative">
                              {currentEmp && (
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-bold pointer-events-none z-10">
                                  {currentEmp.name.charAt(0)}
                                </div>
                              )}
                              <select
                                className={`w-full text-sm border border-gray-200 rounded-xl py-2 pr-3 bg-white focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all ${currentEmp ? 'pl-9' : 'pl-3'}`}
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
                                    <option key={emp.employeeId} value={emp.employeeId} disabled={isUsedElsewhere}>
                                      {emp.name}{isUsedElsewhere ? ' (ถูกมอบหมายแล้ว)' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Production Items ── */}
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">📦 รายการผลงาน</p>

                    {/* Column headers */}
                    {items.some(i => i.model_name || i.quantity) && (
                      <div className="grid gap-2 mb-1 px-0.5" style={{ gridTemplateColumns: '1fr 6rem 1.5rem' }}>
                        <span className="text-xs text-gray-400">ชื่อรุ่น</span>
                        <span className="text-xs text-gray-400 text-right">จำนวน (ชิ้น)</span>
                        <span />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {items.map((item, idx) => (
                        <div key={idx} className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 6rem 1.5rem' }}>
                          <input
                            type="text"
                            placeholder="ชื่อรุ่น"
                            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none w-full transition-all"
                            value={item.model_name}
                            onChange={(e) => updateItem(machine.id, idx, 'model_name', e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="0"
                            className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-right focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none w-full transition-all"
                            min={0}
                            value={item.quantity}
                            onChange={(e) => updateItem(machine.id, idx, 'quantity', e.target.value)}
                          />
                          <button
                            onClick={() => removeItem(machine.id, idx)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addItem(machine.id)}
                      className="mt-2.5 flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      เพิ่มรุ่น
                    </button>
                  </div>

                  {/* ── Notes ── */}
                  <div className="px-4 py-3">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📝 หมายเหตุ</label>
                    <input
                      type="text"
                      placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none transition-all"
                      value={notesEdits[machine.id] ?? ''}
                      onChange={(e) => setNotesEdits(prev => ({ ...prev, [machine.id]: e.target.value }))}
                    />
                  </div>

                  {/* ── Save Footer ── */}
                  <div className="px-4 py-3 bg-gray-50/60 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {totalQty > 0 && (
                        <p className="text-sm font-bold text-teal-700">รวม {totalQty.toLocaleString()} ชิ้น</p>
                      )}
                      {msg && (
                        <p className={`text-xs font-medium mt-0.5 ${msg.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
                          {msg}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => saveRecord(machine.id)}
                      disabled={savingRecord === machine.id}
                      className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isSaved
                          ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-sm shadow-teal-200'
                          : 'bg-gray-800 hover:bg-gray-900 text-white shadow-sm'
                      } disabled:opacity-60`}
                    >
                      {savingRecord === machine.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                          {isSaved ? 'อัปเดตงาน' : 'บันทึกงาน'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Machine Management Modal ── */}
      {showMachineModal && (
        <div className="modal-backdrop" onClick={() => { setShowMachineModal(false); setMachineForm(EMPTY_MACHINE_FORM) }}>
          <div className="modal-panel sm:max-w-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">จัดการแท่นพิมพ์</h3>
                <p className="text-xs text-gray-400 mt-0.5">เพิ่ม แก้ไข หรือปิดใช้งานแท่นพิมพ์</p>
              </div>
              <button
                onClick={() => { setShowMachineModal(false); setMachineForm(EMPTY_MACHINE_FORM) }}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Form */}
              <div className={`p-4 rounded-2xl space-y-3 ${machineForm.id ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'}`}>
                <p className="text-sm font-semibold text-gray-700">
                  {machineForm.id ? `✏️ แก้ไข: ${machineForm.code} – ${machineForm.name}` : '➕ เพิ่มแท่นพิมพ์ใหม่'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">รหัสแท่น *</label>
                    <input type="text" placeholder="เช่น M01" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
                      value={machineForm.code}
                      onChange={e => setMachineForm(f => ({ ...f, code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">ชื่อแท่นพิมพ์ *</label>
                    <input type="text" placeholder="เช่น แท่นพิมพ์ 1" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
                      value={machineForm.name}
                      onChange={e => setMachineForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">คำอธิบาย (ถ้ามี)</label>
                    <input type="text" placeholder="รายละเอียดเพิ่มเติม" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:ring-2 focus:ring-blue-300 outline-none"
                      value={machineForm.description}
                      onChange={e => setMachineForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                {machineFormError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {machineFormError}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveMachine} disabled={savingMachine}
                    className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
                    {savingMachine ? 'กำลังบันทึก...' : machineForm.id ? 'บันทึกการแก้ไข' : '+ เพิ่มแท่น'}
                  </button>
                  {machineForm.id && (
                    <button onClick={() => { setMachineForm(EMPTY_MACHINE_FORM); setMachineFormError('') }}
                      className="btn-secondary text-sm py-2 px-3">ยกเลิก</button>
                  )}
                </div>
              </div>

              {/* Machine list */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">แท่นพิมพ์ทั้งหมด</p>
                <div className="space-y-2">
                  {allMachines.map((m) => (
                    <div key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-opacity ${
                        m.isActive ? 'border-gray-100 bg-white' : 'border-gray-100 bg-gray-50 opacity-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        m.isActive ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {m.code.replace(/[^0-9]/g, '') || m.code.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800 text-sm">{m.code}</span>
                          <span className="text-gray-500 text-sm truncate">{m.name}</span>
                          {!m.isActive && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">ปิด</span>}
                        </div>
                        {m.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{m.description}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setMachineForm({ id: m.id, code: m.code, name: m.name, description: m.description ?? '' }); setMachineFormError('') }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="แก้ไข"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => toggleMachineActive(m)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            m.isActive
                              ? 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'
                              : 'text-green-500 hover:text-green-700 hover:bg-green-50'
                          }`}
                          title={m.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
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
        </div>
      )}
    </div>
  )
}
