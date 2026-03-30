import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { buildAttendanceMaster } from '@/lib/processor'
import { RawScanRecord } from '@/lib/types'
import { WorkSettings } from '@/lib/types'

function getSettings(db: ReturnType<typeof getDb>): WorkSettings {
  const s = db.prepare('SELECT * FROM work_settings WHERE id = 1').get() as Record<string, unknown>
  return {
    workStartTime: String(s.work_start_time),
    workEndTime: String(s.work_end_time),
    lateThresholdMinutes: Number(s.late_threshold_minutes),
    earlyLeaveThresholdMinutes: Number(s.early_leave_threshold_minutes),
    minWorkHours: Number(s.min_work_hours),
    halfDayHours: Number(s.half_day_hours),
    workDays: String(s.work_days).split(',').map(Number),
    singleScanPolicy: String(s.single_scan_policy) as WorkSettings['singleScanPolicy'],
  }
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') ?? '2000-01-01'
  const end = searchParams.get('end') ?? '2099-12-31'
  const empId = searchParams.get('employeeId')

  // User role: only see own data
  // If role is 'user' but no employeeId is linked → return nothing (never show all records)
  if (user.role === 'user' && !user.employeeId) {
    return NextResponse.json([])
  }
  let effectiveEmpId = empId
  if (user.role === 'user') {
    effectiveEmpId = user.employeeId ?? null
  }

  let query = `SELECT employee_id, employee_name, department, scan_datetime, direction, recorded_by
    FROM raw_scans WHERE scan_datetime >= ? AND scan_datetime <= ?`
  const params: string[] = [start, end + ' 23:59:59']

  if (effectiveEmpId) {
    // ค้นหาพนักงานคนเดียวเจาะจง — ไม่กรอง is_active (ใช้ดูประวัติย้อนหลังได้)
    query += ' AND employee_id = ?'
    params.push(effectiveEmpId)
  } else {
    // แสดงภาพรวมทุกคน — กรองเฉพาะพนักงาน Active
    query += ' AND employee_id IN (SELECT employee_id FROM employees WHERE is_active = 1)'
  }

  const rawRows = db.prepare(query).all(...params) as {
    employee_id: string; employee_name: string; department: string;
    scan_datetime: string; direction: string; recorded_by: string
  }[]

  const rawScans: RawScanRecord[] = rawRows.map((r) => ({
    employeeId: r.employee_id,
    name: r.employee_name,
    department: r.department || '',
    datetime: new Date(r.scan_datetime.replace(' ', 'T') + 'Z'),
    direction: r.direction,
    deviceId: '',
    machineCode: '',
    recordedBy: r.recorded_by,
  }))

  const settings = getSettings(db)

  // Fetch active holidays in date range
  const activeHolidays = (db.prepare(
    `SELECT date FROM holidays WHERE is_active = 1 AND date >= ? AND date <= ?`
  ).all(start, end) as { date: string }[]).map((h) => h.date)

  let master = buildAttendanceMaster(rawScans, settings)

  // Apply overrides
  const overrides = db.prepare(
    `SELECT * FROM attendance_overrides WHERE date >= ? AND date <= ?${effectiveEmpId ? ' AND employee_id = ?' : ''}`
  ).all(...(effectiveEmpId ? [start, end, effectiveEmpId] : [start, end])) as {
    employee_id: string; date: string; override_status: string; note: string
  }[]

  const overrideMap = new Map<string, string>()
  overrides.forEach((o) => overrideMap.set(`${o.employee_id}__${o.date}`, o.override_status))

  // Apply overrides to existing scan-based records
  master = master.map((rec) => {
    const key = `${rec.employeeId}__${rec.date}`
    const ov = overrideMap.get(key)
    if (ov) {
      return {
        ...rec,
        status: ov as typeof rec.status,
        isLate: ov === 'late' || rec.isLate,
      }
    }
    return rec
  })

  // Inject virtual records for approved leave overrides that have no scan data
  // (e.g. half-day leave on a day the employee didn't scan at all)
  const masterDateKeys = new Set(master.map((r) => `${r.employeeId}__${r.date}`))
  const virtualRecords = overrides
    .filter((o) => !masterDateKeys.has(`${o.employee_id}__${o.date}`))
    .map((o) => {
      // Look up employee name from existing master records or use id
      const empName = master.find((r) => r.employeeId === o.employee_id)?.name ?? o.employee_id
      const empDept = master.find((r) => r.employeeId === o.employee_id)?.department ?? ''
      return {
        employeeId: o.employee_id,
        name: empName,
        department: empDept,
        date: o.date,
        checkIn: null,
        checkOut: null,
        workHours: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        status: o.override_status as 'leave_sick_cert' | 'leave_full_day' | 'leave_half_morning' | 'leave_half_afternoon',
        isLate: false,
        isEarlyLeave: false,
        scanCount: 0,
        allScans: [],
      }
    })

  // Mark records on holiday dates as 'holiday' (unless already overridden by leave)
  const holidaySet = new Set(activeHolidays)
  const allRecords = [...master, ...virtualRecords].map((rec) => {
    if (holidaySet.has(rec.date) && !rec.status.startsWith('leave_')) {
      return { ...rec, status: 'holiday' as const }
    }
    return rec
  })

  return NextResponse.json(allRecords)
}
