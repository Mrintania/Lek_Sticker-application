'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ImportResult {
  fileName: string
  totalRecords: number
  addedRecords: number
  skippedDuplicates: number
  dateRangeStart: string
  dateRangeEnd: string
}

export default function FileUpload() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/scans', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล')
        return
      }
      setResult({
        fileName: file.name,
        totalRecords: data.totalRecords,
        addedRecords: data.addedRecords,
        skippedDuplicates: data.skippedDuplicates,
        dateRangeStart: data.dateRangeStart,
        dateRangeEnd: data.dateRangeEnd,
      })
    } catch {
      setError('เกิดข้อผิดพลาดในการอ่านไฟล์')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">{loading ? '⏳' : '📂'}</div>
        <p className="text-base sm:text-lg font-semibold text-gray-700">
          {loading ? 'กำลังนำเข้าข้อมูล...' : 'ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
        </p>
        <p className="text-sm text-gray-400 mt-2">รองรับไฟล์ .xlsx ที่ export จากเครื่องสแกนลายนิ้วมือ</p>
        <p className="text-xs text-gray-400 mt-1">ข้อมูลที่เคย Import แล้วจะไม่ถูก Import ซ้ำ</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div className="card border-green-100 bg-green-50">
          <h3 className="font-semibold text-green-800 mb-3">✅ นำเข้าข้อมูลสำเร็จ</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-green-700">{result.addedRecords}</p>
              <p className="text-xs text-green-600 mt-1">บันทึกใหม่</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-gray-500">{result.skippedDuplicates}</p>
              <p className="text-xs text-gray-500 mt-1">ข้อมูลซ้ำ (ข้าม)</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-sm font-bold text-blue-700">{result.dateRangeStart}</p>
              <p className="text-xs text-gray-400">ถึง</p>
              <p className="text-sm font-bold text-blue-700">{result.dateRangeEnd}</p>
            </div>
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => router.push('/dashboard')}
          >
            ดูรายงาน →
          </button>
        </div>
      )}
    </div>
  )
}
