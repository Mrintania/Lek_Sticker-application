// Bangkok is UTC+7 — all time display and date grouping must use this offset
// Stored datetimes in DB are UTC (from toISOString()), so we add 7h when reading
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000 // 25,200,000 ms

/** Convert a UTC Date to its Bangkok-local equivalent (still a Date object, but shifted) */
export function toBangkokDate(date: Date): Date {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS)
}

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

export const THAI_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
export const THAI_DAYS_SHORT = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543
}

export function formatThaiDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate()
  const month = THAI_MONTHS[d.getMonth()]
  const year = toBuddhistYear(d.getFullYear())
  return `${day} ${month} ${year}`
}

export function formatThaiDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

export function formatThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS[month - 1]} ${toBuddhistYear(year)}`
}

export function formatTime(date: Date | null | undefined): string {
  if (!date) return '-'
  const bkk = toBangkokDate(date)
  const h = String(bkk.getUTCHours()).padStart(2, '0')
  const m = String(bkk.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '-'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} นาที`
  if (m === 0) return `${h} ชม.`
  return `${h} ชม. ${m} นาที`
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '-'
  if (minutes < 60) return `${minutes} นาที`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeekDateRange(year: number, week: number): { start: Date; end: Date } {
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  const firstMonday = new Date(year, 0, 1 + (jan1Day <= 4 ? 2 - jan1Day : 9 - jan1Day))
  const start = new Date(firstMonday)
  start.setDate(firstMonday.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 5) // Saturday
  return { start, end }
}

export function dateToString(date: Date): string {
  // Group scans by Bangkok date, not UTC date
  const bkk = toBangkokDate(date)
  const y = bkk.getUTCFullYear()
  const m = String(bkk.getUTCMonth() + 1).padStart(2, '0')
  const d = String(bkk.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDayOfWeekThai(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const map = [6, 0, 1, 2, 3, 4, 5] // Sun=0 in JS, but we want Mon=0
  return THAI_DAYS[map[dow]]
}
