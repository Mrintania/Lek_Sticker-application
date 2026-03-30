import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() // action: 'approve' | 'reject' | 'edit'
  const { action, rejectReason } = body
  const db = getDb()

  const leave = db.prepare('SELECT * FROM leaves WHERE id = ? AND deleted_at IS NULL').get(params.id) as {
    id: number; employee_id: string; leave_type: string; date: string; has_medical_cert: number; status: string
  } | undefined

  if (!leave) return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 })

  // User ปกติ: แก้ไขได้เฉพาะใบลา pending ของตัวเองเท่านั้น (action = 'edit' เท่านั้น)
  if (user.role === 'user') {
    if (action !== 'edit') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (leave.employee_id !== user.employeeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (leave.status !== 'pending') return NextResponse.json({ error: 'แก้ไขได้เฉพาะใบลาที่ยังรออนุมัติเท่านั้น' }, { status: 400 })
  }

  // Admin/Manager: ทำได้ทุก action
  if (user.role !== 'user' && !canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (action === 'approve') {
    db.prepare(`UPDATE leaves SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?`
    ).run(user.username, params.id)

    // Auto-create attendance override
    const overrideStatus =
      leave.leave_type === 'sick' ? 'leave_sick_cert'
      : leave.leave_type === 'full_day' ? 'leave_full_day'
      : leave.leave_type === 'half_morning' ? 'leave_half_morning'
      : 'leave_half_afternoon'

    db.prepare(`INSERT INTO attendance_overrides (employee_id, date, override_status, leave_id, note, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET
        override_status = excluded.override_status,
        leave_id = excluded.leave_id,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')`
    ).run(leave.employee_id, leave.date, overrideStatus, leave.id, 'อนุมัติใบลา', user.username)

    logAudit(db, user.username, 'leave.approve', 'leave', params.id, {
      employeeId: leave.employee_id, date: leave.date, leaveType: leave.leave_type,
    }, getIp(req))

  } else if (action === 'reject') {
    db.prepare(`UPDATE leaves SET status = 'rejected', reject_reason = ?, approved_by = ? WHERE id = ?`
    ).run(rejectReason || null, user.username, params.id)

    logAudit(db, user.username, 'leave.reject', 'leave', params.id, {
      employeeId: leave.employee_id, date: leave.date, rejectReason: rejectReason || null,
    }, getIp(req))

  } else if (action === 'edit') {
    const { leaveType, date, hasMedicalCert, reason } = body
    db.prepare(`UPDATE leaves SET leave_type = ?, date = ?, has_medical_cert = ?, reason = ? WHERE id = ?`)
      .run(leaveType, date, hasMedicalCert ? 1 : 0, reason || null, params.id)

    // If leave was already approved, update the attendance override as well
    if (leave.status === 'approved') {
      const overrideStatus =
        leaveType === 'sick' ? 'leave_sick_cert'
        : leaveType === 'full_day' ? 'leave_full_day'
        : leaveType === 'half_morning' ? 'leave_half_morning'
        : 'leave_half_afternoon'
      // Update override at new date
      db.prepare(`INSERT INTO attendance_overrides (employee_id, date, override_status, leave_id, note, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id, date) DO UPDATE SET
          override_status = excluded.override_status,
          leave_id = excluded.leave_id,
          updated_by = excluded.updated_by,
          updated_at = datetime('now')`)
        .run(leave.employee_id, date, overrideStatus, leave.id, 'แก้ไขใบลา', user.username)
      // Remove old date override if date changed
      if (date !== leave.date) {
        db.prepare(`DELETE FROM attendance_overrides WHERE employee_id = ? AND date = ? AND leave_id = ?`)
          .run(leave.employee_id, leave.date, leave.id)
      }
    }

    logAudit(db, user.username, 'leave.edit', 'leave', params.id, {
      employeeId: leave.employee_id, oldDate: leave.date, newDate: date, leaveType,
    }, getIp(req))
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ? AND deleted_at IS NULL').get(params.id) as {
    id: number; employee_id: string; date: string; status: string
  } | undefined
  if (!leave) return NextResponse.json({ error: 'ไม่พบใบลา' }, { status: 404 })

  // User can only delete own pending leaves
  if (user.role === 'user' && (leave.employee_id !== user.employeeId || leave.status !== 'pending')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Remove the attendance override linked to this leave (regardless of status)
  // This also catches any orphan overrides in case leave was previously hard-deleted then re-created
  db.prepare('DELETE FROM attendance_overrides WHERE leave_id = ?').run(params.id)

  // Soft delete — keep the row for audit history
  db.prepare(`UPDATE leaves SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ?`)
    .run(user.username, params.id)

  logAudit(db, user.username, 'leave.delete', 'leave', params.id, {
    employeeId: leave.employee_id, date: leave.date, wasApproved: leave.status === 'approved',
  }, getIp(req))

  // Return date so client can trigger payroll sync
  return NextResponse.json({ success: true, date: leave.date, wasApproved: leave.status === 'approved' })
}
