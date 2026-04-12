export interface RawScanRecord {
  department: string
  name: string
  machineCode: string
  datetime: Date
  direction: string
  deviceId: string
  employeeId: string
  recordedBy: 'FP' | 'Password' | string
}

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'earlyLeave'
  | 'halfDay'
  | 'noCheckout'
  | 'absent'
  | 'holiday'
  | 'leave_sick'
  | 'leave_sick_cert'
  | 'leave_full_day'
  | 'leave_half_morning'
  | 'leave_half_afternoon'
  | 'noCheckIn'

export interface Holiday {
  id: number
  date: string         // "YYYY-MM-DD"
  name: string
  type: 'thai_national' | 'company'
  is_active: number    // 1 = นับเป็นวันหยุด
  created_at: string
}

export interface AttendanceRecord {
  employeeId: string
  name: string
  department: string
  date: string // "YYYY-MM-DD"
  checkIn: Date | null
  checkOut: Date | null
  workHours: number | null
  lateMinutes: number
  earlyLeaveMinutes: number
  status: AttendanceStatus
  isLate: boolean
  isEarlyLeave: boolean
  scanCount: number
  allScans: Date[]
}

export type EmploymentType = 'daily' | 'monthly'

export interface EmployeeProfile {
  employeeId: string
  name: string
  nickname?: string
  department: string
  employmentType: EmploymentType
  dailyRate?: number
  monthlySalary?: number
  startDate?: string
  isActive: boolean
  phone?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  promptPayId?: string
}

export interface WorkSettings {
  workStartTime: string // "HH:mm"
  workEndTime: string // "HH:mm"
  lateThresholdMinutes: number
  earlyLeaveThresholdMinutes: number
  minWorkHours: number
  halfDayHours: number
  workDays: number[] // 0=Mon, 5=Sat
  singleScanPolicy: 'checkin_only' | 'ignore'
}

export const DEFAULT_SETTINGS: WorkSettings = {
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateThresholdMinutes: 15,
  earlyLeaveThresholdMinutes: 30,
  minWorkHours: 8,
  halfDayHours: 4,
  workDays: [0, 1, 2, 3, 4, 5],
  singleScanPolicy: 'checkin_only',
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'มาทำงาน',
  late: 'มาสาย',
  earlyLeave: 'ออกก่อนเวลา',
  halfDay: 'ครึ่งวัน',
  noCheckout: 'ไม่มีบันทึกออก',
  absent: 'ขาดงาน',
  holiday: 'วันหยุด',
  leave_sick: 'ลาป่วย',
  leave_sick_cert: 'ลาป่วย (มีใบแพทย์)',
  leave_full_day: 'ลาทั้งวัน',
  leave_half_morning: 'ลาครึ่งวันเช้า',
  leave_half_afternoon: 'ลาครึ่งวันบ่าย',
  noCheckIn: 'ไม่ได้แสกนเข้างาน',
}

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: '#16a34a',
  late: '#d97706',
  earlyLeave: '#ea580c',
  halfDay: '#7c3aed',
  noCheckout: '#64748b',
  absent: '#dc2626',
  holiday: '#6366f1',
  leave_sick: '#f97316',
  leave_sick_cert: '#3b82f6',
  leave_full_day: '#f97316',
  leave_half_morning: '#8b5cf6',
  leave_half_afternoon: '#8b5cf6',
  noCheckIn: '#64748b',
}

export interface DailySummary {
  date: string
  presentCount: number
  lateCount: number
  absentCount: number
  noCheckoutCount: number
  records: AttendanceRecord[]
}

export interface WeeklySummary {
  employeeId: string
  name: string
  department: string
  employmentType?: EmploymentType
  daysPresent: number
  daysLate: number
  daysAbsent: number
  daysNoCheckout: number
  totalWorkHours: number
  avgWorkHours: number
  weekDates: string[] // list of work dates in the week
}

// ── Payment ──────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'paid'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'promptpay'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'เงินสด',
  bank_transfer: 'โอน-ธนาคาร',
  promptpay: 'โอน-PromptPay',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: '💵',
  bank_transfer: '🏦',
  promptpay: '📱',
}

export interface MonthlySummary {
  employeeId: string
  name: string
  department: string
  employmentType?: EmploymentType
  workingDaysInMonth: number
  daysPresent: number
  daysLate: number
  daysAbsent: number
  daysNoCheckout: number
  daysHalfDay: number
  daysLeave: number
  totalWorkHours: number
  avgWorkHours: number
  attendanceRate: number
  punctualityRate: number
  totalLateMinutes: number
  estimatedPay?: number
}
