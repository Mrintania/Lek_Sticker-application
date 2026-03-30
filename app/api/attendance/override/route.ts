import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employeeId, date, overrideStatus, note } = await req.json()
  if (!employeeId || !date || !overrideStatus) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const db = getDb()
  db.prepare(`INSERT INTO attendance_overrides (employee_id, date, override_status, note, updated_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(employee_id, date) DO UPDATE SET
      override_status = excluded.override_status,
      note = excluded.note,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')`
  ).run(employeeId, date, overrideStatus, note || null, user.username)

  logAudit(db, user.username, 'attendance.override', 'attendance_override', `${employeeId}__${date}`, {
    employeeId, date, overrideStatus, note: note || null,
  }, getIp(req))

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { employeeId, date } = await req.json()
  const db = getDb()
  db.prepare('DELETE FROM attendance_overrides WHERE employee_id = ? AND date = ?').run(employeeId, date)
  logAudit(db, user.username, 'attendance.override_delete', 'attendance_override', `${employeeId}__${date}`, {
    employeeId, date,
  }, getIp(req))
  return NextResponse.json({ success: true })
}
