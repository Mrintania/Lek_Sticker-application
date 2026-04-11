import ExcelJS from 'exceljs'
import { RawScanRecord } from './types'

const COLUMN_MAP: Record<string, keyof RawScanRecord> = {
  'Depart': 'department',
  'ชื่อ': 'name',
  'รหัสที่เครื่อง': 'machineCode',
  'วัน/เวลา': 'datetime',
  'เข้า/ออก': 'direction',
  'หมายเลขเครื่อง': 'deviceId',
  'รหัสพนักงาน': 'employeeId',
  'บันทึกโดย': 'recordedBy',
}

/**
 * ExcelJS reads datetime cells into Date objects where the UTC components
 * equal the Excel-stored LOCAL time (no timezone conversion applied).
 * e.g. Excel shows 08:05 → ExcelJS Date has getUTCHours() = 8
 *
 * The system stores UTC and adds +7h when displaying (toBangkokDate).
 * So we must treat the UTC components as LOCAL time and re-create a proper UTC Date.
 * i.e. 08:05 local (UTC+7) → store as 01:05 UTC → display as 08:05 ✓
 */
function excelDateToUTC(d: Date): Date {
  // Read UTC components from ExcelJS Date (they equal the Excel LOCAL time)
  // Then create a Date treating those values as LOCAL time → JS converts to UTC
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
  )
}

function parseExcelDate(value: ExcelJS.CellValue): Date | null {
  if (!value) return null
  if (value instanceof Date) return excelDateToUTC(value)
  if (typeof value === 'string') {
    // ISO string with Z suffix (already UTC) — apply same local-reinterpretation
    const d = new Date(value)
    if (!isNaN(d.getTime())) return excelDateToUTC(d)
  }
  if (typeof value === 'number') {
    // Excel serial date: fraction × 24 = local hour, treat as local time
    const utc = (value - 25569) * 86400 * 1000
    const d = new Date(utc)
    if (!isNaN(d.getTime())) return excelDateToUTC(d)
  }
  return null
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'text' in (value as object)) {
    return String((value as { text: unknown }).text ?? '').trim()
  }
  return String(value).trim()
}

function detectHeaderRow(rows: ExcelJS.CellValue[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i]?.some((cell) => cellText(cell) === 'ชื่อ')) return i
  }
  return 0
}

export async function parseExcelFile(file: ArrayBuffer): Promise<RawScanRecord[]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(file)
  const ws = wb.worksheets[0]

  const allRows: ExcelJS.CellValue[][] = []
  ws.eachRow({ includeEmpty: false }, (row) => {
    allRows.push(row.values as ExcelJS.CellValue[])
  })

  // ExcelJS row.values is 1-indexed (index 0 is undefined)
  const rows = allRows.map((r) => (Array.isArray(r) ? r.slice(1) : []))

  const headerRowIdx = detectHeaderRow(rows)
  const headers = rows[headerRowIdx].map((h) => cellText(h))

  const records: RawScanRecord[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((cell) => !cell)) continue

    const obj: Partial<RawScanRecord> = {
      department: '',
      name: '',
      machineCode: '',
      datetime: new Date(),
      direction: 'C/In',
      deviceId: '',
      employeeId: '',
      recordedBy: 'FP',
    }

    headers.forEach((header, idx) => {
      const field = COLUMN_MAP[header]
      if (!field) return
      const val = row[idx]
      if (field === 'datetime') {
        const d = parseExcelDate(val)
        if (d) obj.datetime = d
      } else {
        obj[field] = cellText(val)
      }
    })

    if (!obj.name || !obj.datetime) continue
    if (!obj.employeeId) obj.employeeId = obj.name

    records.push(obj as RawScanRecord)
  }

  return records
}
