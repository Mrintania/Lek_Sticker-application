import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEmployee(row: any) {
  return {
    employeeId: row.employee_id,
    name: row.name,
    nickname: row.nickname,
    department: row.department,
    employmentType: row.employment_type,
    dailyRate: row.daily_rate,
    monthlySalary: row.monthly_salary,
    startDate: row.start_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // includeInactive=true สำหรับหน้าจัดการพนักงาน (admin/manager เท่านั้น)
  const includeInactive = searchParams.get('includeInactive') === 'true' && canManage(user.role)

  const db = getDb()
  const sql = includeInactive
    ? 'SELECT * FROM employees ORDER BY name'
    : 'SELECT * FROM employees WHERE is_active = 1 ORDER BY name'
  const rows = db.prepare(sql).all()
  return NextResponse.json(rows.map(mapEmployee))
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const db = getDb()

  try {
    db.prepare(`INSERT INTO employees (employee_id, name, nickname, department, employment_type, daily_rate, monthly_salary, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      body.employeeId, body.name, body.nickname || null, body.department || null,
      body.employmentType || 'daily', body.dailyRate || null, body.monthlySalary || null, body.startDate || null
    )
    logAudit(db, user.username, 'employee.create', 'employee', body.employeeId, {
      name: body.name, employmentType: body.employmentType || 'daily',
    }, getIp(req))
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'รหัสพนักงานซ้ำ' }, { status: 409 })
    }
    throw e
  }
}
