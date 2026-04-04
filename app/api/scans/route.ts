import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { parseExcelFile } from '@/lib/parser'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = 'SELECT * FROM raw_scans WHERE 1=1'
  const params: string[] = []
  if (start) { query += ' AND scan_datetime >= ?'; params.push(start) }
  if (end) { query += ' AND scan_datetime <= ?'; params.push(end + ' 23:59:59') }
  query += ' ORDER BY employee_id, scan_datetime'

  const scans = db.prepare(query).all(...params)
  return NextResponse.json(scans)
}

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'ไฟล์ขนาดใหญ่เกิน 10MB' }, { status: 400 })
  if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ Excel (.xlsx, .xls)' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const records = parseExcelFile(buffer)

  if (records.length === 0) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลในไฟล์' }, { status: 400 })
  }

  const db = getDb()

  // Compute date range
  const dates = records.map((r) => r.datetime.toISOString().slice(0, 10)).sort()
  const dateRangeStart = dates[0]
  const dateRangeEnd = dates[dates.length - 1]

  // Create import record
  const importResult = db.prepare(`INSERT INTO scan_imports (file_name, imported_by, date_range_start, date_range_end, record_count)
    VALUES (?, ?, ?, ?, ?)`).run(file.name, user.username, dateRangeStart, dateRangeEnd, records.length)
  const importId = importResult.lastInsertRowid

  // Insert scans (skip duplicates)
  const insertScan = db.prepare(`INSERT OR IGNORE INTO raw_scans (import_id, employee_id, employee_name, department, scan_datetime, direction, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)

  // Auto-create employees if not exists
  const insertEmp = db.prepare(`INSERT OR IGNORE INTO employees (employee_id, name, department, employment_type)
    VALUES (?, ?, ?, 'daily')`)

  let added = 0
  const insertAll = db.transaction(() => {
    for (const r of records) {
      const dtStr = r.datetime.toISOString().replace('T', ' ').slice(0, 19)
      const result = insertScan.run(importId, r.employeeId, r.name, r.department, dtStr, r.direction, r.recordedBy)
      if (result.changes > 0) added++
      insertEmp.run(r.employeeId, r.name, r.department)
    }
  })
  insertAll()

  logAudit(db, user.username, 'scan.import', 'scan_import', String(importId), {
    fileName: file.name, totalRecords: records.length, addedRecords: added, dateRangeStart, dateRangeEnd,
  }, getIp(req))

  return NextResponse.json({
    success: true,
    importId,
    totalRecords: records.length,
    addedRecords: added,
    skippedDuplicates: records.length - added,
    dateRangeStart,
    dateRangeEnd,
  })
}
