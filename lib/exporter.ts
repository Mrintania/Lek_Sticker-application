import ExcelJS from 'exceljs'
import { AttendanceRecord, WeeklySummary, MonthlySummary, STATUS_LABELS } from './types'
import { formatThaiDateShort, formatThaiMonthYear, formatTime, formatHours, formatMinutes, formatCurrency } from './formatters'

const STATUS_BG: Record<string, string> = {
  present: 'FFD4EDDA',
  late: 'FFFFF3CD',
  earlyLeave: 'FFFDE8D8',
  halfDay: 'FFEEE5F7',
  noCheckout: 'FFF1F3F4',
  absent: 'FFF8D7DA',
}

function styleHeader(ws: ExcelJS.Worksheet, row: number, colCount: number) {
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(row, c)
    cell.font = { bold: true, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
  }
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let maxLen = 10
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length
      if (len > maxLen) maxLen = len
    })
    col.width = Math.min(maxLen + 4, 40)
  })
}

async function toBuffer(wb: ExcelJS.Workbook): Promise<void> {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = wb.title + '.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportDailyReport(records: AttendanceRecord[], date: string) {
  const wb = new ExcelJS.Workbook()
  wb.title = `รายงานรายวัน_${date}`
  const ws = wb.addWorksheet('รายงานรายวัน')

  // Title row
  ws.mergeCells('A1:H1')
  ws.getCell('A1').value = `รายงานการเข้างาน วันที่ ${formatThaiDateShort(date)}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.addRow([])

  const headers = ['#', 'ชื่อ', 'เวลาเข้า', 'เวลาออก', 'ชั่วโมงทำงาน', 'สาย (นาที)', 'สถานะ', 'จำนวนสแกน']
  ws.addRow(headers)
  styleHeader(ws, 3, headers.length)

  records.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      r.name,
      formatTime(r.checkIn),
      formatTime(r.checkOut),
      r.workHours != null ? parseFloat(r.workHours.toFixed(2)) : '-',
      r.lateMinutes > 0 ? r.lateMinutes : 0,
      STATUS_LABELS[r.status],
      r.scanCount,
    ])
    const bgColor = STATUS_BG[r.status]
    if (bgColor) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      })
    }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(4).alignment = { horizontal: 'center' }
    row.getCell(7).alignment = { horizontal: 'center' }
  })

  autoWidth(ws)
  await toBuffer(wb)
}

export async function exportWeeklyReport(summary: WeeklySummary[], weekDates: string[], year: number, week: number) {
  const wb = new ExcelJS.Workbook()
  wb.title = `รายงานรายสัปดาห์_${year}_W${week}`
  const ws = wb.addWorksheet('สรุปรายสัปดาห์')

  ws.mergeCells('A1:G1')
  ws.getCell('A1').value = `รายงานการเข้างาน สัปดาห์ที่ ${week}/${year}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.addRow([])

  const headers = ['ชื่อ', 'มาทำงาน', 'มาสาย', 'ขาดงาน', 'ไม่มีบันทึกออก', 'รวมชม.', 'เฉลี่ยชม./วัน']
  ws.addRow(headers)
  styleHeader(ws, 3, headers.length)

  summary.forEach((emp) => {
    ws.addRow([
      emp.name,
      emp.daysPresent,
      emp.daysLate,
      emp.daysAbsent,
      emp.daysNoCheckout,
      emp.totalWorkHours,
      emp.avgWorkHours,
    ])
  })

  autoWidth(ws)
  await toBuffer(wb)
}

export async function exportMonthlyReport(summary: MonthlySummary[], year: number, month: number) {
  const wb = new ExcelJS.Workbook()
  wb.title = `รายงานรายเดือน_${formatThaiMonthYear(year, month)}`

  // Sheet 1: Summary
  const ws1 = wb.addWorksheet('สรุปรายเดือน')
  ws1.mergeCells('A1:J1')
  ws1.getCell('A1').value = `รายงานการเข้างาน ${formatThaiMonthYear(year, month)}`
  ws1.getCell('A1').font = { bold: true, size: 14 }
  ws1.getCell('A1').alignment = { horizontal: 'center' }
  ws1.addRow([])

  const hasPayData = summary.some((e) => e.estimatedPay !== undefined)
  const headers1 = [
    'ชื่อ', 'ประเภท', 'วันทำงาน', 'มาทำงาน', 'สาย', 'ขาดงาน', 'รวมชม.', 'มาทำงาน%', 'ตรงเวลา%',
    ...(hasPayData ? ['ค่าจ้าง (บาท)'] : []),
  ]
  ws1.addRow(headers1)
  styleHeader(ws1, 3, headers1.length)

  summary.forEach((emp) => {
    const row = ws1.addRow([
      emp.name,
      emp.employmentType === 'daily' ? 'รายวัน' : emp.employmentType === 'monthly' ? 'รายเดือน' : '-',
      emp.workingDaysInMonth,
      emp.daysPresent,
      emp.daysLate,
      emp.daysAbsent,
      emp.totalWorkHours,
      parseFloat(emp.attendanceRate.toFixed(1)),
      parseFloat(emp.punctualityRate.toFixed(1)),
      ...(hasPayData ? [emp.estimatedPay ?? '-'] : []),
    ])
    // Color attendance rate
    const rateCell = row.getCell(8)
    if (emp.attendanceRate < 75) rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
    else if (emp.attendanceRate < 90) rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
    else rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
  })

  autoWidth(ws1)

  // Sheet 2: Late detail
  const lateEmps = summary.filter((e) => e.totalLateMinutes > 0)
  if (lateEmps.length > 0) {
    const ws2 = wb.addWorksheet('รายละเอียดการมาสาย')
    ws2.addRow(['ชื่อ', 'จำนวนวันที่สาย', 'รวมเวลาสาย (นาที)', 'เฉลี่ยสาย/วัน (นาที)'])
    styleHeader(ws2, 1, 4)
    lateEmps.sort((a, b) => b.totalLateMinutes - a.totalLateMinutes).forEach((emp) => {
      ws2.addRow([
        emp.name,
        emp.daysLate,
        emp.totalLateMinutes,
        emp.daysLate > 0 ? Math.round(emp.totalLateMinutes / emp.daysLate) : 0,
      ])
    })
    autoWidth(ws2)
  }

  await toBuffer(wb)
}

export async function exportEmployeeReport(records: AttendanceRecord[], employeeId: string, name: string) {
  const wb = new ExcelJS.Workbook()
  wb.title = `รายงานพนักงาน_${name}`
  const ws = wb.addWorksheet('ประวัติการเข้างาน')

  ws.mergeCells('A1:F1')
  ws.getCell('A1').value = `ประวัติการเข้างาน: ${name}`
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.getCell('A1').alignment = { horizontal: 'center' }
  ws.addRow([])

  const headers = ['วันที่', 'เวลาเข้า', 'เวลาออก', 'ชั่วโมงทำงาน', 'สาย (นาที)', 'สถานะ']
  ws.addRow(headers)
  styleHeader(ws, 3, headers.length)

  ;[...records].reverse().forEach((r) => {
    const row = ws.addRow([
      formatThaiDateShort(r.date),
      formatTime(r.checkIn),
      formatTime(r.checkOut),
      r.workHours != null ? parseFloat(r.workHours.toFixed(2)) : '-',
      r.lateMinutes > 0 ? r.lateMinutes : 0,
      STATUS_LABELS[r.status],
    ])
    const bgColor = STATUS_BG[r.status]
    if (bgColor) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      })
    }
  })

  autoWidth(ws)
  await toBuffer(wb)
}
