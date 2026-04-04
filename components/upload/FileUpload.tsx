'use client'
import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ScanPreviewResult } from '@/app/api/scans/preview/route'

interface ImportResult {
  fileName: string
  totalRecords: number
  addedRecords: number
  skippedDuplicates: number
  dateRangeStart: string
  dateRangeEnd: string
}

type Step = 'idle' | 'previewing' | 'confirm' | 'importing' | 'done'

function formatDateThai(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${Number(d)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`
}

export default function FileUpload() {
  const [step, setStep] = useState<Step>('idle')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ScanPreviewResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    if (!file.name.match(/\.xlsx?$/i)) {
      setError('กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น')
      return
    }
    setError(null)
    setPreview(null)
    setResult(null)
    setStep('previewing')
    setPendingFile(file)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/scans/preview', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการอ่านไฟล์')
        setStep('idle')
        return
      }
      setPreview(data as ScanPreviewResult)
      setStep('confirm')
    } catch {
      setError('เกิดข้อผิดพลาดในการอ่านไฟล์')
      setStep('idle')
    }
  }

  async function handleConfirm() {
    if (!pendingFile) return
    setStep('importing')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      const res = await fetch('/api/scans', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล')
        setStep('confirm')
        return
      }
      setResult({
        fileName: pendingFile.name,
        totalRecords: data.totalRecords,
        addedRecords: data.addedRecords,
        skippedDuplicates: data.skippedDuplicates,
        dateRangeStart: data.dateRangeStart,
        dateRangeEnd: data.dateRangeEnd,
      })
      setStep('done')
    } catch {
      setError('เกิดข้อผิดพลาดในการนำเข้าข้อมูล')
      setStep('confirm')
    }
  }

  function handleCancel() {
    setStep('idle')
    setPreview(null)
    setPendingFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && (step === 'confirm' || step === 'previewing')) handleCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step])

  function handleReset() {
    setStep('idle')
    setPreview(null)
    setResult(null)
    setPendingFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isPreviewing = step === 'previewing'
  const isImporting = step === 'importing'
  const isBusy = isPreviewing || isImporting

  return (
    <div className="space-y-4">
      {/* ── Drop Zone (hidden while confirming/done) ── */}
      {step !== 'confirm' && step !== 'done' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isBusy
              ? 'border-blue-300 bg-blue-50 cursor-not-allowed'
              : dragging
                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          onClick={() => !isBusy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!isBusy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (isBusy) return
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
        >
          {isBusy ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
              <p className="text-base font-semibold text-blue-700">
                {isPreviewing ? 'กำลังวิเคราะห์ไฟล์...' : 'กำลังนำเข้าข้อมูล...'}
              </p>
              <p className="text-sm text-blue-400">กรุณารอสักครู่</p>
            </div>
          ) : (
            <>
              <div className="text-5xl mb-3">📂</div>
              <p className="text-base sm:text-lg font-semibold text-gray-700">
                ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
              </p>
              <p className="text-sm text-gray-400 mt-2">รองรับไฟล์ .xlsx ที่ export จากเครื่องสแกนลายนิ้วมือ</p>
              <p className="text-xs text-gray-400 mt-1">ข้อมูลที่เคย Import แล้วจะไม่ถูก Import ซ้ำ</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── Confirmation Dialog ── */}
      {step === 'confirm' && preview && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-amber-900">ยืนยันการนำเข้าข้อมูล</p>
              <p className="text-xs text-amber-600 mt-0.5 truncate max-w-xs">{preview.fileName}</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-700">{preview.totalRecords.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">รายการทั้งหมด</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{preview.newRecords.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">จะถูกเพิ่มใหม่</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-400">{preview.duplicates.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">ซ้ำ (จะข้าม)</p>
              </div>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 rounded-xl text-sm">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-blue-700 font-medium">
                {formatDateThai(preview.dateRangeStart)}
                {preview.dateRangeStart !== preview.dateRangeEnd && (
                  <> &nbsp;—&nbsp; {formatDateThai(preview.dateRangeEnd)}</>
                )}
              </span>
            </div>

            {/* Employee list */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                พนักงานในไฟล์ ({preview.employees.length} คน)
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {preview.employees.map(emp => (
                  <div key={emp.employeeId} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                        {emp.department && (
                          <p className="text-xs text-gray-400 truncate">{emp.department}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-500 flex-shrink-0 ml-2 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                      {emp.scanCount} scan
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning if all duplicates */}
            {preview.newRecords === 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                ข้อมูลทั้งหมดในไฟล์นี้ถูกนำเข้าแล้ว ไม่มีข้อมูลใหม่
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirm}
              disabled={preview.newRecords === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: preview.newRecords === 0 ? '#9ca3af' : 'linear-gradient(135deg, #0d9488, #0891b2)' }}
            >
              ✓ ยืนยันนำเข้า {preview.newRecords > 0 ? `${preview.newRecords.toLocaleString()} รายการ` : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Success Result ── */}
      {step === 'done' && result && (
        <div className="bg-white border border-green-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 bg-green-50 border-b border-green-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-green-900">นำเข้าข้อมูลสำเร็จ</p>
              <p className="text-xs text-green-600 mt-0.5 truncate max-w-xs">{result.fileName}</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{result.addedRecords.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">บันทึกใหม่</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-400">{result.skippedDuplicates.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">ข้อมูลซ้ำ (ข้าม)</p>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <p className="text-sm font-bold text-blue-600">{formatDateThai(result.dateRangeStart)}</p>
                {result.dateRangeStart !== result.dateRangeEnd && (
                  <>
                    <p className="text-xs text-gray-400">ถึง</p>
                    <p className="text-sm font-bold text-blue-600">{formatDateThai(result.dateRangeEnd)}</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                นำเข้าไฟล์ใหม่
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
                onClick={() => router.push('/dashboard')}
              >
                ดูรายงาน →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
