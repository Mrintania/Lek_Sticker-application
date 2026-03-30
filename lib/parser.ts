import * as XLSX from 'xlsx'
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

function parseExcelDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    // Excel serial date
    return XLSX.SSF.parse_date_code(value) as unknown as Date
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function detectHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (row && row.some((cell) => String(cell ?? '').trim() === 'ชื่อ')) {
      return i
    }
  }
  return 0
}

export function parseExcelFile(file: ArrayBuffer): RawScanRecord[] {
  const wb = XLSX.read(file, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' })

  const headerRowIdx = detectHeaderRow(allRows as unknown[][])
  const headers = (allRows[headerRowIdx] as string[]).map((h) => String(h ?? '').trim())

  const records: RawScanRecord[] = []

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i] as unknown[]
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
        obj[field] = val != null ? String(val).trim() : ''
      }
    })

    if (!obj.name || !obj.datetime) continue
    // Use name as fallback employeeId if missing
    if (!obj.employeeId) obj.employeeId = obj.name

    records.push(obj as RawScanRecord)
  }

  return records
}
