import { RawScanRecord, AttendanceRecord, AttendanceStatus, WorkSettings } from './types'
import { dateToString, toBangkokDate } from './formatters'

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function getTimeInMinutes(date: Date): number {
  // Always compare in Bangkok local time (UTC+7)
  const bkk = toBangkokDate(date)
  return bkk.getUTCHours() * 60 + bkk.getUTCMinutes()
}

function deduplicateScans(scans: Date[]): Date[] {
  if (scans.length <= 1) return scans
  const result: Date[] = [scans[0]]
  for (let i = 1; i < scans.length; i++) {
    const diff = (scans[i].getTime() - result[result.length - 1].getTime()) / 60000
    if (diff >= 2) result.push(scans[i])
  }
  return result
}

function determineStatus(
  checkIn: Date | null,
  checkOut: Date | null,
  workHours: number | null,
  lateMinutes: number,
  earlyLeaveMinutes: number,
  settings: WorkSettings
): AttendanceStatus {
  if (!checkIn) return 'absent'
  if (!checkOut) return 'noCheckout'
  if (workHours !== null && workHours < settings.halfDayHours) return 'halfDay'
  if (lateMinutes > settings.lateThresholdMinutes) return 'late'
  if (earlyLeaveMinutes > settings.earlyLeaveThresholdMinutes) return 'earlyLeave'
  return 'present'
}

export function buildAttendanceMaster(
  raw: RawScanRecord[],
  settings: WorkSettings
): AttendanceRecord[] {
  // Group by (name/employeeId, date)
  const groups = new Map<string, { name: string; department: string; employeeId: string; scans: Date[] }>()

  for (const record of raw) {
    const dateStr = dateToString(record.datetime)
    const key = `${record.employeeId}__${dateStr}`
    if (!groups.has(key)) {
      groups.set(key, {
        name: record.name,
        department: record.department,
        employeeId: record.employeeId,
        scans: [],
      })
    }
    groups.get(key)!.scans.push(record.datetime)
  }

  const workStartMinutes = parseTimeToMinutes(settings.workStartTime)
  const workEndMinutes = parseTimeToMinutes(settings.workEndTime)

  const records: AttendanceRecord[] = []

  for (const [key, group] of groups) {
    const dateStr = key.split('__')[1]
    group.scans.sort((a, b) => a.getTime() - b.getTime())
    const deduped = deduplicateScans(group.scans)

    let checkIn: Date | null = null
    let checkOut: Date | null = null

    if (deduped.length >= 2) {
      checkIn = deduped[0]
      checkOut = deduped[deduped.length - 1]
    } else if (deduped.length === 1) {
      if (settings.singleScanPolicy === 'ignore') continue
      checkIn = deduped[0]
      checkOut = null
    }

    const workHours = checkIn && checkOut
      ? (checkOut.getTime() - checkIn.getTime()) / 3600000
      : null

    const checkInMinutes = checkIn ? getTimeInMinutes(checkIn) : null
    const checkOutMinutes = checkOut ? getTimeInMinutes(checkOut) : null

    const lateMinutes = checkInMinutes !== null
      ? Math.max(0, checkInMinutes - workStartMinutes)
      : 0
    const earlyLeaveMinutes = checkOutMinutes !== null
      ? Math.max(0, workEndMinutes - checkOutMinutes)
      : 0

    const status = determineStatus(checkIn, checkOut, workHours, lateMinutes, earlyLeaveMinutes, settings)

    records.push({
      employeeId: group.employeeId,
      name: group.name,
      department: group.department,
      date: dateStr,
      checkIn,
      checkOut,
      workHours,
      lateMinutes,
      earlyLeaveMinutes,
      status,
      isLate: lateMinutes > settings.lateThresholdMinutes,
      isEarlyLeave: earlyLeaveMinutes > settings.earlyLeaveThresholdMinutes,
      scanCount: group.scans.length,
      allScans: group.scans,
    })
  }

  records.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  return records
}

export function getWorkingDaysInMonth(
  year: number,
  month: number,
  workDays: number[],
  holidays: string[] = []
): string[] {
  const holidaySet = new Set(holidays)
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    // JS: 0=Sun,1=Mon,...,6=Sat; our workDays: 0=Mon,...,5=Sat,6=Sun
    const ourDow = dow === 0 ? 6 : dow - 1
    const dateStr = dateToString(date)
    if (workDays.includes(ourDow) && !holidaySet.has(dateStr)) {
      days.push(dateStr)
    }
  }
  return days
}
