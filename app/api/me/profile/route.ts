import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.employeeId) return NextResponse.json({ error: 'ไม่ได้เชื่อมโยงกับพนักงาน' }, { status: 400 })

  const db = getDb()
  const emp = db.prepare(
    `SELECT phone, bank_name, bank_account_number, bank_account_name
     FROM employees WHERE employee_id = ?`
  ).get(user.employeeId) as { phone: string | null; bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null } | undefined

  if (!emp) return NextResponse.json({ error: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })

  return NextResponse.json({
    phone: emp.phone ?? '',
    bank_name: emp.bank_name ?? '',
    bank_account_number: emp.bank_account_number ?? '',
    bank_account_name: emp.bank_account_name ?? '',
  })
}

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.employeeId) return NextResponse.json({ error: 'ไม่ได้เชื่อมโยงกับพนักงาน' }, { status: 400 })

  const body = await req.json()
  const { phone, bank_name, bank_account_number, bank_account_name } = body

  const db = getDb()
  db.prepare(
    `UPDATE employees
     SET phone              = COALESCE(?, phone),
         bank_name          = COALESCE(?, bank_name),
         bank_account_number = COALESCE(?, bank_account_number),
         bank_account_name  = COALESCE(?, bank_account_name),
         updated_at         = datetime('now')
     WHERE employee_id = ?`
  ).run(
    phone || null,
    bank_name || null,
    bank_account_number || null,
    bank_account_name || null,
    user.employeeId
  )

  logAudit(db, user.username, 'profile.update', 'employee', user.employeeId,
    { phone: !!phone, bank_name: !!bank_name, bank_account_number: !!bank_account_number, bank_account_name: !!bank_account_name },
    getIp(req)
  )

  return NextResponse.json({ success: true })
}
