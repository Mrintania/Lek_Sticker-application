import { AttendanceRecord, WeeklySummary, MonthlySummary, EmployeeProfile, WorkSettings } from './types'
import { getISOWeekNumber, getWeekDateRange, dateToString } from './formatters'
import { getWorkingDaysInMonth } from './processor'

export function getDailyRecords(master: AttendanceRecord[], date: string): AttendanceRecord[] {
  return master.filter((r) => r.date === date).sort((a, b) => {
    if (!a.checkIn && !b.checkIn) return a.name.localeCompare(b.name)
    if (!a.checkIn) return 1
    if (!b.checkIn) return -1
    return a.checkIn.getTime() - b.checkIn.getTime()
  })
}

export function getWeeklySummary(
  master: AttendanceRecord[],
  year: number,
  week: number,
  employees: EmployeeProfile[],
  settings: WorkSettings
): WeeklySummary[] {
  const { start, end } = getWeekDateRange(year, week)

  // Get all work dates in the week range
  const weekDates: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const dow = cur.getDay()
    const ourDow = dow === 0 ? 6 : dow - 1
    if (settings.workDays.includes(ourDow)) {
      weekDates.push(dateToString(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }

  const empMap = new Map(employees.map((e) => [e.employeeId, e]))

  // Get unique employees from master data for this period
  const allEmployees = new Map<string, { name: string; department: string }>()
  master.forEach((r) => {
    if (!allEmployees.has(r.employeeId)) {
      allEmployees.set(r.employeeId, { name: r.name, department: r.department })
    }
  })

  const summaries: WeeklySummary[] = []

  for (const [empId, empInfo] of allEmployees) {
    const empRecords = master.filter(
      (r) => r.employeeId === empId && weekDates.includes(r.date)
    )

    const daysPresent = empRecords.filter((r) =>
      ['present', 'late', 'earlyLeave', 'halfDay', 'noCheckout', 'noCheckIn'].includes(r.status)
    ).length
    const daysLate = empRecords.filter((r) => r.isLate).length
    const daysAbsent = weekDates.length - daysPresent
    const daysNoCheckout = empRecords.filter((r) => r.status === 'noCheckout').length
    const totalWorkHours = empRecords.reduce((sum, r) => sum + (r.workHours ?? 0), 0)

    summaries.push({
      employeeId: empId,
      name: empInfo.name,
      department: empInfo.department,
      employmentType: empMap.get(empId)?.employmentType,
      daysPresent,
      daysLate,
      daysAbsent: Math.max(0, daysAbsent),
      daysNoCheckout,
      totalWorkHours: Math.round(totalWorkHours * 10) / 10,
      avgWorkHours: daysPresent > 0 ? Math.round((totalWorkHours / daysPresent) * 10) / 10 : 0,
      weekDates,
    })
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name))
}

export function getMonthlySummary(
  master: AttendanceRecord[],
  year: number,
  month: number,
  employees: EmployeeProfile[],
  settings: WorkSettings,
  cutoffDate?: string   // YYYY-MM-DD — ไม่นับวันหลังจากนี้ (ใช้สำหรับเดือนปัจจุบัน)
): MonthlySummary[] {
  const allWorkingDates = getWorkingDaysInMonth(year, month, settings.workDays)
  // ถ้ามี cutoff → นับเฉพาะวันที่ผ่านมาแล้ว (ไม่รวมอนาคต)
  const workingDates = cutoffDate
    ? allWorkingDates.filter((d) => d <= cutoffDate)
    : allWorkingDates
  const workingDaysInMonth = workingDates.length
  const empMap = new Map(employees.map((e) => [e.employeeId, e]))

  const allEmployees = new Map<string, { name: string; department: string }>()
  master.forEach((r) => {
    if (!allEmployees.has(r.employeeId)) {
      allEmployees.set(r.employeeId, { name: r.name, department: r.department })
    }
  })

  const summaries: MonthlySummary[] = []

  for (const [empId, empInfo] of allEmployees) {
    const empRecords = master.filter(
      (r) =>
        r.employeeId === empId &&
        workingDates.includes(r.date)
    )

    const daysPresent = empRecords.filter((r) =>
      ['present', 'late', 'earlyLeave', 'halfDay', 'noCheckout', 'noCheckIn'].includes(r.status)
    ).length
    const daysLate = empRecords.filter((r) => r.isLate).length
    const daysHalfDay = empRecords.filter((r) => r.status === 'halfDay').length
    const daysNoCheckout = empRecords.filter((r) => r.status === 'noCheckout').length
    const daysLeave = empRecords.filter((r) =>
      ['leave_sick', 'leave_sick_cert', 'leave_full_day', 'leave_half_morning', 'leave_half_afternoon'].includes(r.status)
    ).length
    const daysAbsent = Math.max(0, workingDaysInMonth - daysPresent)
    const totalWorkHours = empRecords.reduce((sum, r) => sum + (r.workHours ?? 0), 0)
    const totalLateMinutes = empRecords.reduce((sum, r) => sum + r.lateMinutes, 0)

    const attendanceRate = workingDaysInMonth > 0 ? (daysPresent / workingDaysInMonth) * 100 : 0
    const punctualityRate = daysPresent > 0 ? ((daysPresent - daysLate) / daysPresent) * 100 : 100

    const profile = empMap.get(empId)
    let estimatedPay: number | undefined
    if (profile) {
      if (profile.employmentType === 'daily' && profile.dailyRate) {
        estimatedPay = daysPresent * profile.dailyRate
      } else if (profile.employmentType === 'monthly' && profile.monthlySalary) {
        const deduction = workingDaysInMonth > 0
          ? (daysAbsent / workingDaysInMonth) * profile.monthlySalary
          : 0
        estimatedPay = Math.max(0, profile.monthlySalary - deduction)
      }
    }

    summaries.push({
      employeeId: empId,
      name: empInfo.name,
      department: empInfo.department,
      employmentType: profile?.employmentType,
      workingDaysInMonth,
      daysPresent,
      daysLate,
      daysAbsent,
      daysNoCheckout,
      daysHalfDay,
      daysLeave,
      totalWorkHours: Math.round(totalWorkHours * 10) / 10,
      avgWorkHours: daysPresent > 0 ? Math.round((totalWorkHours / daysPresent) * 10) / 10 : 0,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      punctualityRate: Math.round(punctualityRate * 10) / 10,
      totalLateMinutes,
      estimatedPay,
    })
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name))
}

export function getEmployeeRecords(
  master: AttendanceRecord[],
  employeeId: string,
  startDate?: string,
  endDate?: string
): AttendanceRecord[] {
  return master.filter((r) => {
    if (r.employeeId !== employeeId) return false
    if (startDate && r.date < startDate) return false
    if (endDate && r.date > endDate) return false
    return true
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export function getAvailableDates(master: AttendanceRecord[]): string[] {
  return [...new Set(master.map((r) => r.date))].sort()
}

export function getAvailableMonths(master: AttendanceRecord[]): { year: number; month: number }[] {
  const set = new Set<string>()
  master.forEach((r) => {
    const [y, m] = r.date.split('-')
    set.add(`${y}-${m}`)
  })
  return [...set].sort().map((s) => {
    const [y, m] = s.split('-')
    return { year: parseInt(y), month: parseInt(m) }
  })
}

export function getAvailableWeeks(master: AttendanceRecord[]): { year: number; week: number }[] {
  const set = new Set<string>()
  master.forEach((r) => {
    const d = new Date(r.date + 'T00:00:00')
    const week = getISOWeekNumber(d)
    const year = d.getFullYear()
    set.add(`${year}-${String(week).padStart(2, '0')}`)
  })
  return [...set].sort().map((s) => {
    const [y, w] = s.split('-')
    return { year: parseInt(y), week: parseInt(w) }
  })
}
