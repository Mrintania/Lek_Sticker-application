import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const s = db.prepare('SELECT * FROM work_settings WHERE id = 1').get() as Record<string, unknown>
  return NextResponse.json({
    workStartTime: s.work_start_time,
    workEndTime: s.work_end_time,
    lateThresholdMinutes: s.late_threshold_minutes,
    earlyLeaveThresholdMinutes: s.early_leave_threshold_minutes,
    minWorkHours: s.min_work_hours,
    halfDayHours: s.half_day_hours,
    workDays: String(s.work_days).split(',').map(Number),
    singleScanPolicy: s.single_scan_policy,
  })
}

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const db = getDb()
  db.prepare(`UPDATE work_settings SET
    work_start_time = ?, work_end_time = ?,
    late_threshold_minutes = ?, early_leave_threshold_minutes = ?,
    min_work_hours = ?, half_day_hours = ?,
    work_days = ?, single_scan_policy = ?,
    updated_at = datetime('now')
    WHERE id = 1`).run(
    body.workStartTime, body.workEndTime,
    body.lateThresholdMinutes, body.earlyLeaveThresholdMinutes,
    body.minWorkHours, body.halfDayHours,
    (body.workDays as number[]).join(','), body.singleScanPolicy
  )
  logAudit(db, user.username, 'settings.update', 'work_settings', '1', {
    workStartTime: body.workStartTime, workEndTime: body.workEndTime,
    lateThresholdMinutes: body.lateThresholdMinutes,
  }, getIp(req))
  return NextResponse.json({ success: true })
}
