import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { parseExcelFile } from '@/lib/parser'

export interface ScanPreviewEmployee {
  employeeId: string
  name: string
  department: string
  scanCount: number
}

export interface ScanPreviewResult {
  fileName: string
  totalRecords: number
  newRecords: number
  duplicates: number
  dateRangeStart: string
  dateRangeEnd: string
  employees: ScanPreviewEmployee[]
}

/** Dry-run: parse xlsx and check for duplicates — does NOT write to DB */
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ALLOWED_MIME_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream',
  ])
  const MAX_FILE_SIZE = 10 * 1024 * 1024

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'ไฟล์ขนาดใหญ่เกิน 10MB' }, { status: 400 })
  console.log('[preview] file:', file.name, 'type:', file.type, 'size:', file.size)
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    console.log('[preview] MIME rejected:', file.type)
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)' }, { status: 400 })
  }

  let records
  try {
    const buffer = await file.arrayBuffer()
    records = await parseExcelFile(buffer)
    console.log('[preview] parsed records:', records.length)
  } catch (err) {
    console.error('[preview] parse error:', err)
    return NextResponse.json({ error: 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์' }, { status: 400 })
  }

  if (records.length === 0) {
    console.log('[preview] records empty')
    return NextResponse.json({ error: 'ไม่พบข้อมูลในไฟล์' }, { status: 400 })
  }

  const db = getDb()
  const checkDup = db.prepare(
    'SELECT 1 FROM raw_scans WHERE employee_id = ? AND scan_datetime = ? LIMIT 1'
  )

  const dates: string[] = []
  const empMap = new Map<string, ScanPreviewEmployee>()
  let duplicates = 0

  for (const r of records) {
    const dtStr = r.datetime.toISOString().replace('T', ' ').slice(0, 19)
    dates.push(dtStr.slice(0, 10))

    const isDup = checkDup.get(r.employeeId, dtStr) != null
    if (isDup) duplicates++

    if (!empMap.has(r.employeeId)) {
      empMap.set(r.employeeId, {
        employeeId: r.employeeId,
        name: r.name,
        department: r.department,
        scanCount: 0,
      })
    }
    empMap.get(r.employeeId)!.scanCount++
  }

  dates.sort()
  const employees = [...empMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'))

  const result: ScanPreviewResult = {
    fileName: file.name,
    totalRecords: records.length,
    newRecords: records.length - duplicates,
    duplicates,
    dateRangeStart: dates[0],
    dateRangeEnd: dates[dates.length - 1],
    employees,
  }

  return NextResponse.json(result)
}
