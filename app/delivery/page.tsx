'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface DeliveryItemForm {
  model_name: string
  quantity: number | string
  destination: string
}

interface DeliveryRecord {
  id?: number
  date: string
  notes: string | null
  items: DeliveryItemForm[]
  totalQuantity?: number
}

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

const EMPTY_ITEM: DeliveryItemForm = { model_name: '', quantity: '', destination: '' }

const thaiMonthsFull = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function buildCalendarDays(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

export default function DeliveryPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [record, setRecord] = useState<DeliveryRecord | null>(null)
  const [itemEdits, setItemEdits] = useState<DeliveryItemForm[]>([{ ...EMPTY_ITEM }])
  const [notesEdit, setNotesEdit] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveMsgType, setSaveMsgType] = useState<'success' | 'error'>('success')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  useEscapeKey(() => setDeleteTarget(null), deleteTarget !== null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarYM, setCalendarYM] = useState(() => todayStr().slice(0, 7))
  const [recordedDates, setRecordedDates] = useState<Set<string>>(new Set())
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && user && !['admin', 'manager'].includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  const loadDayData = useCallback((date: string) => {
    fetch(`/api/delivery?date=${date}`)
      .then(r => r.json())
      .then((data: (DeliveryRecord & { items: { model_name: string; quantity: number; destination: string | null }[] })[]) => {
        if (data.length > 0) {
          const rec = data[0]
          setRecord(rec)
          setItemEdits(rec.items.map(i => ({
            model_name: i.model_name,
            quantity: i.quantity,
            destination: i.destination ?? '',
          })))
          setNotesEdit(rec.notes ?? '')
        } else {
          setRecord(null)
          setItemEdits([{ ...EMPTY_ITEM }])
          setNotesEdit('')
        }
      })
  }, [])

  useEffect(() => { loadDayData(selectedDate) }, [selectedDate, loadDayData])

  // Fetch recorded dates for calendar
  useEffect(() => {
    if (!showCalendar) return
    const [y, m] = calendarYM.split('-')
    const lastDay = new Date(Number(y), Number(m), 0).getDate()
    const from = `${calendarYM}-01`
    const to   = `${calendarYM}-${String(lastDay).padStart(2, '0')}`
    fetch(`/api/delivery?date_from=${from}&date_to=${to}`)
      .then(r => r.json())
      .then((data: { date: string }[]) => {
        setRecordedDates(new Set(data.map(d => d.date)))
      })
      .catch(() => {})
  }, [showCalendar, calendarYM])

  useEffect(() => {
    if (!showCalendar) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowCalendar(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showCalendar])

  function addRow() { setItemEdits(prev => [...prev, { ...EMPTY_ITEM }]) }

  function removeRow(i: number) {
    if (itemEdits.length === 1) return
    setItemEdits(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof DeliveryItemForm, value: string) {
    setItemEdits(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  async function handleSave() {
    const validItems = itemEdits.filter(i => Number(i.quantity) > 0)
    if (validItems.length === 0) {
      setSaveMsg('กรุณากรอกจำนวนอย่างน้อย 1 รายการ')
      setSaveMsgType('error')
      setTimeout(() => setSaveMsg(''), 3000)
      return
    }
    setSaving(true)
    const res = await fetch('/api/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        notes: notesEdit || undefined,
        items: validItems.map(i => ({ quantity: Number(i.quantity) })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('บันทึกแล้ว ✓')
      setSaveMsgType('success')
      loadDayData(selectedDate)
    } else {
      const d = await res.json()
      setSaveMsg(d.error || 'เกิดข้อผิดพลาด')
      setSaveMsgType('error')
    }
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function handleDelete(id: number) {
    setDeleting(true)
    const res = await fetch(`/api/delivery/${id}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    if (res.ok) {
      setRecord(null)
      setItemEdits([{ ...EMPTY_ITEM }])
      setNotesEdit('')
    }
  }

  function openCalendar() {
    setCalendarYM(selectedDate.slice(0, 7))
    setShowCalendar(true)
  }

  function prevCalMonth() {
    const [y, m] = calendarYM.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextCalMonth() {
    const [y, m] = calendarYM.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  if (loading) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>
  if (!user || !['admin', 'manager'].includes(user.role)) return null

  const today = todayStr()
  const isToday = selectedDate === today
  const { day, full } = formatDateThai(selectedDate)
  const isSaved = !!(record?.id)
  const totalQty = itemEdits.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const calDays = buildCalendarDays(calendarYM)
  const [calY, calM] = calendarYM.split('-').map(Number)

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">บันทึกงานส่ง</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {isSaved ? (
              <span className="text-emerald-600 font-semibold">
                ✓ บันทึกแล้ว · {record.totalQuantity?.toLocaleString() ?? totalQty.toLocaleString()} ชิ้น
              </span>
            ) : 'ยังไม่มีการบันทึก'}
          </p>
        </div>
        <a
          href="/delivery/dashboard"
          className="btn-secondary text-sm !px-3 flex items-center gap-1.5 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Dashboard
        </a>
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

        <button
          onClick={openCalendar}
          className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm cursor-pointer hover:border-emerald-300 transition-colors text-left"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{day}</span>
              <span className="font-semibold text-gray-800">{full}</span>
              {isToday && (
                <span className="text-xs font-semibold text-white bg-emerald-500 px-2 py-0.5 rounded-lg">วันนี้</span>
              )}
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

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
            onClick={() => setSelectedDate(today)}
            className="text-sm text-emerald-600 hover:text-emerald-800 font-medium px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            ไปวันนี้
          </button>
        )}
      </div>

      {/* ── Record Card ── */}
      <div className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 transition-all ${
        isSaved ? 'border-l-emerald-400 border border-emerald-100' : 'border-l-gray-200 border border-gray-100'
      }`}>
        {/* Card Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
              isSaved ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              🚚
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">รายการส่งสินค้า</p>
              {isSaved ? (
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  ✓ บันทึกแล้ว · {(record.totalQuantity ?? 0).toLocaleString()} ชิ้น
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">ยังไม่ได้บันทึก</p>
              )}
            </div>
          </div>
          {isSaved && (
            <button
              onClick={() => setDeleteTarget(record.id!)}
              className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors font-medium flex-shrink-0"
            >
              ลบ
            </button>
          )}
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Column headers — desktop only */}
          <div className="hidden sm:grid gap-2 px-0.5 text-xs text-gray-400" style={{ gridTemplateColumns: '1fr 1.75rem' }}>
            <span className="text-right">จำนวน (ชิ้น)</span>
            <span />
          </div>

          {/* Item rows */}
          <div className="space-y-2">
            {itemEdits.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0"
                  min={0}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 text-right focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none w-full transition-all"
                  value={item.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)}
                />
                <button
                  onClick={() => removeRow(idx)}
                  disabled={itemEdits.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add row */}
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-semibold px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มรายการ
          </button>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">หมายเหตุ</label>
            <input
              type="text"
              placeholder="หมายเหตุเพิ่มเติม (ไม่บังคับ)"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none transition-all"
              value={notesEdit}
              onChange={e => setNotesEdit(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {totalQty > 0 && (
              <p className="text-sm font-bold text-emerald-700">รวม {totalQty.toLocaleString()} ชิ้น</p>
            )}
            {saveMsg && (
              <p className={`text-xs font-medium mt-0.5 ${saveMsgType === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {saveMsg}
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-shrink-0 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-colors disabled:opacity-60 active:scale-95"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                กำลังบันทึก...
              </>
            ) : (
              isSaved ? 'อัปเดตงานส่ง' : '💾 บันทึกงานส่ง'
            )}
          </button>
        </div>
      </div>

      {/* ── Calendar Modal ── */}
      {showCalendar && (
        <div className="modal-backdrop" onClick={() => setShowCalendar(false)}>
          <div
            ref={calendarRef}
            className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevCalMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-bold text-gray-800">{thaiMonthsFull[calM]} {calY + 543}</span>
              <button onClick={nextCalMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {calDays.map((dateStr, i) => {
                if (!dateStr) return <div key={i} />
                const isSelected = dateStr === selectedDate
                const isToday2 = dateStr === today
                const hasRecord = recordedDates.has(dateStr)
                const isFuture = dateStr > today
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(dateStr); setShowCalendar(false) }}
                    disabled={isFuture}
                    className={`relative flex flex-col items-center justify-center h-9 w-full rounded-xl text-sm font-medium transition-colors
                      ${isSelected ? 'bg-emerald-500 text-white shadow-md' : ''}
                      ${!isSelected && isToday2 ? 'bg-emerald-50 text-emerald-700 font-bold' : ''}
                      ${!isSelected && !isToday2 && !isFuture ? 'text-gray-700 hover:bg-gray-100' : ''}
                      ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span>{Number(dateStr.split('-')[2])}</span>
                    {hasRecord && (
                      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>มีการบันทึกงานส่งแล้ว</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteTarget !== null && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-gray-900">ยืนยันการลบบันทึก</p>
                <p className="text-sm text-gray-500 mt-1">
                  ต้องการลบบันทึกงานส่งของ<br />
                  <span className="font-semibold text-gray-700">{formatDateThai(selectedDate).full}</span> ใช่ไหม?
                </p>
                <p className="text-xs text-red-400 mt-2 bg-red-50 rounded-lg px-3 py-1.5">ข้อมูลจะถูกลบถาวร ไม่สามารถกู้คืนได้</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleting ? 'กำลังลบ...' : 'ลบบันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
