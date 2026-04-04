import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { buildAttendanceMaster } from '@/lib/processor'
import { RawScanRecord, WorkSettings } from '@/lib/types'
import { getWorkingDaysInMonth } from '@/lib/processor'
import { logAudit, getIp } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const year = Number(body.year)
  const month = Number(body.month)
  const period = Number(body.period)
  if (!year || year < 2020 || year > 2030) return NextResponse.json({ error: 'year ไม่ถูกต้อง (2020–2030)' }, { status: 400 })
  if (!month || month < 1 || month > 12) return NextResponse.json({ error: 'month ไม่ถูกต้อง (1–12)' }, { status: 400 })
  if (![1, 2].includes(period)) return NextResponse.json({ error: 'period ต้องเป็น 1 หรือ 2' }, { status: 400 })
  const periodNum: 1 | 2 = period === 2 ? 2 : 1

  const db = getDb()

  // Get settings
  const ws = db.prepare('SELECT * FROM work_settings WHERE id = 1').get() as Record<string, unknown>
  const settings: WorkSettings = {
    workStartTime: String(ws.work_start_time),
    workEndTime: String(ws.work_end_time),
    lateThresholdMinutes: Number(ws.late_threshold_minutes),
    earlyLeaveThresholdMinutes: Number(ws.early_leave_threshold_minutes),
    minWorkHours: Number(ws.min_work_hours),
    halfDayHours: Number(ws.half_day_hours),
    workDays: String(ws.work_days).split(',').map(Number),
    singleScanPolicy: String(ws.single_scan_policy) as WorkSettings['singleScanPolicy'],
  }

  // Get payroll settings
  const ps = db.prepare('SELECT * FROM payroll_settings WHERE id = 1').get() as {
    diligence_bonus_enabled: number
    sick_with_cert_exempt: number
    monthly_max_absent: number
    diligence_base_amount: number
    diligence_step_amount: number
    diligence_max_days: number
  }

  // Clean up orphan attendance_overrides where the linked leave no longer exists
  // (handles both hard-deleted leaves from before soft-delete and soft-deleted leaves)
  db.prepare(`
    DELETE FROM attendance_overrides
    WHERE leave_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM leaves l
        WHERE l.id = attendance_overrides.leave_id
          AND l.deleted_at IS NULL
      )
  `).run()

  // ── กำหนด date range ตาม period ─────────────────────────────────────────
  const mm = String(month).padStart(2, '0')
  const startDate = `${year}-${mm}-01`
  const endDate = `${year}-${mm}-31`
  const lastDay = new Date(year, month, 0).getDate()
  const periodStart = periodNum === 1 ? `${year}-${mm}-01` : `${year}-${mm}-16`
  const periodEnd = periodNum === 1 ? `${year}-${mm}-15` : `${year}-${mm}-${String(lastDay).padStart(2, '0')}`

  // ── ตรวจสอบว่าเป็นเดือนปัจจุบันหรือไม่ ───────────────────────────────────
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)

  // สำหรับเดือนปัจจุบัน: ถ้ารอบยังไม่เริ่ม → แจ้งเตือน
  if (isCurrentMonth && todayStr < periodStart) {
    return NextResponse.json({
      warning: 'no_data',
      message: `รอบที่ ${periodNum} ยังไม่เริ่ม (เริ่มวันที่ ${periodNum === 2 ? '16' : '1'} ของเดือน)`,
    })
  }

  // ตัวตัดของรอบ: ไม่เกิน periodEnd และไม่เกิน todayStr (ถ้าเดือนปัจจุบัน)
  const effectivePeriodCutoff = isCurrentMonth && todayStr < periodEnd ? todayStr : periodEnd

  const activeHolidays = (db.prepare(
    `SELECT date FROM holidays WHERE is_active = 1 AND date >= ? AND date <= ?`
  ).all(startDate, endDate) as { date: string }[]).map((h) => h.date)

  const rawRows = db.prepare(`SELECT * FROM raw_scans WHERE scan_datetime >= ? AND scan_datetime <= ?`
  ).all(periodStart, effectivePeriodCutoff + ' 23:59:59') as {
    employee_id: string; employee_name: string; department: string;
    scan_datetime: string; direction: string; recorded_by: string
  }[]

  // ── ถ้าไม่มีข้อมูลสแกนเลย → แจ้งเตือนทันที ──────────────────────────────
  if (rawRows.length === 0) {
    return NextResponse.json({
      warning: 'no_data',
      message: isCurrentMonth
        ? `ยังไม่มีข้อมูลการสแกนสำหรับรอบที่ ${periodNum} (ข้อมูลถึง ${effectivePeriodCutoff}) กรุณานำเข้าข้อมูลก่อนคำนวณเงินเดือน`
        : `ไม่มีข้อมูลการสแกนสำหรับรอบที่ ${periodNum} ไม่สามารถคำนวณเงินเดือนได้`,
    })
  }

  const rawScans: RawScanRecord[] = rawRows.map((r) => ({
    employeeId: r.employee_id, name: r.employee_name, department: r.department || '',
    datetime: new Date(r.scan_datetime.replace(' ', 'T') + 'Z'), direction: r.direction, deviceId: '', machineCode: '', recordedBy: r.recorded_by,
  }))

  const master = buildAttendanceMaster(rawScans, settings)

  // Get overrides for the period only
  const overrides = db.prepare(
    `SELECT * FROM attendance_overrides WHERE date >= ? AND date <= ?`
  ).all(periodStart, effectivePeriodCutoff) as { employee_id: string; date: string; override_status: string }[]
  const overrideMap = new Map(overrides.map((o) => [`${o.employee_id}__${o.date}`, o.override_status]))

  // Apply overrides to existing scan-based records
  const masterWithOverrides = master.map((rec) => {
    const ov = overrideMap.get(`${rec.employeeId}__${rec.date}`)
    if (ov) return { ...rec, status: ov as typeof rec.status }
    return rec
  })

  // Inject virtual records for override dates that have NO scan data
  // e.g. approved half-day leave on a day the employee didn't scan at all
  const masterDateKeys = new Set(master.map((r) => `${r.employeeId}__${r.date}`))
  const virtualRecords = overrides
    .filter((o) => !masterDateKeys.has(`${o.employee_id}__${o.date}`))
    .map((o) => ({
      employeeId: o.employee_id,
      name: '',
      department: '',
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
      allScans: [] as Date[],
    }))

  const mergedMaster = [...masterWithOverrides, ...virtualRecords]

  // Get employees
  const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1').all() as {
    employee_id: string; name: string; employment_type: string; daily_rate: number | null; monthly_salary: number | null
  }[]

  // วันทำงานทั้งเดือน (ใช้คำนวณอัตรารายวันจากเงินเดือนรายเดือน)
  const allWorkingDates = getWorkingDaysInMonth(year, month, settings.workDays, activeHolidays)
  const totalWorkingDaysInMonth = allWorkingDates.length || 1

  // วันทำงานทั้งหมดในรอบนี้
  const allPeriodWorkingDates = allWorkingDates.filter((d) => d >= periodStart && d <= periodEnd)
  // วันทำงานที่ผ่านมาแล้วในรอบนี้ (ตัดที่ effectivePeriodCutoff)
  const workingDates = allPeriodWorkingDates.filter((d) => d <= effectivePeriodCutoff)
  const workingDays = workingDates.length

  // Build lookup structures once — avoids O(N×M) filter inside the employee loop
  const masterByEmployee = new Map<string, typeof mergedMaster>()
  for (const rec of mergedMaster) {
    const arr = masterByEmployee.get(rec.employeeId) ?? []
    arr.push(rec)
    masterByEmployee.set(rec.employeeId, arr)
  }
  const workingDateSet = new Set(workingDates)

  const results = []
  const upsertPayroll = db.prepare(`INSERT INTO payroll_records
    (employee_id, year, month, period, working_days, days_present, days_absent, days_sick_with_cert, days_sick_no_cert, days_half_day, total_late_minutes, base_pay, diligence_bonus, deductions, total_pay, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, year, month, period) DO UPDATE SET
      working_days = excluded.working_days, days_present = excluded.days_present,
      days_absent = excluded.days_absent, days_sick_with_cert = excluded.days_sick_with_cert,
      days_sick_no_cert = excluded.days_sick_no_cert, days_half_day = excluded.days_half_day,
      total_late_minutes = excluded.total_late_minutes, base_pay = excluded.base_pay,
      diligence_bonus = excluded.diligence_bonus, deductions = excluded.deductions,
      total_pay = excluded.total_pay, created_by = excluded.created_by`)

  for (const emp of employees) {
    // Only include records on working days (Mon–Sat per settings, no Sunday)
    const empRecords = (masterByEmployee.get(emp.employee_id) ?? []).filter((r) => workingDateSet.has(r.date))

    // Working dates where employee has a valid scan (status ≠ 'absent')
    const presentDateSet = new Set(empRecords.filter((r) => r.status !== 'absent').map((r) => r.date))
    const daysPresent = presentDateSet.size

    // Truly absent = working days with no scan/record
    const daysTrulyAbsent = workingDates.filter((d) => !presentDateSet.has(d)).length
    const daysSickWithCert = empRecords.filter((r) => r.status === 'leave_sick_cert').length
    // leave_sick (legacy) + leave_full_day (new) = full day absent (unpaid)
    const daysSickNoCert = empRecords.filter((r) => r.status === 'leave_sick' || r.status === 'leave_full_day').length
    const daysHalfDay = empRecords.filter((r) => ['leave_half_morning', 'leave_half_afternoon', 'halfDay'].includes(r.status)).length
    const totalLateMinutes = empRecords.reduce((s, r) => s + r.lateMinutes, 0)

    // Total absent-equivalent: truly absent + full-day leave (both = not paid)
    const daysAbsent = daysTrulyAbsent + daysSickNoCert

    // realAbsent for diligence bonus: adjust for sick cert exemption + half-days count as 0.5
    const baseAbsent = ps.sick_with_cert_exempt
      ? Math.max(0, daysAbsent - daysSickWithCert)
      : daysAbsent
    // ครึ่งวันนับเป็น 0.5 วันสำหรับเกณฑ์เบี้ยขยัน (ไม่หักเงินเดือน)
    const realAbsent = baseAbsent + daysHalfDay * 0.5

    // Effective paid days for daily employees
    const daysEffectivePresent = daysPresent - daysSickNoCert
    const daysFullPresent = Math.max(0, daysEffectivePresent - daysHalfDay)
    const effectiveDays = daysFullPresent + daysHalfDay * 0.5

    let basePay = 0
    const deductions = 0 // ไม่มีการหักเงินเดือน

    if (emp.employment_type === 'daily') {
      // รายวัน: คิดตามวันที่ทำงานจริงในรอบนี้ (ครึ่งวัน = 0.5)
      basePay = emp.daily_rate ? Math.max(0, effectiveDays) * emp.daily_rate : 0
    } else if (emp.employment_type === 'monthly') {
      // รายเดือน: ฐาน = เงินเดือน ÷ 2 ต่อรอบ
      const periodBaseSalary = (emp.monthly_salary ?? 0) / 2
      if (realAbsent > (ps.monthly_max_absent ?? 3.5)) {
        // ขาด/ลาเกิน 3.5 วันในรอบนี้ → เปลี่ยนเป็นคิดรายวัน
        // อัตรารายวัน = เงินเดือนเต็ม ÷ วันทำงานทั้งหมดในเดือน (ไม่ใช่ ÷ 2)
        const dailyRateFromSalary = (emp.monthly_salary ?? 0) / totalWorkingDaysInMonth
        basePay = Math.max(0, effectiveDays) * dailyRateFromSalary
      } else {
        // ขาด/ลาไม่เกิน 3.5 วัน → ได้เงินเดือนครึ่งรอบ
        basePay = periodBaseSalary
      }
    }

    // Diligence bonus — monthly only (ระบบขั้นบันได ลดทีละ stepAmount ต่อ 0.5 วัน)
    // ไม่หยุด = baseAmount, หยุด 0.5 วัน = baseAmount - step, หยุด 1 วัน = baseAmount - 2*step ...
    // หยุดเกิน maxDays → ไม่ได้เบี้ยขยัน
    let diligenceBonus = 0
    if (ps.diligence_bonus_enabled && emp.employment_type === 'monthly') {
      const baseAmount = ps.diligence_base_amount ?? 1000
      const stepAmount = ps.diligence_step_amount ?? 150
      const maxDays = ps.diligence_max_days ?? 3
      if (realAbsent <= maxDays) {
        const steps = Math.floor(realAbsent / 0.5)
        diligenceBonus = Math.max(0, baseAmount - steps * stepAmount)
      }
    }

    const totalPay = Math.max(0, basePay - deductions + diligenceBonus)

    upsertPayroll.run(
      emp.employee_id, year, month, periodNum, workingDays, daysPresent, daysAbsent,
      daysSickWithCert, daysSickNoCert, daysHalfDay, totalLateMinutes,
      Math.round(basePay * 100) / 100, diligenceBonus,
      Math.round(deductions * 100) / 100, Math.round(totalPay * 100) / 100, user.username
    )

    results.push({
      employeeId: emp.employee_id,
      name: emp.name,
      employmentType: emp.employment_type,
      workingDays,
      daysPresent,
      daysAbsent,
      daysSickWithCert,
      daysSickNoCert,
      daysHalfDay,
      totalLateMinutes,
      basePay: Math.round(basePay * 100) / 100,
      deductions: Math.round(deductions * 100) / 100,
      diligenceBonus,
      totalPay: Math.round(totalPay * 100) / 100,
      switchedToDaily: emp.employment_type === 'monthly' && realAbsent > (ps.monthly_max_absent ?? 3.5),
    })
  }

  logAudit(db, user.username, 'payroll.calculate', 'payroll', `${year}-${month}-${periodNum}`, {
    year, month, period: periodNum, employeeCount: results.length,
  }, getIp(req))

  return NextResponse.json({ success: true, year, month, period: periodNum, results })
}
