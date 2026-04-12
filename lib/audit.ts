import Database from 'better-sqlite3'

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'leave.create'
  | 'leave.approve'
  | 'leave.reject'
  | 'leave.edit'
  | 'leave.delete'
  | 'employee.create'
  | 'employee.update'
  | 'employee.deactivate'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'attendance.override'
  | 'attendance.override_delete'
  | 'scan.import'
  | 'payroll.calculate'
  | 'payroll.adjustment'
  | 'settings.update'
  | 'settings.payroll_update'
  | 'scan.reset'
  | 'scan.delete_range'
  | 'holiday.create'
  | 'holiday.update'
  | 'holiday.delete'
  | 'machine.create'
  | 'machine.update'
  | 'machine.deactivate'
  | 'machine.assign'
  | 'production.record'
  | 'production.update'
  | 'production.delete'
  | 'evaluation.create'
  | 'evaluation.update'
  | 'evaluation.approve'
  | 'payroll.payment'
  | 'delivery.record'
  | 'delivery.update'
  | 'delivery.delete'
  | 'special_work_day.create'
  | 'special_work_day.delete'
  | 'auth.login.failed'
  | 'profile.update'
  | 'profile.password'

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'auth.login': 'เข้าสู่ระบบ',
  'auth.logout': 'ออกจากระบบ',
  'leave.create': 'ขอลา',
  'leave.approve': 'อนุมัติใบลา',
  'leave.reject': 'ปฏิเสธใบลา',
  'leave.edit': 'แก้ไขใบลา',
  'leave.delete': 'ลบใบลา',
  'employee.create': 'เพิ่มพนักงาน',
  'employee.update': 'แก้ไขข้อมูลพนักงาน',
  'employee.deactivate': 'ปิดใช้งานพนักงาน',
  'user.create': 'เพิ่มผู้ใช้',
  'user.update': 'แก้ไขผู้ใช้',
  'user.delete': 'ลบผู้ใช้',
  'attendance.override': 'แก้ไขสถานะการมา',
  'attendance.override_delete': 'ลบการแก้ไขสถานะ',
  'scan.import': 'นำเข้าข้อมูลสแกน',
  'payroll.calculate': 'คำนวณเงินเดือน',
  'payroll.adjustment': 'ปรับเงินพิเศษ/หัก',
  'settings.update': 'แก้ไขการตั้งค่าระบบ',
  'settings.payroll_update': 'แก้ไขการตั้งค่าเงินเดือน',
  'scan.reset': 'ล้างข้อมูลสแกน',
  'scan.delete_range': 'ลบสแกนตามช่วงวันที่',
  'holiday.create': 'เพิ่มวันหยุด',
  'holiday.update': 'แก้ไขวันหยุด',
  'holiday.delete': 'ลบวันหยุด',
  'machine.create': 'เพิ่มแท่นพิมพ์',
  'machine.update': 'แก้ไขแท่นพิมพ์',
  'machine.deactivate': 'ปิดใช้งานแท่นพิมพ์',
  'machine.assign': 'มอบหมายพนักงานให้แท่นพิมพ์',
  'production.record': 'บันทึกงานผลิต',
  'production.update': 'แก้ไขงานผลิต',
  'production.delete': 'ลบงานผลิต',
  'evaluation.create': 'สร้างการประเมิน',
  'evaluation.update': 'แก้ไขการประเมิน',
  'evaluation.approve': 'อนุมัติการประเมิน',
  'payroll.payment': 'จ่ายเงินเดือน',
  'delivery.record': 'บันทึกงานส่ง',
  'delivery.update': 'แก้ไขงานส่ง',
  'delivery.delete': 'ลบงานส่ง',
  'special_work_day.create': 'เพิ่มวันทำงานพิเศษ',
  'special_work_day.delete': 'ลบวันทำงานพิเศษ',
  'auth.login.failed': 'เข้าสู่ระบบล้มเหลว',
  'profile.update': 'แก้ไขข้อมูลส่วนตัว',
  'profile.password': 'เปลี่ยนรหัสผ่าน',
}

export const AUDIT_ACTION_COLORS: Record<AuditAction, string> = {
  'auth.login': 'bg-green-100 text-green-700',
  'auth.logout': 'bg-gray-100 text-gray-600',
  'leave.create': 'bg-blue-100 text-blue-700',
  'leave.approve': 'bg-green-100 text-green-700',
  'leave.reject': 'bg-red-100 text-red-700',
  'leave.edit': 'bg-yellow-100 text-yellow-700',
  'leave.delete': 'bg-red-100 text-red-700',
  'employee.create': 'bg-blue-100 text-blue-700',
  'employee.update': 'bg-yellow-100 text-yellow-700',
  'employee.deactivate': 'bg-orange-100 text-orange-700',
  'user.create': 'bg-blue-100 text-blue-700',
  'user.update': 'bg-yellow-100 text-yellow-700',
  'user.delete': 'bg-red-100 text-red-700',
  'attendance.override': 'bg-purple-100 text-purple-700',
  'attendance.override_delete': 'bg-red-100 text-red-700',
  'scan.import': 'bg-indigo-100 text-indigo-700',
  'payroll.calculate': 'bg-indigo-100 text-indigo-700',
  'payroll.adjustment': 'bg-indigo-100 text-indigo-700',
  'settings.update': 'bg-orange-100 text-orange-700',
  'settings.payroll_update': 'bg-orange-100 text-orange-700',
  'scan.reset': 'bg-red-100 text-red-700',
  'scan.delete_range': 'bg-red-100 text-red-700',
  'holiday.create': 'bg-teal-100 text-teal-700',
  'holiday.update': 'bg-yellow-100 text-yellow-700',
  'holiday.delete': 'bg-red-100 text-red-700',
  'machine.create': 'bg-cyan-100 text-cyan-700',
  'machine.update': 'bg-cyan-100 text-cyan-700',
  'machine.deactivate': 'bg-cyan-100 text-cyan-700',
  'machine.assign': 'bg-cyan-100 text-cyan-700',
  'production.record': 'bg-teal-100 text-teal-700',
  'production.update': 'bg-teal-100 text-teal-700',
  'production.delete': 'bg-red-100 text-red-700',
  'evaluation.create': 'bg-violet-100 text-violet-700',
  'evaluation.update': 'bg-violet-100 text-violet-700',
  'evaluation.approve': 'bg-violet-100 text-violet-700',
  'payroll.payment': 'bg-green-100 text-green-700',
  'delivery.record': 'bg-emerald-100 text-emerald-700',
  'delivery.update': 'bg-emerald-100 text-emerald-700',
  'delivery.delete': 'bg-red-100 text-red-700',
  'special_work_day.create': 'bg-purple-100 text-purple-700',
  'special_work_day.delete': 'bg-red-100 text-red-700',
  'auth.login.failed': 'bg-red-100 text-red-700',
  'profile.update': 'bg-yellow-100 text-yellow-700',
  'profile.password': 'bg-orange-100 text-orange-700',
}

export function logAudit(
  db: Database.Database,
  actor: string,
  action: AuditAction,
  entityType: string | null,
  entityId: string | null,
  details: Record<string, unknown> | null,
  ipAddress?: string | null
) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (actor, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      actor,
      action,
      entityType ?? null,
      entityId ?? null,
      details ? JSON.stringify(details) : null,
      ipAddress ?? null
    )
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err)
  }
}

export function getIp(req: { headers: { get: (k: string) => string | null } }): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}
