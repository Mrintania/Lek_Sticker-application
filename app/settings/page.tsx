'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAttendanceStore } from '@/store/attendanceStore'
import { WorkSettings, Holiday } from '@/lib/types'
import { THAI_DAYS } from '@/lib/formatters'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import FileUpload from '@/components/upload/FileUpload'

// ── Accordion wrapper ──────────────────────────────────────────────────────────
function AccordionSection({
  id, title, subtitle, icon, open, onToggle, children, borderColor = 'border-gray-200',
}: {
  id: string; title: string; subtitle?: string; icon: string
  open: boolean; onToggle: (id: string) => void; children: React.ReactNode
  borderColor?: string
}) {
  return (
    <div className={`border-2 ${borderColor} rounded-xl overflow-hidden`}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{title}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 bg-white border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, loadSettings, clearAttendance } = useAttendanceStore()
  const { user } = useCurrentUser()
  const [form, setForm] = useState<WorkSettings>({ ...settings })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Accordion open state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['system']))
  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Reset scan data
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Holiday management
  const currentYear = new Date().getFullYear()
  const [holidayYear, setHolidayYear] = useState(currentYear)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayMsg, setHolidayMsg] = useState('')
  const [showAddForm, setShowAddForm] = useState<'thai_national' | 'company' | null>(null)
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })

  const loadHolidays = useCallback(() => {
    fetch(`/api/holidays?year=${holidayYear}`)
      .then(r => r.json()).then(setHolidays).catch(() => {})
  }, [holidayYear])

  useEffect(() => { loadHolidays() }, [loadHolidays])

  async function toggleHoliday(h: Holiday) {
    await fetch(`/api/holidays/${h.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: h.is_active ? 0 : 1 }),
    })
    loadHolidays()
  }

  async function addHoliday(type: 'thai_national' | 'company') {
    if (!newHoliday.date || !newHoliday.name) return
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newHoliday, type }),
    })
    if (res.ok) {
      setNewHoliday({ date: '', name: '' })
      setShowAddForm(null)
      loadHolidays()
      setHolidayMsg('✅ เพิ่มวันหยุดแล้ว')
      setTimeout(() => setHolidayMsg(''), 2500)
    } else {
      const d = await res.json()
      setHolidayMsg(`❌ ${d.error}`)
      setTimeout(() => setHolidayMsg(''), 3000)
    }
  }

  async function deleteHoliday(id: number) {
    if (!confirm('ลบวันหยุดนี้?')) return
    await fetch(`/api/holidays/${id}`, { method: 'DELETE' })
    loadHolidays()
  }

  useEffect(() => { loadSettings() }, [])

  useEffect(() => { setForm({ ...settings }) }, [settings])

  async function handleResetScans() {
    setResetting(true)
    setResetMsg(null)
    try {
      const res = await fetch('/api/admin/reset-scans', { method: 'DELETE', headers: { 'X-Confirm-Reset': 'yes' } })
      const data = await res.json()
      if (res.ok) {
        clearAttendance()
        setResetMsg({ type: 'success', text: data.message })
        setShowResetModal(false)
        setResetConfirmText('')
      } else {
        setResetMsg({ type: 'error', text: data.error ?? 'เกิดข้อผิดพลาด' })
      }
    } catch {
      setResetMsg({ type: 'error', text: 'เชื่อมต่อไม่ได้' })
    } finally {
      setResetting(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await loadSettings()
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  function toggleWorkDay(day: number) {
    setForm((f) => ({
      ...f,
      workDays: f.workDays.includes(day)
        ? f.workDays.filter((d) => d !== day)
        : [...f.workDays, day].sort(),
    }))
  }

  const canEdit = user?.role === 'admin'
  const canViewHolidays = user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="page-container max-w-2xl space-y-3">
      {/* Page header */}
      <div className="mb-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">ตั้งค่าระบบ</h2>
        <p className="text-gray-500 mt-1 text-sm">กำหนดเวลาทำงานและเกณฑ์ต่างๆ</p>
        {!canEdit && <p className="text-yellow-600 text-sm mt-1">⚠️ เฉพาะ Admin เท่านั้นที่สามารถแก้ไขการตั้งค่าได้</p>}
      </div>

      {/* ── Section 1: การตั้งค่าระบบ ── */}
      <AccordionSection
        id="system"
        icon="⚙️"
        title="การตั้งค่าระบบ"
        subtitle="เวลาทำงาน เกณฑ์การประเมิน และวันทำงาน"
        open={openSections.has('system')}
        onToggle={toggleSection}
      >
        {/* Work Hours */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">⏰ เวลาทำงาน</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่มงาน</label>
              <input type="time" value={form.workStartTime}
                onChange={(e) => setForm({ ...form, workStartTime: e.target.value })}
                className="w-full" disabled={!canEdit} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเลิกงาน</label>
              <input type="time" value={form.workEndTime}
                onChange={(e) => setForm({ ...form, workEndTime: e.target.value })}
                className="w-full" disabled={!canEdit} />
            </div>
          </div>
          <p className="text-xs text-gray-400">ปัจจุบัน: {form.workStartTime} - {form.workEndTime} น.</p>
        </div>

        {/* Thresholds */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">📏 เกณฑ์การประเมิน</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาผ่อนผัน (สาย) นาที</label>
              <input type="number" value={form.lateThresholdMinutes}
                onChange={(e) => setForm({ ...form, lateThresholdMinutes: Number(e.target.value) })}
                min={0} max={60} className="w-full" disabled={!canEdit} />
              <p className="text-xs text-gray-400 mt-1">
                สแกนเข้าหลัง {form.workStartTime} เกิน {form.lateThresholdMinutes} นาที = มาสาย
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ออกก่อนเวลา (นาที)</label>
              <input type="number" value={form.earlyLeaveThresholdMinutes}
                onChange={(e) => setForm({ ...form, earlyLeaveThresholdMinutes: Number(e.target.value) })}
                min={0} max={120} className="w-full" disabled={!canEdit} />
              <p className="text-xs text-gray-400 mt-1">
                สแกนออกก่อน {form.workEndTime} เกิน {form.earlyLeaveThresholdMinutes} นาที = ออกก่อนเวลา
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ชั่วโมงขั้นต่ำ (ชม.)</label>
              <input type="number" value={form.minWorkHours}
                onChange={(e) => setForm({ ...form, minWorkHours: Number(e.target.value) })}
                min={0} max={12} step={0.5} className="w-full" disabled={!canEdit} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เกณฑ์ครึ่งวัน (ชม.)</label>
              <input type="number" value={form.halfDayHours}
                onChange={(e) => setForm({ ...form, halfDayHours: Number(e.target.value) })}
                min={0} max={8} step={0.5} className="w-full" disabled={!canEdit} />
              <p className="text-xs text-gray-400 mt-1">ทำงานน้อยกว่า {form.halfDayHours} ชม. = ครึ่งวัน</p>
            </div>
          </div>
        </div>

        {/* Work Days */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">📅 วันทำงาน</h4>
          <div className="flex gap-3 flex-wrap">
            {THAI_DAYS.map((day, idx) => (
              <label key={idx} className={`flex items-center gap-2 ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-75'}`}>
                <input type="checkbox" checked={form.workDays.includes(idx)}
                  onChange={() => toggleWorkDay(idx)}
                  className="w-4 h-4 text-blue-600 rounded" disabled={!canEdit} />
                <span className="text-sm font-medium text-gray-700">{day}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">วันที่ไม่ได้เลือกจะไม่นับเป็นวันขาดงาน</p>
        </div>

        {/* Single Scan Policy */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-1">🔍 การจัดการสแกนครั้งเดียว</h4>
          <p className="text-sm text-gray-500">วันที่พนักงานสแกนเพียงครั้งเดียว (ไม่มีบันทึกออก)</p>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-75'}`}>
              <input type="radio" value="checkin_only"
                checked={form.singleScanPolicy === 'checkin_only'}
                onChange={() => setForm({ ...form, singleScanPolicy: 'checkin_only' })}
                className="w-4 h-4 text-blue-600" disabled={!canEdit} />
              <div>
                <p className="text-sm font-medium text-gray-700">บันทึกเป็นเวลาเข้า (แนะนำ)</p>
                <p className="text-xs text-gray-400">แสดงสถานะ "ไม่มีบันทึกออก" และบันทึกเวลาเข้า</p>
              </div>
            </label>
            <label className={`flex items-center gap-3 ${canEdit ? 'cursor-pointer' : 'cursor-default opacity-75'}`}>
              <input type="radio" value="ignore"
                checked={form.singleScanPolicy === 'ignore'}
                onChange={() => setForm({ ...form, singleScanPolicy: 'ignore' })}
                className="w-4 h-4 text-blue-600" disabled={!canEdit} />
              <div>
                <p className="text-sm font-medium text-gray-700">ไม่นับ (ข้ามข้อมูล)</p>
                <p className="text-xs text-gray-400">ไม่แสดงวันที่มีสแกนเพียงครั้งเดียว</p>
              </div>
            </label>
          </div>
        </div>

        {/* Save button */}
        {canEdit && (
          <div className="flex items-center gap-3 pt-1">
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">✓ บันทึกแล้ว (ข้อมูลจะถูกคำนวณใหม่)</span>}
          </div>
        )}
      </AccordionSection>

      {/* ── Section 2: วันหยุด ── */}
      {canViewHolidays && (
        <AccordionSection
          id="holidays"
          icon="📅"
          title="วันหยุด"
          subtitle="วันหยุดนักขัตฤกษ์ไทยและวันหยุดบริษัท"
          open={openSections.has('holidays')}
          onToggle={toggleSection}
        >
          {/* Year selector */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">กรองตามปี</p>
            <select
              value={holidayYear}
              onChange={(e) => setHolidayYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {holidayMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${holidayMsg.startsWith('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {holidayMsg}
            </div>
          )}

          {/* Thai National Holidays */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">🇹🇭 วันหยุดนักขัตฤกษ์ไทย</h4>
              {canEdit && (
                <button
                  className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                  onClick={() => { setShowAddForm(showAddForm === 'thai_national' ? null : 'thai_national'); setNewHoliday({ date: '', name: '' }) }}
                >
                  + เพิ่ม
                </button>
              )}
            </div>

            {showAddForm === 'thai_national' && (
              <div className="flex gap-2 p-3 bg-blue-50 rounded-lg flex-wrap">
                <input type="date" value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <input type="text" placeholder="ชื่อวันหยุด" value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  onClick={() => addHoliday('thai_national')}>บันทึก</button>
                <button className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                  onClick={() => setShowAddForm(null)}>ยกเลิก</button>
              </div>
            )}

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {holidays.filter((h) => h.type === 'thai_national').length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">ไม่มีวันหยุดนักขัตฤกษ์สำหรับปี {holidayYear}</p>
              ) : holidays.filter((h) => h.type === 'thai_national').map((h) => (
                <div key={h.id} className={`flex items-center justify-between px-3 py-2 ${h.is_active ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="flex-1">
                    <span className={`text-sm ${h.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{h.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{h.date}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => toggleHoliday(h)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${h.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={h.is_active ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${h.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Company Holidays */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">🏢 วันหยุดบริษัท</h4>
              {canEdit && (
                <button
                  className="text-xs px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
                  onClick={() => { setShowAddForm(showAddForm === 'company' ? null : 'company'); setNewHoliday({ date: '', name: '' }) }}
                >
                  + เพิ่มวันหยุดบริษัท
                </button>
              )}
            </div>

            {showAddForm === 'company' && (
              <div className="flex gap-2 p-3 bg-green-50 rounded-lg flex-wrap">
                <input type="date" value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input type="text" placeholder="ชื่อวันหยุด เช่น วันหยุดพิเศษ" value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <button className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  onClick={() => addHoliday('company')}>บันทึก</button>
                <button className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                  onClick={() => setShowAddForm(null)}>ยกเลิก</button>
              </div>
            )}

            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {holidays.filter((h) => h.type === 'company').length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">ยังไม่มีวันหยุดบริษัทสำหรับปี {holidayYear}</p>
              ) : holidays.filter((h) => h.type === 'company').map((h) => (
                <div key={h.id} className="flex items-center justify-between px-3 py-2 bg-white">
                  <div className="flex-1">
                    <span className="text-sm text-gray-800">{h.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{h.date}</span>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteHoliday(h.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="ลบวันหยุดนี้">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>
      )}

      {/* ── Section 3: อัพโหลดข้อมูล ── */}
      {canEdit && (
        <AccordionSection
          id="upload"
          icon="📤"
          title="นำเข้าข้อมูลการสแกน"
          subtitle="อัปโหลดไฟล์ .xlsx จากเครื่องสแกนลายนิ้วมือ"
          open={openSections.has('upload')}
          onToggle={toggleSection}
        >
          <FileUpload />
        </AccordionSection>
      )}

      {/* ── Section 4: Danger Zone ── */}
      {canEdit && (
        <AccordionSection
          id="danger"
          icon="⚠️"
          title="Danger Zone"
          subtitle="ล้างข้อมูลการสแกนและเงินเดือนทั้งหมด"
          open={openSections.has('danger')}
          onToggle={toggleSection}
          borderColor="border-red-200"
        >
          <p className="text-sm text-red-600">
            ใช้เมื่อต้องการล้างข้อมูลการสแกนทั้งหมดแล้วนำเข้าไฟล์ใหม่จากเครื่องสแกนนิ้ว
          </p>

          {resetMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${resetMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {resetMsg.type === 'success' ? '✅' : '❌'} {resetMsg.text}
            </div>
          )}

          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">ล้างข้อมูลสแกนทั้งหมด</p>
              <p className="text-xs text-gray-500 mt-0.5">
                ลบข้อมูลสแกนนิ้ว, ประวัตินำเข้า และข้อมูลเงินเดือนทั้งหมด
                (ข้อมูลพนักงาน, ใบลา, ผู้ใช้งาน และการตั้งค่าจะยังคงอยู่)
              </p>
            </div>
            <button
              className="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              onClick={() => { setShowResetModal(true); setResetConfirmText(''); setResetMsg(null) }}
            >
              🗑️ ล้างข้อมูล
            </button>
          </div>
        </AccordionSection>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">⚠️</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">ยืนยันการล้างข้อมูล</h3>
                <p className="text-sm text-red-600">การกระทำนี้ไม่สามารถยกเลิกได้</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
              <p className="font-medium">ข้อมูลที่จะถูกลบ:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600">
                <li>ข้อมูลสแกนนิ้วทั้งหมด (raw_scans)</li>
                <li>ประวัติการนำเข้าไฟล์ (scan_imports)</li>
                <li>ข้อมูลเงินเดือนที่คำนวณไว้ (payroll_records)</li>
              </ul>
              <p className="font-medium mt-2">ข้อมูลที่ยังคงอยู่:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5 text-green-700">
                <li>ข้อมูลพนักงาน</li>
                <li>ใบลาและการอนุมัติ</li>
                <li>ผู้ใช้งานระบบ</li>
                <li>การตั้งค่าต่างๆ</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                พิมพ์ <span className="font-mono font-bold text-red-600">ยืนยันลบข้อมูล</span> เพื่อยืนยัน
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="ยืนยันลบข้อมูล"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => { setShowResetModal(false); setResetConfirmText('') }}
                disabled={resetting}
              >ยกเลิก</button>
              <button
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                onClick={handleResetScans}
                disabled={resetConfirmText !== 'ยืนยันลบข้อมูล' || resetting}
              >
                {resetting ? '⏳ กำลังลบ...' : '🗑️ ลบข้อมูลทั้งหมด'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
