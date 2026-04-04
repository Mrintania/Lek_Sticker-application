import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const periodParam = searchParams.get('period')

  const year = yearParam ? Number(yearParam) : null
  const month = monthParam ? Number(monthParam) : null
  const period = periodParam ? Number(periodParam) : null

  if (year !== null && (isNaN(year) || year < 2020 || year > 2030)) {
    return NextResponse.json({ error: 'year ไม่ถูกต้อง (2020–2030)' }, { status: 400 })
  }
  if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
    return NextResponse.json({ error: 'month ไม่ถูกต้อง (1–12)' }, { status: 400 })
  }
  if (period !== null && ![1, 2].includes(period)) {
    return NextResponse.json({ error: 'period ต้องเป็น 1 หรือ 2' }, { status: 400 })
  }

  let query = `SELECT pr.*, e.name, e.employment_type FROM payroll_records pr
    LEFT JOIN employees e ON pr.employee_id = e.employee_id WHERE 1=1`
  const params: (string | number)[] = []

  // กรองพนักงาน Inactive ออก
  query += ' AND (e.is_active = 1 OR e.is_active IS NULL)'

  if (user.role === 'user' && user.employeeId) {
    query += ' AND pr.employee_id = ?'
    params.push(user.employeeId)
  }
  if (year !== null) { query += ' AND pr.year = ?'; params.push(year) }
  if (month !== null) { query += ' AND pr.month = ?'; params.push(month) }
  if (period !== null) { query += ' AND pr.period = ?'; params.push(period) }

  query += ' ORDER BY e.name, pr.period'
  const records = db.prepare(query).all(...params)
  return NextResponse.json(records)
}
