import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const db = getDb()

  // Partial update: only isActive
  if (body.isActive !== undefined && body.name === undefined && body.dailyRate === undefined) {
    db.prepare(`UPDATE employees SET is_active = ?, updated_at = datetime('now') WHERE employee_id = ?`)
      .run(body.isActive ? 1 : 0, id)
    logAudit(db, user.username, 'employee.update', 'employee', id, { isActive: body.isActive }, getIp(req))
    return NextResponse.json({ success: true })
  }

  // Partial update: only dailyRate
  if (body.dailyRate !== undefined && body.name === undefined && body.isActive === undefined) {
    db.prepare(`UPDATE employees SET daily_rate = ?, updated_at = datetime('now') WHERE employee_id = ?`)
      .run(body.dailyRate, id)
    logAudit(db, user.username, 'employee.update', 'employee', id, { dailyRate: body.dailyRate }, getIp(req))
    return NextResponse.json({ success: true })
  }

  // Full update
  db.prepare(`UPDATE employees SET
    name = ?, nickname = ?, department = ?, employment_type = ?,
    daily_rate = ?, monthly_salary = ?, start_date = ?, is_active = ?,
    phone = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?, prompt_pay_id = ?,
    updated_at = datetime('now')
    WHERE employee_id = ?`).run(
    body.name, body.nickname || null, body.department || null, body.employmentType,
    body.dailyRate || null, body.monthlySalary || null, body.startDate || null,
    body.isActive !== false ? 1 : 0,
    body.phone || null, body.bankName || null, body.bankAccountNumber || null, body.bankAccountName || null, body.promptPayId || null,
    id
  )
  logAudit(db, user.username, 'employee.update', 'employee', id, {
    name: body.name, employmentType: body.employmentType,
  }, getIp(req))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  db.prepare("UPDATE employees SET is_active = 0, updated_at = datetime('now') WHERE employee_id = ?").run(id)
  logAudit(db, user.username, 'employee.deactivate', 'employee', id, null, getIp(req))
  return NextResponse.json({ success: true })
}
