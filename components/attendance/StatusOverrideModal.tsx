'use client'
import { useState } from 'react'

interface Props {
  employeeId: string
  employeeName: string
  date: string
  currentStatus: string
  onClose: () => void
  onSaved: () => void
}

const STATUS_OPTIONS = [
  { value: 'present', label: 'มาทำงาน', color: 'text-green-700' },
  { value: 'late', label: 'มาสาย', color: 'text-yellow-700' },
  { value: 'leave_sick_cert', label: 'ลาป่วย (มีใบรับรองแพทย์)', color: 'text-blue-700' },
  { value: 'leave_half_morning', label: 'ลาครึ่งวันเช้า', color: 'text-purple-700' },
  { value: 'leave_half_afternoon', label: 'ลาครึ่งวันบ่าย', color: 'text-purple-700' },
  { value: 'absent', label: 'ขาดงาน', color: 'text-red-700' },
]

export default function StatusOverrideModal({ employeeId, employeeName, date, currentStatus, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState(currentStatus)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/attendance/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, date, overrideStatus: selected, note }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'เกิดข้อผิดพลาด')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">แก้ไขสถานะการเข้างาน</h3>
          <p className="text-sm text-gray-500 mt-1">
            {employeeName} — {date}
          </p>
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">เลือกสถานะใหม่</label>
          {STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
              <input
                type="radio"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className={`text-sm font-medium ${opt.color}`}>{opt.label}</span>
            </label>
          ))}
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full"
              placeholder="เหตุผลในการแก้ไข"
            />
          </div>
          {error && <p className="text-red-600 text-sm">⚠️ {error}</p>}
        </div>
        <div className="p-4 sm:p-6 border-t border-gray-100 flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
